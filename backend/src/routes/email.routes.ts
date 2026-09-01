import { Router } from "express";

import { prisma } from "../lib/prisma";
import { emailQueue } from "../queue/email.queue";
import { sendEmail } from "../lib/mailer";
import {
  deleteEmailFromIndex,
  indexEmail,
  searchEmails,
} from "../services/email-search.service";


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
// SEARCH EMAILS (Elasticsearch)
// ------------------------------------
router.get(
  "/search",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: "Please login first",
        });
      }

      const query =
        typeof req.query.q === "string"
          ? req.query.q.trim()
          : "";

      console.log("========== SEARCH ==========");
      console.log("User:", req.user.id);
      console.log("Search query:", query);
      console.log("============================");

      const result = await searchEmails({
        userId: req.user.id,
        query: query || undefined,

        status:
          typeof req.query.status === "string"
            ? req.query.status.trim()
            : undefined,

        dateFrom:
          typeof req.query.dateFrom === "string"
            ? req.query.dateFrom.trim()
            : undefined,

        dateTo:
          typeof req.query.dateTo === "string"
            ? req.query.dateTo.trim()
            : undefined,

        from:
          0,

        size:
          20,
      });

      console.log(
        "Search results:",
        result.total
      );

      return res.json({
        query,
        total: result.total,
        totalPages: result.totalPages,
        results: result.hits,
      });
    } catch (error) {
      console.error(
        "Email search failed:",
        error
      );

      return res.status(500).json({
        message: "Email search failed",
      });
    }
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
          include: {
            sender: true,
          },
        });

      if (!email) {
        return res.status(404).json({
          message: "Email not found",
        });
      }

      const configuredSenderEmail =
        process.env.SMTP_FROM ||
        process.env.SMTP_USER ||
        email.sender?.email ||
        "";

      return res.json({
        ...email,
        sender: {
          id: email.sender?.id ?? 0,
          email: configuredSenderEmail,
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
// DELETE EMAIL
// ------------------------------------

router.delete(
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

      const email = await prisma.email.findFirst({
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

      if (email.jobId) {
        try {
          await emailQueue.remove(email.jobId);
        } catch (queueError) {
          console.warn(
            `Failed to remove queue job ${email.jobId}:`,
            queueError
          );
        }
      }

      await deleteEmailFromIndex(email.id);

      await prisma.email.delete({
        where: {
          id: email.id,
        },
      });

      return res.json({
        message: "Email deleted successfully",
      });
    } catch (error) {
      console.error(
        "Failed to delete email:",
        error
      );

      return res.status(500).json({
        message: "Failed to delete email",
      });
    }
  }
);

// ------------------------------------
// POST SCHEDULE EMAIL
// ------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      // 1. Normalize recipients
      //
      // `to` can be:
      //   - an array of emails (preferred, sent by the frontend)
      //   - a comma-separated string (backward compatible)
      // ------------------------------------

      let recipients: string[] = [];

      if (Array.isArray(to)) {
        recipients = to
          .filter((item) => typeof item === "string")
          .map((item: string) => item.trim());
      } else if (typeof to === "string") {
        recipients = to
          .split(",")
          .map((item) => item.trim());
      }

      // De-duplicate, drop empties.
      recipients = [
        ...new Set(
          recipients.filter((item) => item.length > 0)
        ),
      ];

      // ------------------------------------
      // 2. Validate required fields
      // ------------------------------------

      if (
        recipients.length === 0 ||
        typeof subject !== "string" ||
        !subject.trim() ||
        typeof body !== "string" ||
        !body.trim() ||
        !scheduledAt
      ) {
        return res.status(400).json({
          message:
            "to (at least one recipient), subject, body and scheduledAt are required",
        });
      }

      // ------------------------------------
      // 3. Validate every recipient's format
      // ------------------------------------

      const invalidRecipients = recipients.filter(
        (recipientEmail) => !EMAIL_REGEX.test(recipientEmail)
      );

      if (invalidRecipients.length > 0) {
        return res.status(400).json({
          message: "One or more recipient emails are invalid",
          invalidRecipients,
        });
      }

      // ------------------------------------
      // 4. Validate scheduled date
      // ------------------------------------

      const scheduleTime = new Date(scheduledAt);

      if (Number.isNaN(scheduleTime.getTime())) {
        return res.status(400).json({
          message: "Invalid scheduledAt",
        });
      }

      // ------------------------------------
      // 5. Scheduled time must be future
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
      // 6. Get user
      // ------------------------------------

      const userId = req.user!.id;

      // ------------------------------------
      // 7. Find sender
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
      // 8. Create one Email row + one BullMQ
      //    delayed job PER recipient.
      //
      //    Every recipient shares the same subject,
      //    body and scheduledAt, but gets tracked and
      //    rate-limited independently.
      // ------------------------------------

      const createdEmails = [];

      for (const recipientEmail of recipients) {
        const email = await prisma.email.create({
          data: {
            userId,
            senderId: sender.id,

            to: recipientEmail,
            subject: subject.trim(),
            body: body.trim(),

            scheduledAt: scheduleTime,

            status: "SCHEDULED",

            attempts: 0,
          },
        });

        const job = await emailQueue.add(
          "send-email",

          {
            emailId: email.id,
          },

          {
            delay,

            // IMPORTANT:
            // One unique BullMQ job per email row.
            jobId: `email-${email.id}`,
          }
        );
        // DEBUG
        console.log(
          "BullMQ job created:",
          job.id,
          "delay:",
          delay
        );

        const updatedEmail =
          await prisma.email.update({
            where: {
              id: email.id,
            },

            data: {
              jobId: String(job.id),
            },

            include: {
              sender: true,
            },
          });

        await indexEmail(updatedEmail);

        createdEmails.push(updatedEmail);
      }

      // ------------------------------------
      // 9. Response
      // ------------------------------------

      return res.status(201).json({
        message: `${createdEmails.length} email(s) scheduled successfully`,

        emails: createdEmails,

        count: createdEmails.length,

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



// import { Router } from "express";

// import { prisma } from "../lib/prisma";
// import { emailQueue } from "../queue/email.queue";
// import { sendEmail } from "../lib/mailer";
// import {
//   indexEmail,
//   searchEmails,
// } from "../services/email-search.service";


// import {
//   requireAuth,
//   AuthenticatedRequest,
// } from "../middleware/auth";
// const router = Router();

// // ------------------------------------
// // TEST USER
// // ------------------------------------



// // ------------------------------------
// // GET SCHEDULED EMAILS
// // ------------------------------------

// router.get(
//   "/scheduled",
//   requireAuth,
//   async (
//     req: AuthenticatedRequest,
//     res
//   ) => {
//     try {
//       const userId = req.user!.id;

//       const emails = await prisma.email.findMany({
//         where: {
//           userId,
//           status: {
//             in: ["SCHEDULED", "PROCESSING"],
//           },
//         },

//         orderBy: {
//           scheduledAt: "asc",
//         },
//       });

//       return res.json(emails);
//     } catch (error) {
//       console.error(
//         "Failed to fetch scheduled emails:",
//         error
//       );

//       return res.status(500).json({
//         message: "Failed to fetch scheduled emails",
//       });
//     }
//   });

// // ------------------------------------
// // GET SENT / FAILED EMAILS
// // ------------------------------------

// router.get(
//   "/sent",
//   requireAuth,
//   async (
//     req: AuthenticatedRequest,
//     res
//   ) => {
//     try {
//       const userId = req.user!.id;

//       const emails = await prisma.email.findMany({
//         where: {
//           userId,

//           status: {
//             in: ["SENT", "FAILED"],
//           },
//         },

//         orderBy: [
//           {
//             sentAt: "desc",
//           },
//           {
//             updatedAt: "desc",
//           },
//         ],
//       });

//       return res.json(emails);
//     } catch (error) {
//       console.error(
//         "Failed to fetch sent emails:",
//         error
//       );

//       return res.status(500).json({
//         message: "Failed to fetch sent emails",
//       });
//     }
//   });

// // ------------------------------------
// // GET ALL EMAILS
// // ------------------------------------

// router.get(
//   "/",
//   requireAuth,
//   async (
//     req: AuthenticatedRequest,
//     res
//   ) => {
//     try {
//       const userId = req.user!.id;

//       const emails = await prisma.email.findMany({
//         where: {
//           userId,
//         },

//         orderBy: {
//           scheduledAt: "asc",
//         },
//       });

//       return res.json(emails);
//     } catch (error) {
//       console.error(
//         "Failed to fetch emails:",
//         error
//       );

//       return res.status(500).json({
//         message: "Failed to fetch emails",
//       });
//     }
//   });

//   router.get(
//   "/sender",
//   requireAuth,
//   async (req: AuthenticatedRequest, res) => {
//     return res.json({
//       email:
//         process.env.SMTP_FROM ||
//         process.env.SMTP_USER ||
//         "",
//     });
//   }
// );


// // ------------------------------------
// // SEARCH EMAILS (Elasticsearch)
// // ------------------------------------

// router.get(
//   "/search",
//   requireAuth,
//   async (req: AuthenticatedRequest, res) => {
//     try {
//       const userId = req.user!.id;

//       const q =
//         typeof req.query.q === "string" ? req.query.q.trim() : "";

//       const status =
//         typeof req.query.status === "string"
//           ? req.query.status.toUpperCase()
//           : undefined;

//       const page = Math.max(Number(req.query.page) || 1, 1);
//       const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);

//       const results = await searchEmails({
//         userId,
//         query: q || undefined,
//         status,
//         from: (page - 1) * pageSize,
//         size: pageSize,
//       });

//       return res.json({
//         query: q,
//         status: status || null,
//         page,
//         pageSize,
//         total: results.total,
//         results: results.hits,
//       });
//     } catch (error) {
//       console.error("Email search failed:", error);
//       return res.status(500).json({ message: "Email search failed" });
//     }
//   }
// );

// // ------------------------------------
// // GET EMAIL BY ID
// // ------------------------------------

// router.get(
//   "/:id",
//   requireAuth,
//   async (
//     req: AuthenticatedRequest,
//     res
//   ) => {
//     try {
//       const userId = req.user!.id;

//       const emailId = Number(req.params.id);

//       if (Number.isNaN(emailId)) {
//         return res.status(400).json({
//           message: "Invalid email id",
//         });
//       }

//       const email =
//         await prisma.email.findFirst({
//           where: {
//             id: emailId,
//             userId,
//           },
//         });

//       if (!email) {
//         return res.status(404).json({
//           message: "Email not found",
//         });
//       }

//       return res.json({
//         ...email,

//         sender: {
//           email:
//             process.env.SMTP_USER || "",
//           name: "ReachInbox",
//         },
//       });
//     } catch (error) {
//       console.error(
//         "Failed to fetch email details:",
//         error
//       );

//       return res.status(500).json({
//         message:
//           "Failed to fetch email details",
//       });
//     }
//   }
// );

// // ------------------------------------
// // POST SCHEDULE EMAIL
// // ------------------------------------

// const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// router.post(
//   "/schedule",
//   requireAuth,
//   async (
//     req: AuthenticatedRequest,
//     res
//   ) => {
//     try {

//       const {
//         to,
//         subject,
//         body,
//         scheduledAt,
//       } = req.body;

//       // ------------------------------------
//       // 1. Normalize recipients
//       //
//       // `to` can be:
//       //   - an array of emails (preferred, sent by the frontend)
//       //   - a comma-separated string (backward compatible)
//       // ------------------------------------

//       let recipients: string[] = [];

//       if (Array.isArray(to)) {
//         recipients = to
//           .filter((item) => typeof item === "string")
//           .map((item: string) => item.trim());
//       } else if (typeof to === "string") {
//         recipients = to
//           .split(",")
//           .map((item) => item.trim());
//       }

//       // De-duplicate, drop empties.
//       recipients = [
//         ...new Set(
//           recipients.filter((item) => item.length > 0)
//         ),
//       ];

//       // ------------------------------------
//       // 2. Validate required fields
//       // ------------------------------------

//       if (
//         recipients.length === 0 ||
//         typeof subject !== "string" ||
//         !subject.trim() ||
//         typeof body !== "string" ||
//         !body.trim() ||
//         !scheduledAt
//       ) {
//         return res.status(400).json({
//           message:
//             "to (at least one recipient), subject, body and scheduledAt are required",
//         });
//       }

//       // ------------------------------------
//       // 3. Validate every recipient's format
//       // ------------------------------------

//       const invalidRecipients = recipients.filter(
//         (email) => !EMAIL_REGEX.test(email)
//       );

//       if (invalidRecipients.length > 0) {
//         return res.status(400).json({
//           message: "One or more recipient emails are invalid",
//           invalidRecipients,
//         });
//       }

//       // ------------------------------------
//       // 4. Validate scheduled date
//       // ------------------------------------

//       const scheduleTime = new Date(scheduledAt);

//       if (Number.isNaN(scheduleTime.getTime())) {
//         return res.status(400).json({
//           message: "Invalid scheduledAt",
//         });
//       }

//       // ------------------------------------
//       // 5. Scheduled time must be future
//       // ------------------------------------

//       const delay =
//         scheduleTime.getTime() - Date.now();

//       if (delay < 0) {
//         return res.status(400).json({
//           message:
//             "scheduledAt must be in the future",
//         });
//       }

//       // ------------------------------------
//       // 6. Get user
//       // ------------------------------------

//       const userId = req.user!.id;

//       // ------------------------------------
//       // 7. Find sender
//       // ------------------------------------

//       const sender = await prisma.sender.findFirst({
//         where: {
//           userId,
//         },
//       });

//       if (!sender) {
//         return res.status(400).json({
//           message:
//             "No sender configured for this user",
//         });
//       }

//       // ------------------------------------
//       // 8. Create one Email row + one BullMQ
//       //    delayed job PER recipient.
//       //
//       //    Every recipient shares the same subject,
//       //    body and scheduledAt, but gets tracked and
//       //    rate-limited independently.
//       // ------------------------------------

//       const createdEmails = [];

//       for (const recipientEmail of recipients) {
//         const email = await prisma.email.create({
//           data: {
//             userId,
//             senderId: sender.id,

//             to: recipientEmail,
//             subject: subject.trim(),
//             body: body.trim(),

//             scheduledAt: scheduleTime,

//             status: "SCHEDULED",

//             attempts: 0,
//           },
//         });

//         const job = await emailQueue.add(
//           "send-email",

//           {
//             emailId: email.id,
//           },

//           {
//             delay,

//             // IMPORTANT:
//             // One unique BullMQ job per email row.
//             jobId: `email-${email.id}`,
//           }
//         );

//         const updatedEmail =
//           await prisma.email.update({
//             where: {
//               id: email.id,
//             },

//             data: {
//               jobId: String(job.id),
//             },
//           });

//         await indexEmail(updatedEmail);

//         createdEmails.push(updatedEmail);
//       }

//       // ------------------------------------
//       // 9. Response
//       // ------------------------------------

//       return res.status(201).json({
//         message: `${createdEmails.length} email(s) scheduled successfully`,

//         emails: createdEmails,

//         count: createdEmails.length,

//         scheduledAt:
//           scheduleTime.toISOString(),
//       });
//     } catch (error) {
//       console.error(
//         "Failed to schedule email:",
//         error
//       );

//       return res.status(500).json({
//         message:
//           "Failed to schedule email",
//       });
//     }
//   });

// export default router;