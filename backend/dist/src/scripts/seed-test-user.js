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
require("dotenv/config");
const prisma_1 = require("../lib/prisma");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const etherealUser = process.env.SMTP_USER;
        const etherealPassword = process.env.SMTP_PASS;
        if (!etherealUser || !etherealPassword) {
            throw new Error("SMTP_USER and SMTP_PASS are required");
        }
        const user = yield prisma_1.prisma.user.upsert({
            where: {
                googleId: "test-google-user",
            },
            update: {},
            create: {
                googleId: "test-google-user",
                name: "Test User",
                email: "test@reachinbox.local",
            },
        });
        const sender = yield prisma_1.prisma.sender.findFirst({
            where: {
                userId: user.id,
            },
        });
        if (!sender) {
            yield prisma_1.prisma.sender.create({
                data: {
                    userId: user.id,
                    email: etherealUser,
                    name: "ReachInbox Test",
                    etherealUser,
                    etherealPassword,
                },
            });
        }
        console.log("Test user ID:", user.id);
        console.log("Test user created successfully");
    });
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.prisma.$disconnect();
}));
