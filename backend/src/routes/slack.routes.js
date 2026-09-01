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
const slack_1 = require("../lib/slack");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const FRONTEND_URL = process.env.FRONTEND_URL ||
    "http://localhost:5173";
// ------------------------------------
// GET CURRENT SLACK CONNECTION STATUS
// ------------------------------------
router.get("/status", auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const integration = yield prisma_1.prisma.slackIntegration.findUnique({
        where: {
            userId: req.user.id,
        },
    });
    return res.json({
        connected: Boolean(integration),
        teamName: (integration === null || integration === void 0 ? void 0 : integration.teamName) || null,
        channel: (integration === null || integration === void 0 ? void 0 : integration.channel) || null,
    });
}));
// ------------------------------------
// START OAUTH FLOW
// ------------------------------------
router.get("/connect", auth_1.requireAuth, (req, res) => {
    const url = (0, slack_1.buildSlackAuthorizeUrl)(req.user.id);
    return res.redirect(url);
});
// ------------------------------------
// OAUTH CALLBACK
// ------------------------------------
router.get("/callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const code = typeof req.query.code === "string"
            ? req.query.code
            : null;
        const state = typeof req.query.state === "string"
            ? req.query.state
            : null;
        if (!code || !state) {
            return res.redirect(`${FRONTEND_URL}/dashboard?slack=error`);
        }
        const userId = Number(state);
        if (Number.isNaN(userId)) {
            return res.redirect(`${FRONTEND_URL}/dashboard?slack=error`);
        }
        yield (0, slack_1.exchangeSlackCode)(code, userId);
        return res.redirect(`${FRONTEND_URL}/dashboard?slack=connected`);
    }
    catch (error) {
        console.error("Slack OAuth callback error:", error);
        return res.redirect(`${FRONTEND_URL}/dashboard?slack=error`);
    }
}));
// ------------------------------------
// DISCONNECT
// ------------------------------------
router.post("/disconnect", auth_1.requireAuth, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, slack_1.disconnectSlack)(req.user.id);
    return res.json({
        message: "Slack disconnected",
    });
}));
exports.default = router;
