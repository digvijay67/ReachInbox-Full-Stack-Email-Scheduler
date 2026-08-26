"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const email_queue_1 = require("../queue/email.queue");
const router = (0, express_1.Router)();
// ------------------------------------
// TEST USER
// ------------------------------------
const getTestUserId = () => {
    const userId = Number(process.env.TEST_USER_ID || 1);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error("Invalid TEST_USER_ID");
    }
    return userId;
};
// ------------------------------------
// GET SCHEDULED EMAILS
// ------------------------------------
router.get("/scheduled", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = getTestUserId();
        const emails = yield prisma_1.prisma.email.findMany({
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
    }
    catch (error) {
        console.error("Failed to fetch scheduled emails:", error);
        return res.status(500).json({
            message: "Failed to fetch scheduled emails",
        });
    }
}));
// ------------------------------------
// GET SENT / FAILED EMAILS
// ------------------------------------
router.get("/sent", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = getTestUserId();
        const emails = yield prisma_1.prisma.email.findMany({
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
    }
    catch (error) {
        console.error("Failed to fetch sent emails:", error);
        return res.status(500).json({
            message: "Failed to fetch sent emails",
        });
    }
}));
// ------------------------------------
// GET ALL EMAILS
// ------------------------------------
router.get("/", (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = getTestUserId();
        const emails = yield prisma_1.prisma.email.findMany({
            where: {
                userId,
            },
            orderBy: {
                scheduledAt: "asc",
            },
        });
        return res.json(emails);
    }
    catch (error) {
        console.error("Failed to fetch emails:", error);
        return res.status(500).json({
            message: "Failed to fetch emails",
        });
    }
}));
// ------------------------------------
// POST SCHEDULE EMAIL
// ------------------------------------
router.post("/schedule", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { to, subject, body, scheduledAt, } = req.body;
        // ------------------------------------
        // 1. Validate required fields
        // ------------------------------------
        if (typeof to !== "string" ||
            !to.trim() ||
            typeof subject !== "string" ||
            !subject.trim() ||
            typeof body !== "string" ||
            !body.trim() ||
            !scheduledAt) {
            return res.status(400).json({
                message: "to, subject, body and scheduledAt are required",
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
        const delay = scheduleTime.getTime() - Date.now();
        if (delay < 0) {
            return res.status(400).json({
                message: "scheduledAt must be in the future",
            });
        }
        // ------------------------------------
        // 4. Get user
        // ------------------------------------
        const userId = getTestUserId();
        // ------------------------------------
        // 5. Find sender
        // ------------------------------------
        const sender = yield prisma_1.prisma.sender.findFirst({
            where: {
                userId,
            },
        });
        if (!sender) {
            return res.status(400).json({
                message: "No sender configured for this user",
            });
        }
        // ------------------------------------
        // 6. Create email in DB
        // ------------------------------------
        const email = yield prisma_1.prisma.email.create({
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
        const job = yield email_queue_1.emailQueue.add("send-email", {
            emailId: email.id,
        }, {
            delay,
            // IMPORTANT:
            // One unique BullMQ job per email.
            jobId: `email-${email.id}`,
        });
        // ------------------------------------
        // 8. Save BullMQ job ID
        // ------------------------------------
        const updatedEmail = yield prisma_1.prisma.email.update({
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
            message: "Email scheduled successfully",
            email: updatedEmail,
            jobId: job.id,
            scheduledAt: scheduleTime.toISOString(),
        });
    }
    catch (error) {
        console.error("Failed to schedule email:", error);
        return res.status(500).json({
            message: "Failed to schedule email",
        });
    }
}));
exports.default = router;
