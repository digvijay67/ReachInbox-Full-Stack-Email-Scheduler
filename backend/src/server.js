"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const email_routes_1 = __importDefault(require("./routes/email.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "reachinbox-backend",
    });
});
app.use("/api/emails", email_routes_1.default);
app.use("/auth", auth_routes_1.default);
const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
