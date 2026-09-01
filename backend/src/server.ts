import "dotenv/config";

import express from "express";
import cors from "cors";
import session from "express-session";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import emailRoutes from "./routes/email.routes";
import authRoutes from "./routes/auth.routes";
import slackRoutes from "./routes/slack.routes";
import { ensureEmailIndex } from "./lib/elasticsearch";
import { emailQueue } from "./queue/email.queue";
import { requireAuth } from "./middleware/auth";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "reachinbox-local-secret",

    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "reachinbox-backend",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/slack", slackRoutes);

// ------------------------------------
// Live BullMQ dashboard
//
// Requires an authenticated session, same as the rest of the
// API — real-time queue visibility, but not a public endpoint.
// ------------------------------------

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

app.use(
  "/admin/queues",
  requireAuth,
  serverAdapter.getRouter()
);

const PORT = Number(
  process.env.PORT || 5000
);

app.listen(PORT, async () => {
  console.log(
    `Backend running on port ${PORT}`
  );

  await ensureEmailIndex();
});