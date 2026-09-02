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
exports.getGoogleAccessToken = getGoogleAccessToken;
const prisma_1 = require("../lib/prisma");
const google_1 = require("../lib/google");
function getGoogleAccessToken(senderId) {
    return __awaiter(this, void 0, void 0, function* () {
        const sender = yield prisma_1.prisma.sender.findUnique({
            where: {
                id: senderId,
            },
        });
        if (!sender) {
            throw new Error("Sender not found");
        }
        if (!sender.accessToken) {
            throw new Error("Google access token not found");
        }
        google_1.googleOAuth2Client.setCredentials({
            access_token: sender.accessToken,
            refresh_token: sender.refreshToken || undefined,
        });
        try {
            const { token } = yield google_1.googleOAuth2Client.getAccessToken();
            if (!token) {
                throw new Error("Unable to get Google access token");
            }
            // ----------------------------------------
            // Save refreshed access token
            // ----------------------------------------
            if (token !== sender.accessToken) {
                yield prisma_1.prisma.sender.update({
                    where: {
                        id: sender.id,
                    },
                    data: {
                        accessToken: token,
                    },
                });
                console.log(`Access token refreshed for sender ${sender.id}`);
            }
            return token;
        }
        catch (error) {
            console.error("Google token error:", error);
            throw new Error("Google authorization expired. Please login again.");
        }
    });
}
