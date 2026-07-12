import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { unauthorized, forbidden } from "../lib/errors";

const JWT_SECRET = process.env.JWT_SECRET || "transitops-dev-secret-change-me";

export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "12h" });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw unauthorized("Missing or invalid Authorization header");
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    throw unauthorized("Invalid or expired token");
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized("Missing or invalid Authorization header");
    if (!roles.includes(req.user.role)) {
      throw forbidden(`Role ${req.user.role} is not permitted to perform this action`);
    }
    next();
  };
}
