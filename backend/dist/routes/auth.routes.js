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
const googleapis_1 = require("googleapis");
const prisma_1 = require("../lib/prisma");
const google_1 = require("../lib/google");
const router = (0, express_1.Router)();
// ============================================
// GOOGLE LOGIN START
// ============================================
router.get("/google", (_req, res) => {
    const authUrl = google_1.googleOAuth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: google_1.GOOGLE_SCOPES,
    });
    return res.redirect(authUrl);
});
// ============================================
// GOOGLE CALLBACK
// ============================================
router.get("/google/callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code } = req.query;
        if (!code || typeof code !== "string") {
            return res.status(400).json({
                message: "Google authorization code missing",
            });
        }
        // ----------------------------------------
        // Get Google tokens
        // ----------------------------------------
        const { tokens } = yield google_1.googleOAuth2Client.getToken(code);
        if (!tokens.access_token) {
            return res.status(400).json({
                message: "Google access token missing",
            });
        }
        google_1.googleOAuth2Client.setCredentials(tokens);
        // ----------------------------------------
        // Get Google user information
        // ----------------------------------------
        const oauth2 = googleapis_1.google.oauth2({
            version: "v2",
            auth: google_1.googleOAuth2Client,
        });
        const { data: googleUser } = yield oauth2.userinfo.get();
        if (!googleUser.id || !googleUser.email) {
            return res.status(400).json({
                message: "Unable to get Google user information",
            });
        }
        // ========================================
        // FIND / CREATE USER
        // ========================================
        let user = yield prisma_1.prisma.user.findUnique({
            where: {
                googleId: googleUser.id,
            },
        });
        if (!user) {
            user = yield prisma_1.prisma.user.create({
                data: {
                    googleId: googleUser.id,
                    name: googleUser.name || "Google User",
                    email: googleUser.email,
                    avatar: googleUser.picture || null,
                },
            });
            console.log("New user created:", user.id);
        }
        else {
            user = yield prisma_1.prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    name: googleUser.name || user.name,
                    email: googleUser.email,
                    avatar: googleUser.picture || user.avatar,
                },
            });
            console.log("Existing user logged in:", user.id);
        }
        // ========================================
        // FIND / CREATE SENDER
        // ========================================
        const existingSender = yield prisma_1.prisma.sender.findFirst({
            where: {
                userId: user.id,
            },
        });
        let sender;
        if (existingSender) {
            sender =
                yield prisma_1.prisma.sender.update({
                    where: {
                        id: existingSender.id,
                    },
                    data: Object.assign({ email: googleUser.email, name: googleUser.name || null, googleId: googleUser.id, accessToken: tokens.access_token }, (tokens.refresh_token
                        ? {
                            refreshToken: tokens.refresh_token,
                        }
                        : {})),
                });
        }
        else {
            sender =
                yield prisma_1.prisma.sender.create({
                    data: {
                        userId: user.id,
                        email: googleUser.email,
                        name: googleUser.name || null,
                        googleId: googleUser.id,
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token || null,
                    },
                });
        }
        // ========================================
        // CREATE LOGIN SESSION
        // ========================================
        req.session.userId = user.id;
        req.session.senderId = sender.id;
        console.log("Google login successful");
        console.log("User ID:", user.id);
        console.log("Sender ID:", sender.id);
        console.log("Email:", user.email);
        console.log("Access token saved:", !!sender.accessToken);
        console.log("Refresh token saved:", !!sender.refreshToken);
        // ========================================
        // SAVE SESSION
        // ========================================
        req.session.save((sessionError) => {
            if (sessionError) {
                console.error("Session save error:", sessionError);
                return res.status(500).json({
                    message: "Failed to create login session",
                });
            }
            // After login, go to frontend dashboard
            return res.redirect(`${process.env.FRONTEND_URL ||
                "http://localhost:5173"}/dashboard`);
        });
    }
    catch (error) {
        console.error("Google OAuth error:", error);
        return res.status(500).json({
            message: "Google OAuth failed",
        });
    }
}));
// ============================================
// CURRENT LOGGED-IN USER
// ============================================
router.get("/me", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            return res.status(401).json({
                message: "User not found",
            });
        }
        const sender = yield prisma_1.prisma.sender.findFirst({
            where: {
                userId: user.id,
            },
        });
        return res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
            },
            sender: sender
                ? {
                    id: sender.id,
                    email: sender.email,
                    name: sender.name,
                }
                : null,
        });
    }
    catch (error) {
        console.error("Get current user error:", error);
        return res.status(500).json({
            message: "Failed to get current user",
        });
    }
}));
// ============================================
// LOGOUT
// ============================================
router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                message: "Logout failed",
            });
        }
        res.clearCookie("connect.sid");
        return res.json({
            message: "Logged out successfully",
        });
    });
});
exports.default = router;
// import { Router } from "express";
// import { google } from "googleapis";
// import { prisma } from "../lib/prisma";
// import {
//   googleOAuth2Client,
//   GOOGLE_SCOPES,
// } from "../lib/google";
// const router = Router();
// // ============================================
// // START GOOGLE LOGIN
// // ============================================
// router.get("/google", (_req, res) => {
//   const authUrl =
//     googleOAuth2Client.generateAuthUrl({
//       access_type: "offline",
//       prompt: "consent",
//       scope: GOOGLE_SCOPES,
//     });
//   console.log("--------------------------------");
//   console.log("Starting Google OAuth");
//   console.log(
//     "Redirect URI:",
//     process.env.GOOGLE_REDIRECT_URI
//   );
//   console.log("--------------------------------");
//   return res.redirect(authUrl);
// });
// // ============================================
// // GOOGLE CALLBACK
// // ============================================
// router.get(
//   "/google/callback",
//   async (req, res) => {
//     try {
//       const { code } = req.query;
//       if (!code || typeof code !== "string") {
//         return res.status(400).json({
//           message:
//             "Google authorization code missing",
//         });
//       }
//       // ----------------------------------------
//       // Exchange code for tokens
//       // ----------------------------------------
//       const { tokens } =
//         await googleOAuth2Client.getToken(code);
//       if (!tokens.access_token) {
//         return res.status(400).json({
//           message: "Google access token missing",
//         });
//       }
//       console.log(
//         "Google access token received"
//       );
//       googleOAuth2Client.setCredentials(tokens);
//       // ----------------------------------------
//       // Get Google user
//       // ----------------------------------------
//       const oauth2 = google.oauth2({
//         version: "v2",
//         auth: googleOAuth2Client,
//       });
//       const { data: googleUser } =
//         await oauth2.userinfo.get();
//       if (!googleUser.id || !googleUser.email) {
//         return res.status(400).json({
//           message:
//             "Unable to get Google user information",
//         });
//       }
//       console.log(
//         "Google user:",
//         googleUser.email
//       );
//       // ========================================
//       // FIND / CREATE USER
//       // ========================================
//       let user =
//         await prisma.user.findUnique({
//           where: {
//             googleId: googleUser.id,
//           },
//         });
//       if (!user) {
//         user = await prisma.user.create({
//           data: {
//             googleId: googleUser.id,
//             name:
//               googleUser.name || "Google User",
//             email: googleUser.email,
//             avatar:
//               googleUser.picture || null,
//           },
//         });
//         console.log(
//           "New user created:",
//           user.id
//         );
//       } else {
//         user = await prisma.user.update({
//           where: {
//             id: user.id,
//           },
//           data: {
//             name:
//               googleUser.name || user.name,
//             email: googleUser.email,
//             avatar:
//               googleUser.picture || user.avatar,
//           },
//         });
//         console.log(
//           "Existing user logged in:",
//           user.id
//         );
//       }
//       // ========================================
//       // FIND / CREATE SENDER
//       // ========================================
//       const existingSender =
//         await prisma.sender.findFirst({
//           where: {
//             userId: user.id,
//           },
//         });
//       let sender;
//       if (existingSender) {
//         sender =
//           await prisma.sender.update({
//             where: {
//               id: existingSender.id,
//             },
//             data: {
//               email: googleUser.email,
//               name:
//                 googleUser.name || null,
//               googleId: googleUser.id,
//               accessToken:
//                 tokens.access_token,
//               // IMPORTANT:
//               // Google may not return refresh_token
//               // on every login.
//               ...(tokens.refresh_token
//                 ? {
//                   refreshToken:
//                     tokens.refresh_token,
//                 }
//                 : {}),
//             },
//           });
//         console.log(
//           "Sender updated:",
//           sender.id
//         );
//       } else {
//         sender =
//           await prisma.sender.create({
//             data: {
//               userId: user.id,
//               email: googleUser.email,
//               name:
//                 googleUser.name || null,
//               googleId: googleUser.id,
//               accessToken:
//                 tokens.access_token,
//               refreshToken:
//                 tokens.refresh_token || null,
//             },
//           });
//         console.log(
//           "Sender created:",
//           sender.id
//         );
//       }
//       // ========================================
//       // LOGIN SUCCESS
//       // ========================================
//       req.session.userId = user.id;
//       req.session.senderId = sender.id;
//       console.log("--------------------------------");
//       console.log(
//         "Google OAuth successful"
//       );
//       console.log("User ID:", user.id);
//       console.log("Sender ID:", sender.id);
//       console.log("Email:", sender.email);
//       console.log(
//         "Access token saved:",
//         !!sender.accessToken
//       );
//       console.log(
//         "Refresh token saved:",
//         !!sender.refreshToken
//       );
//       console.log(
//         "Session ID:",
//         req.sessionID
//       );
//       console.log("--------------------------------");
//       // IMPORTANT:
//       // Explicitly save session before response
//       req.session.save((sessionError) => {
//         if (sessionError) {
//           console.error(
//             "Failed to save login session:",
//             sessionError
//           );
//           return res.status(500).json({
//             message: "Failed to create login session",
//           });
//         }
//         return res.json({
//           message: "Google login successful",
//           user: {
//             id: user.id,
//             name: user.name,
//             email: user.email,
//             avatar: user.avatar,
//           },
//           sender: {
//             id: sender.id,
//             email: sender.email,
//             name: sender.name,
//           },
//           authentication: {
//             userId: user.id,
//             senderId: sender.id,
//           },
//         });
//       });
//     } catch (error) {
//       console.error(
//         "Google OAuth error:",
//         error
//       );
//       return res.status(500).json({
//         message:
//           "Google OAuth failed",
//       });
//     }
//   }
// );
// router.get("/me", (req, res) => {
//   return res.json({
//     loggedIn: !!req.session.userId,
//     userId: req.session.userId || null,
//     senderId: req.session.senderId || null,
//     sessionId: req.sessionID,
//   });
// });
// export default router;
