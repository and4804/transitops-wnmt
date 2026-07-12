import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireField, requireEnum } from "../lib/validate";
import { conflict, unauthorized, locked } from "../lib/errors";
import { signToken } from "../middleware/auth";

const router = Router();

const ROLES = ["FleetManager", "Dispatcher", "SafetyOfficer", "FinancialAnalyst"] as const;
const LOCKOUT_THRESHOLD = 5;

function toAuthResponse(user: { id: number; name: string; email: string; role: string }, token: string) {
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const name = requireField(req.body, "name");
    const email = requireField(req.body, "email");
    const password = requireField(req.body, "password");
    const role = requireEnum(req.body, "role", ROLES);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw conflict(`An account with email ${email} already exists`);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json(toAuthResponse(user, token));
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = requireField(req.body, "email");
    const password = requireField(req.body, "password");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw unauthorized("Invalid credentials");
    }

    if (user.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
      throw locked("Invalid credentials. Account locked after 5 failed attempts.");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lockedAt: attempts >= LOCKOUT_THRESHOLD ? new Date() : null },
      });
      if (attempts >= LOCKOUT_THRESHOLD) {
        throw locked("Invalid credentials. Account locked after 5 failed attempts.");
      }
      throw unauthorized("Invalid credentials");
    }

    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedAt: null } });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(200).json(toAuthResponse(user, token));
  })
);

export default router;
