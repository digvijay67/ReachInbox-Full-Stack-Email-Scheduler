"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const email_job_guards_1 = require("./email-job-guards");
(0, node_test_1.describe)("email job guards", () => {
    (0, node_test_1.it)("skips deleted emails before processing", () => {
        strict_1.default.equal((0, email_job_guards_1.shouldSkipDeletedEmail)(null), true);
        strict_1.default.equal((0, email_job_guards_1.shouldSkipDeletedEmail)(undefined), true);
        strict_1.default.equal((0, email_job_guards_1.shouldSkipDeletedEmail)({ id: 12, status: "SCHEDULED" }), false);
    });
    (0, node_test_1.it)("treats sent or missing emails as non-processable", () => {
        strict_1.default.equal((0, email_job_guards_1.canProcessEmail)(null), false);
        strict_1.default.equal((0, email_job_guards_1.canProcessEmail)({ id: 12, status: "SENT" }), false);
        strict_1.default.equal((0, email_job_guards_1.canProcessEmail)({ id: 12, status: "SCHEDULED" }), true);
    });
});
