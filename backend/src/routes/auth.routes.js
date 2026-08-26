router.get("/google", (_req, res) => {
  console.log("CLIENT ID:", process.env.GOOGLE_CLIENT_ID);
  console.log("REDIRECT URI:", process.env.GOOGLE_REDIRECT_URI);

  const authUrl = googleOAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });

  console.log("AUTH URL:", authUrl);

  return res.redirect(authUrl);
});

// "use strict";
// var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
//     function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
//     return new (P || (P = Promise))(function (resolve, reject) {
//         function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
//         function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
//         function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
//         step((generator = generator.apply(thisArg, _arguments || [])).next());
//     });
// };
// Object.defineProperty(exports, "__esModule", { value: true });
// const express_1 = require("express");
// const googleapis_1 = require("googleapis");
// const prisma_1 = require("../lib/prisma");
// const google_1 = require("../lib/google");
// const router = (0, express_1.Router)();
// // ------------------------------------
// // Start Google OAuth
// // ------------------------------------
// router.get("/google", (_req, res) => {
//     const authUrl = google_1.googleOAuth2Client.generateAuthUrl({
//         access_type: "offline",
//         prompt: "consent",
//         scope: google_1.GOOGLE_SCOPES,
//     });
//     return res.redirect(authUrl);
// });
// // ------------------------------------
// // Google OAuth callback
// // ------------------------------------
// router.get("/google/callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
//     try {
//         const { code } = req.query;
//         if (!code || typeof code !== "string") {
//             return res.status(400).json({
//                 message: "Google authorization code missing",
//             });
//         }
//         // Exchange authorization code for tokens
//         const { tokens } = yield google_1.googleOAuth2Client.getToken(code);
//         if (!tokens.access_token) {
//             return res.status(400).json({
//                 message: "Google access token missing",
//             });
//         }
//         google_1.googleOAuth2Client.setCredentials(tokens);
//         // ------------------------------------
//         // Get Google user information
//         // ------------------------------------
//         const oauth2 = googleapis_1.google.oauth2({
//             version: "v2",
//             auth: google_1.googleOAuth2Client,
//         });
//         const { data: googleUser } = yield oauth2.userinfo.get();
//         if (!googleUser.id || !googleUser.email) {
//             return res.status(400).json({
//                 message: "Unable to get Google user information",
//             });
//         }
//         // ------------------------------------
//         // Find or create User
//         // ------------------------------------
//         let user = yield prisma_1.prisma.user.findUnique({
//             where: {
//                 googleId: googleUser.id,
//             },
//         });
//         if (!user) {
//             user = yield prisma_1.prisma.user.create({
//                 data: {
//                     googleId: googleUser.id,
//                     name: googleUser.name || "Google User",
//                     email: googleUser.email,
//                     avatar: googleUser.picture || null,
//                 },
//             });
//         }
//         else {
//             user = yield prisma_1.prisma.user.update({
//                 where: {
//                     id: user.id,
//                 },
//                 data: {
//                     name: googleUser.name || user.name,
//                     email: googleUser.email,
//                     avatar: googleUser.picture || user.avatar,
//                 },
//             });
//         }
//         // ------------------------------------
//         // Find or create Sender
//         // ------------------------------------
//         const existingSender = yield prisma_1.prisma.sender.findFirst({
//             where: {
//                 userId: user.id,
//                 googleId: googleUser.id,
//             },
//         });
//         let sender;
//         if (existingSender) {
//             sender = yield prisma_1.prisma.sender.update({
//                 where: {
//                     id: existingSender.id,
//                 },
//                 data: Object.assign({ email: googleUser.email, name: googleUser.name || null, googleId: googleUser.id, accessToken: tokens.access_token }, (tokens.refresh_token
//                     ? {
//                         refreshToken: tokens.refresh_token,
//                     }
//                     : {})),
//             });
//         }
//         else {
//             sender = yield prisma_1.prisma.sender.create({
//                 data: {
//                     userId: user.id,
//                     email: googleUser.email,
//                     name: googleUser.name || null,
//                     googleId: googleUser.id,
//                     accessToken: tokens.access_token,
//                     refreshToken: tokens.refresh_token || null,
//                 },
//             });
//         }
//         console.log("--------------------------------");
//         console.log("Google OAuth successful");
//         console.log("User ID:", user.id);
//         console.log("Sender ID:", sender.id);
//         console.log("Google email:", sender.email);
//         console.log("--------------------------------");
//         return res.json({
//             message: "Google account connected successfully",
//             user: {
//                 id: user.id,
//                 name: user.name,
//                 email: user.email,
//             },
//             sender: {
//                 id: sender.id,
//                 email: sender.email,
//                 name: sender.name,
//             },
//         });
//     }
//     catch (error) {
//         console.error("Google OAuth error:", error);
//         return res.status(500).json({
//             message: "Google OAuth failed",
//         });
//     }
// }));
// exports.default = router;
