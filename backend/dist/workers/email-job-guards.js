"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldSkipDeletedEmail = shouldSkipDeletedEmail;
exports.canProcessEmail = canProcessEmail;
function shouldSkipDeletedEmail(email) {
    return !email;
}
function canProcessEmail(email) {
    if (!email) {
        return false;
    }
    if (email.status === "SENT") {
        return false;
    }
    return true;
}
