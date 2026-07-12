import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireField, requireEnum } from "../lib/validate";
import { badRequest, conflict, forbidden, unauthorized, locked } from "../lib/errors";
import { requireAuth, requireRole, signToken } from "../middleware/auth";

const router = Router();

const ROLES = ["FleetManager", "Dispatcher", "SafetyOfficer", "FinancialAnalyst"] as const;
const LOCKOUT_THRESHOLD = 5;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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

router.post(
  "/google",
  asyncHandler(async (req, res) => {
    const credential = requireField(req.body, "credential");
    if (!googleClient) {
      throw badRequest("Google sign-in is not configured on this server (missing GOOGLE_CLIENT_ID)");
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch {
      throw unauthorized("Invalid Google credential");
    }
    if (!payload?.email || !payload.email_verified || !payload.sub) {
      throw unauthorized("Google account has no verified email");
    }

    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      throw forbidden(`No TransitOps account for ${payload.email}. Ask a Fleet Manager to invite you first.`);
    }
    if (user.googleId && user.googleId !== payload.sub) {
      throw forbidden("This account is linked to a different Google identity");
    }
    if (!user.googleId) {
      await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.status(200).json(toAuthResponse(user, token));
  })
);

router.post(
  "/invite",
  requireAuth,
  requireRole("FleetManager"),
  asyncHandler(async (req, res) => {
    const name = requireField(req.body, "name");
    const email = requireField(req.body, "email");
    const role = requireEnum(req.body, "role", ROLES);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw conflict(`An account with email ${email} already exists`);
    }

    // No password is issued for an invite — the invitee signs in with Google,
    // which links to this row on first successful login. Password login stays
    // unusable (bcrypt hash of a random value) unless a real password is set later.
    const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash: placeholderHash, role },
    });

    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  })
);

export default router;
