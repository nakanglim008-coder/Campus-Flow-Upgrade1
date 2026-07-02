import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { users } from "@workspace/db/schema";
import { getDb } from "../lib/db";
import {
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  type JwtPayload,
} from "../lib/auth";
import type { Request } from "express";

const router = Router();

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(120),
  role: z.enum(["student", "admin", "security"]),
  inviteToken: z.string().max(128).optional(),
  matric: z.string().trim().max(50).optional(),
  hostel: z.string().trim().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }
  const data = parsed.data;

  if (data.role === "admin") {
    const expected = process.env.ADMIN_INVITE_TOKEN;
    if (!expected || data.inviteToken !== expected) {
      res.status(403).json({ error: "Invalid admin invite token" });
      return;
    }
  }
  if (data.role === "security") {
    const expected = process.env.SECURITY_INVITE_TOKEN;
    if (!expected || data.inviteToken !== expected) {
      res.status(403).json({ error: "Invalid security invite token" });
      return;
    }
  }
  if (data.role === "student" && (!data.matric || !data.hostel)) {
    res.status(400).json({ error: "Matric number and hostel are required for students" });
    return;
  }

  const db = getDb();
  const email = data.email.toLowerCase().trim();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Email is already registered" });
    return;
  }

  const passwordHash = await hashPassword(data.password);
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: data.name,
      role: data.role,
      matric: data.role === "student" ? data.matric! : null,
      hostel: data.role === "student" ? data.hostel! : null,
    })
    .returning();

  const token = signToken({ userId: user.id, role: user.role, name: user.name });
  setAuthCookie(res, token);
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, matric: user.matric, hostel: user.hostel });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;
  const db = getDb();
  const normalEmail = email.toLowerCase().trim();
  const [user] = await db.select().from(users).where(eq(users.email, normalEmail)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role, name: user.name });
  setAuthCookie(res, token);
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, matric: user.matric, hostel: user.hostel });
});

router.get("/me", requireAuth, async (req, res) => {
  const { userId } = (req as Request & { user: JwtPayload }).user;
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    clearAuthCookie(res);
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, matric: user.matric, hostel: user.hostel });
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
