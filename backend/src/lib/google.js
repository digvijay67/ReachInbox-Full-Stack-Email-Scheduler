"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GOOGLE_SCOPES = exports.googleOAuth2Client = void 0;
const googleapis_1 = require("googleapis");
exports.googleOAuth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
exports.GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
];
