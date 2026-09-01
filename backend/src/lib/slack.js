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
exports.buildSlackAuthorizeUrl = buildSlackAuthorizeUrl;
exports.exchangeSlackCode = exchangeSlackCode;
exports.disconnectSlack = disconnectSlack;
exports.notifySlack = notifySlack;
require("dotenv/config");
const prisma_1 = require("./prisma");
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || "";
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || "";
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || "";
/**
 * Builds the Slack "Add to Slack" authorize URL.
 *
 * Uses the `incoming-webhook` scope, which lets the installing
 * user pick a specific channel during the OAuth consent screen
 * and hands back a ready-to-POST webhook URL for that channel —
 * simplest way to satisfy "stores the token/webhook per user".
 *
 * `state` carries our own userId through the redirect so the
 * callback knows which ReachInbox user to attach this to.
 */
function buildSlackAuthorizeUrl(userId) {
    const params = new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        scope: "incoming-webhook",
        redirect_uri: SLACK_REDIRECT_URI,
        state: String(userId),
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}
/**
 * Exchanges the OAuth `code` from Slack's redirect for a real
 * incoming webhook URL, and stores it against the given user.
 * Upserts, so reconnecting simply replaces the old webhook.
 */
function exchangeSlackCode(code, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const response = yield fetch("https://slack.com/api/oauth.v2.access", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: SLACK_CLIENT_ID,
                client_secret: SLACK_CLIENT_SECRET,
                code,
                redirect_uri: SLACK_REDIRECT_URI,
            }),
        });
        const data = (yield response.json());
        if (!data.ok || !data.incoming_webhook) {
            throw new Error(`Slack OAuth exchange failed: ${data.error || "unknown error"}`);
        }
        yield prisma_1.prisma.slackIntegration.upsert({
            where: {
                userId,
            },
            create: {
                userId,
                teamId: ((_a = data.team) === null || _a === void 0 ? void 0 : _a.id) || "",
                teamName: ((_b = data.team) === null || _b === void 0 ? void 0 : _b.name) || null,
                incomingWebhookUrl: data.incoming_webhook.url,
                channel: data.incoming_webhook.channel,
            },
            update: {
                teamId: ((_c = data.team) === null || _c === void 0 ? void 0 : _c.id) || "",
                teamName: ((_d = data.team) === null || _d === void 0 ? void 0 : _d.name) || null,
                incomingWebhookUrl: data.incoming_webhook.url,
                channel: data.incoming_webhook.channel,
            },
        });
    });
}
function disconnectSlack(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield prisma_1.prisma.slackIntegration
            .delete({
            where: {
                userId,
            },
        })
            .catch(() => {
            // Already disconnected — nothing to do.
        });
    });
}
/**
 * Sends a live Slack message to the given user's connected
 * workspace, IF they have one connected.
 *
 * Safe by design:
 *   - No integration found -> silently does nothing, no crash.
 *   - Slack API call fails -> logged, swallowed, never thrown —
 *     a Slack outage must never block or fail an email send.
 */
function notifySlack(userId, text) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const integration = yield prisma_1.prisma.slackIntegration.findUnique({
                where: {
                    userId,
                },
            });
            if (!integration) {
                // User hasn't connected Slack. Not an error.
                return;
            }
            const response = yield fetch(integration.incomingWebhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text }),
            });
            const responseBody = yield response.text();
            console.log("========== SLACK RESPONSE ==========");
            console.log("Status:", response.status);
            console.log("Body:", responseBody);
            console.log("====================================");
            if (!response.ok) {
                console.error(`Slack notification failed (${response.status}):`, responseBody);
            }
        }
        catch (error) {
            console.error("Slack notification error:", error instanceof Error
                ? error.message
                : error);
        }
    });
}
