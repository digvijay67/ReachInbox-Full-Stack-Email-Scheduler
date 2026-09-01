"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleOAuth2Client = exports.GOOGLE_SCOPES = void 0;
require("dotenv/config");
const googleapis_1 = require("googleapis");
exports.GOOGLE_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.send",
];
if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is missing");
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_SECRET is missing");
}
if (!process.env.GOOGLE_REDIRECT_URI) {
    throw new Error("GOOGLE_REDIRECT_URI is missing");
}
exports.googleOAuth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
