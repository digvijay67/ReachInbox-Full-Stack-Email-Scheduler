import { User } from "../generated";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};