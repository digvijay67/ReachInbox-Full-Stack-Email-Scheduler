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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
require("dotenv/config");
const nodemailer_1 = __importDefault(require("nodemailer"));
function sendEmail(sender, to, subject, body) {
    return __awaiter(this, void 0, void 0, function* () {
        const transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST ||
                "smtp.ethereal.email",
            port: Number(process.env.SMTP_PORT || 587),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        const info = yield transporter.sendMail({
            from: sender.name
                ? `"${sender.name}" <${sender.email}>`
                : sender.email,
            to,
            subject,
            text: body,
        });
        const previewUrl = nodemailer_1.default.getTestMessageUrl(info);
        console.log("Email sent:", info.messageId);
        if (previewUrl) {
            console.log("Ethereal preview:", previewUrl);
        }
        return Object.assign(Object.assign({}, info), { previewUrl });
    });
}
