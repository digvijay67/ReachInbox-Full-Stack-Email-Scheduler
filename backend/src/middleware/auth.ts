import {
  Request,
  Response,
  NextFunction,
} from "express";

import { prisma } from "../lib/prisma";

export interface AuthenticatedRequest
  extends Request {
  user?: {
    id: number;
    googleId: string;
    email: string;
  };

  sender?: {
    id: number;
    email: string;
    userId: number;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Please login with Google first",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      req.session.destroy(() => {});

      return res.status(401).json({
        message: "User session is invalid",
      });
    }

    const sender =
      await prisma.sender.findFirst({
        where: {
          userId: user.id,
        },
      });

    if (!sender) {
      return res.status(403).json({
        message:
          "Google sender is not connected",
      });
    }

    req.user = {
      id: user.id,
      googleId: user.googleId,
      email: user.email,
    };

    req.sender = {
      id: sender.id,
      email: sender.email,
      userId: sender.userId,
    };

    next();
  } catch (error) {
    console.error(
      "Authentication error:",
      error
    );

    return res.status(500).json({
      message: "Authentication failed",
    });
  }
}