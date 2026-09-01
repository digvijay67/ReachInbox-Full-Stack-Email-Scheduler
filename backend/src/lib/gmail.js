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
exports.sendGmailEmail = sendGmailEmail;
require("dotenv/config");
const googleapis_1 = require("googleapis");
const prisma_1 = require("./prisma");
function sendGmailEmail(senderId, to, subject, body) {
    return __awaiter(this, void 0, void 0, function* () {
        // ------------------------------------
        // 1. Get sender from DB
        // ------------------------------------
        const sender = yield prisma_1.prisma.sender.findUnique({
            where: {
                id: senderId,
            },
        });
        if (!sender) {
            throw new Error(`Sender ${senderId} not found`);
        }
        if (!sender.googleId) {
            throw new Error(`Sender ${senderId} is not connected with Google`);
        }
        if (!sender.accessToken) {
            throw new Error(`No Google access token found for sender ${senderId}`);
        }
        if (!sender.refreshToken) {
            throw new Error(`No Google refresh token found for sender ${senderId}`);
        }
        // ------------------------------------
        // 2. Create OAuth client
        // ------------------------------------
        const oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        oauth2Client.setCredentials({
            access_token: sender.accessToken,
            refresh_token: sender.refreshToken,
        });
        // ------------------------------------
        // 3. Refresh token if required
        // ------------------------------------
        const { credentials } = yield oauth2Client.refreshAccessToken();
        const newAccessToken = credentials.access_token;
        if (!newAccessToken) {
            throw new Error("Google did not return a new access token");
        }
        // ------------------------------------
        // 4. Save refreshed access token
        // ------------------------------------
        if (newAccessToken !== sender.accessToken) {
            yield prisma_1.prisma.sender.update({
                where: {
                    id: sender.id,
                },
                data: {
                    accessToken: newAccessToken,
                },
            });
            console.log(`Access token refreshed for sender ${sender.id}`);
        }
        // ------------------------------------
        // 5. Create Gmail client
        // ------------------------------------
        const gmail = googleapis_1.google.gmail({
            version: "v1",
            auth: oauth2Client,
        });
        // ------------------------------------
        // 6. Create MIME email
        // ------------------------------------
        const message = [
            `From: ${sender.email}`,
            `To: ${to}`,
            `Subject: ${subject}`,
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=UTF-8",
            "",
            body,
        ].join("\r\n");
        // Gmail requires base64url encoding
        const encodedMessage = Buffer.from(message)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        // ------------------------------------
        // 7. Send through Gmail API
        // ------------------------------------
        const response = yield gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
            },
        });
        console.log("--------------------------------");
        console.log(`Gmail email sent using sender ${sender.id}`);
        console.log("From:", sender.email);
        console.log("To:", to);
        console.log("Message ID:", response.data.id);
        console.log("--------------------------------");
        return {
            messageId: response.data.id || null,
        };
    });
}
