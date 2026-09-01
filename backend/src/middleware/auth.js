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
exports.requireAuth = requireAuth;
const prisma_1 = require("../lib/prisma");
function requireAuth(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.session.userId;
            if (!userId) {
                return res.status(401).json({
                    message: "Please login with Google first",
                });
            }
            const user = yield prisma_1.prisma.user.findUnique({
                where: {
                    id: userId,
                },
            });
            if (!user) {
                req.session.destroy(() => { });
                return res.status(401).json({
                    message: "User session is invalid",
                });
            }
            const sender = yield prisma_1.prisma.sender.findFirst({
                where: {
                    userId: user.id,
                },
            });
            if (!sender) {
                return res.status(403).json({
                    message: "Google sender is not connected",
                });
            }
            req.user = {
                id: user.id,
                googleId: user.googleId,
                email: user.email,
            };
            req.sender = {
                id: sender.id,
                email: sender.email,
                userId: sender.userId,
            };
            next();
        }
        catch (error) {
            console.error("Authentication error:", error);
            return res.status(500).json({
                message: "Authentication failed",
            });
        }
    });
}
