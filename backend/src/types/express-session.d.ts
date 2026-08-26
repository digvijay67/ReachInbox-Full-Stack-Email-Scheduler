
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    senderId?: number;
  }
}

// import { Request, Response, NextFunction } from "express";
// import { prisma } from "../lib/prisma";

// export interface AuthenticatedRequest extends Request {
//   user?: {
//     id: number;
//     googleId: string;
//     name: string;
//     email: string;
//     avatar: string | null;
//   };
// }

// export async function requireAuth(
//   req: AuthenticatedRequest,
//   res: Response,
//   next: NextFunction
// ) {
//   try {
//     const userId = req.session?.userId;

//     if (!userId) {
//       return res.status(401).json({
//         message: "Authentication required",
//       });
//     }

//     const user = await prisma.user.findUnique({
//       where: {
//         id: userId,
//       },
//     });

//     if (!user) {
//       req.session.destroy(() => {});

//       return res.status(401).json({
//         message: "User not found",
//       });
//     }

//     req.user = user;

//     next();
//   } catch (error) {
//     console.error("Auth middleware error:", error);

//     return res.status(500).json({
//       message: "Authentication failed",
//     });
//   }
// }