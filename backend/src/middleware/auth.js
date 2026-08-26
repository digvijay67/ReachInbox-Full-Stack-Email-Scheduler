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
// export interface AuthenticatedRequest extends Request {
//   session: any;
//   user?: {
//     id: number;
//     googleId: string;
//     name: string;
//     email: string;
//     avatar: string | null;
//   };
// }
function requireAuth(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.session.userId;
            if (!userId) {
                res.status(401).json({
                    message: "Authentication required",
                });
                return;
            }
            const user = yield prisma_1.prisma.user.findUnique({
                where: {
                    id: userId,
                },
            });
            if (!user) {
                req.session.destroy(() => { });
                res.status(401).json({
                    message: "User not found",
                });
                return;
            }
            req.user = user;
            next();
        }
        catch (error) {
            console.error("Auth middleware error:", error);
            res.status(500).json({
                message: "Authentication failed",
            });
        }
    });
}
