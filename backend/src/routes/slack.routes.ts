import { Router } from "express";

import { prisma } from "../lib/prisma";
import {
  buildSlackAuthorizeUrl,
  exchangeSlackCode,
  disconnectSlack,
} from "../lib/slack";
import {
  requireAuth,
  AuthenticatedRequest,
} from "../middleware/auth";

const router = Router();

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

// ------------------------------------
// GET CURRENT SLACK CONNECTION STATUS
// ------------------------------------

router.get(
  "/status",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    const integration =
      await prisma.slackIntegration.findUnique(
        {
          where: {
            userId: req.user!.id,
          },
        }
      );

    return res.json({
      connected: Boolean(integration),
      teamName: integration?.teamName || null,
      channel: integration?.channel || null,
    });
  }
);

// ------------------------------------
// START OAUTH FLOW
// ------------------------------------

router.get(
  "/connect",
  requireAuth,
  (req: AuthenticatedRequest, res) => {
    const url = buildSlackAuthorizeUrl(
      req.user!.id
    );

    return res.redirect(url);
  }
);

// ------------------------------------
// OAUTH CALLBACK
// ------------------------------------

router.get(
  "/callback",
  async (req, res) => {
    try {
      const code =
        typeof req.query.code === "string"
          ? req.query.code
          : null;

      const state =
        typeof req.query.state === "string"
          ? req.query.state
          : null;

      if (!code || !state) {
        return res.redirect(
          `${FRONTEND_URL}/dashboard?slack=error`
        );
      }

      const userId = Number(state);

      if (Number.isNaN(userId)) {
        return res.redirect(
          `${FRONTEND_URL}/dashboard?slack=error`
        );
      }

      await exchangeSlackCode(code, userId);

      return res.redirect(
        `${FRONTEND_URL}/dashboard?slack=connected`
      );
    } catch (error) {
      console.error(
        "Slack OAuth callback error:",
        error
      );

      return res.redirect(
        `${FRONTEND_URL}/dashboard?slack=error`
      );
    }
  }
);

// ------------------------------------
// DISCONNECT
// ------------------------------------

router.post(
  "/disconnect",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res
  ) => {
    await disconnectSlack(req.user!.id);

    return res.json({
      message: "Slack disconnected",
    });
  }
);

export default router;