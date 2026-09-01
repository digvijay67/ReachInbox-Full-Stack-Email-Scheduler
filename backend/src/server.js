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
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const api_1 = require("@bull-board/api");
const bullMQAdapter_1 = require("@bull-board/api/bullMQAdapter");
const express_2 = require("@bull-board/express");
const email_routes_1 = __importDefault(require("./routes/email.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const slack_routes_1 = __importDefault(require("./routes/slack.routes"));
const elasticsearch_1 = require("./lib/elasticsearch");
const email_queue_1 = require("./queue/email.queue");
const auth_1 = require("./middleware/auth");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "http://localhost:5173",
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET ||
        "reachinbox-local-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
    },
}));
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "reachinbox-backend",
    });
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api/emails", email_routes_1.default);
app.use("/api/slack", slack_routes_1.default);
// ------------------------------------
// Live BullMQ dashboard
//
// Requires an authenticated session, same as the rest of the
// API — real-time queue visibility, but not a public endpoint.
// ------------------------------------
const serverAdapter = new express_2.ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
(0, api_1.createBullBoard)({
    queues: [new bullMQAdapter_1.BullMQAdapter(email_queue_1.emailQueue)],
    serverAdapter,
});
app.use("/admin/queues", auth_1.requireAuth, serverAdapter.getRouter());
const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Backend running on port ${PORT}`);
    yield (0, elasticsearch_1.ensureEmailIndex)();
}));
