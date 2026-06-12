import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

export type JwtPayload = {
  userId: string;
  role: "student" | "admin" | "security";
  name: string;
};

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET not set");
  return s;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie("pulsepass_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie("pulsepass_token", { path: "/" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.pulsepass_token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }
  (req as Request & { user: JwtPayload }).user = payload;
  next();
}

export function requireRole(...roles: Array<"student" | "admin" | "security">) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: JwtPayload }).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function makeExeatCode(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  const rnd = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `PP-${ts}${rnd}`;
}
