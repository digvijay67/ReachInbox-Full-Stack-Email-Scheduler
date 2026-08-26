import { Router } from "express";

import { prisma } from "../lib/prisma";
import { emailQueue } from "../queue/email.queue";
import { sendEmail } from "../lib/mailer";


import {
  requireAuth,
  AuthenticatedRequest,
} from "../middleware/auth";
const router = Router();

// ------------------------------------
// TEST USER
// ------------------------------------



// ------------------------------------
// GET SCHEDULED EMAILS
// ------------------------------------

router.get(
  "/scheduled",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const userId = req.user!.id;

      const emails = await prisma.email.findMany({
        where: {
          userId,
          status: {
            in: ["SCHEDULED", "PROCESSING"],
          },
        },

        orderBy: {
          scheduledAt: "asc",
        },
      });

      return res.json(emails);
    } catch (error) {
      console.error(
        "Failed to fetch scheduled emails:",
        error
      );

      return res.status(500).json({
        message: "Failed to fetch scheduled emails",
      });
    }
  });

// ------------------------------------
// GET SENT / FAILED EMAILS
// ------------------------------------

router.get(
  "/sent",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const userId = req.user!.id;

      const emails = await prisma.email.findMany({
        where: {
          userId,

          status: {
            in: ["SENT", "FAILED"],
          },
        },

        orderBy: [
          {
            sentAt: "desc",
          },
          {
            updatedAt: "desc",
          },
        ],
      });

      return res.json(emails);
    } catch (error) {
      console.error(
        "Failed to fetch sent emails:",
        error
      );

      return res.status(500).json({
        message: "Failed to fetch sent emails",
      });
    }
  });

// ------------------------------------
// GET ALL EMAILS
// ------------------------------------

router.get(
  "/",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const userId = req.user!.id;

      const emails = await prisma.email.findMany({
        where: {
          userId,
        },

        orderBy: {
          scheduledAt: "asc",
        },
      });

      return res.json(emails);
    } catch (error) {
      console.error(
        "Failed to fetch emails:",
        error
      );

      return res.status(500).json({
        message: "Failed to fetch emails",
      });
    }
  });

  router.get(
  "/sender",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    return res.json({
      email:
        process.env.SMTP_FROM ||
        process.env.SMTP_USER ||
        "",
    });
  }
);


// ------------------------------------
// GET EMAIL BY ID
// ------------------------------------

router.get(
  "/:id",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {
      const userId = req.user!.id;

      const emailId = Number(req.params.id);

      if (Number.isNaN(emailId)) {
        return res.status(400).json({
          message: "Invalid email id",
        });
      }

      const email =
        await prisma.email.findFirst({
          where: {
            id: emailId,
            userId,
          },
        });

      if (!email) {
        return res.status(404).json({
          message: "Email not found",
        });
      }

      return res.json({
        ...email,

        sender: {
          email:
            process.env.SMTP_USER || "",
          name: "ReachInbox",
        },
      });
    } catch (error) {
      console.error(
        "Failed to fetch email details:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to fetch email details",
      });
    }
  }
);

// ------------------------------------
// POST SCHEDULE EMAIL
// ------------------------------------

router.post(
  "/schedule",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    try {

      const {
        to,
        subject,
        body,
        scheduledAt,
      } = req.body;

      // ------------------------------------
      // 1. Validate required fields
      // ------------------------------------

      if (
        typeof to !== "string" ||
        !to.trim() ||
        typeof subject !== "string" ||
        !subject.trim() ||
        typeof body !== "string" ||
        !body.trim() ||
        !scheduledAt
      ) {
        return res.status(400).json({
          message:
            "to, subject, body and scheduledAt are required",
        });
      }

      // ------------------------------------
      // 2. Validate scheduled date
      // ------------------------------------

      const scheduleTime = new Date(scheduledAt);

      if (Number.isNaN(scheduleTime.getTime())) {
        return res.status(400).json({
          message: "Invalid scheduledAt",
        });
      }

      // ------------------------------------
      // 3. Scheduled time must be future
      // ------------------------------------

      const delay =
        scheduleTime.getTime() - Date.now();

      if (delay < 0) {
        return res.status(400).json({
          message:
            "scheduledAt must be in the future",
        });
      }

      // ------------------------------------
      // 4. Get user
      // ------------------------------------

      const userId = req.user!.id;

      // ------------------------------------
      // 5. Find sender
      // ------------------------------------

      const sender = await prisma.sender.findFirst({
        where: {
          userId,
        },
      });

      if (!sender) {
        return res.status(400).json({
          message:
            "No sender configured for this user",
        });
      }

      // ------------------------------------
      // 6. Create email in DB
      // ------------------------------------

      const email = await prisma.email.create({
        data: {
          userId,
          senderId: sender.id,

          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),

          scheduledAt: scheduleTime,

          status: "SCHEDULED",

          attempts: 0,
        },
      });

      // ------------------------------------
      // 7. Add delayed BullMQ job
      // ------------------------------------

      const job = await emailQueue.add(
        "send-email",

        {
          emailId: email.id,
        },

        {
          delay,

          // IMPORTANT:
          // One unique BullMQ job per email.
          jobId: `email-${email.id}`,
        }
      );

      // ------------------------------------
      // 8. Save BullMQ job ID
      // ------------------------------------

      const updatedEmail =
        await prisma.email.update({
          where: {
            id: email.id,
          },

          data: {
            jobId: String(job.id),
          },
        });

      // ------------------------------------
      // 9. Response
      // ------------------------------------

      return res.status(201).json({
        message:
          "Email scheduled successfully",

        email: updatedEmail,

        jobId: job.id,

        scheduledAt:
          scheduleTime.toISOString(),
      });
    } catch (error) {
      console.error(
        "Failed to schedule email:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to schedule email",
      });
    }
  });

export default router;