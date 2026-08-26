import "dotenv/config";

import express from "express";
import cors from "cors";
import session from "express-session";

import emailRoutes from "./routes/email.routes";
import authRoutes from "./routes/auth.routes";

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

const PORT = Number(
  process.env.PORT || 5000
);

app.listen(PORT, () => {
  console.log(
    `Backend running on port ${PORT}`
  );
});

