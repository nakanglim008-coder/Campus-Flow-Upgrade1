import type { Context } from "@netlify/functions";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, or, and, inArray, isNull, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import webpush from "web-push";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { users, exeatRequests, notifications, pushSubscriptions, webauthnCredentials, inviteLinks } from "./_db/schema";

type Role = "student" | "admin" | "security" | "porter";
type JwtPayload = { userId: string; role: Role; name: string; hostel: string | null };

function getDb() {
  const url = process.env.DATABASE_URL!;
  return drizzle(neon(url), {
    schema: { users, exeatRequests, notifications, pushSubscriptions, webauthnCredentials, inviteLinks },
  });
}

function makeInviteToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function buildInviteUrl(req: Request, token: string, role: string) {
  const origin = new URL(req.url).origin;
  return `${origin}/invite/${role}/${token}`;
}

function getSecret() {
  return process.env.SESSION_SECRET!;
}

function setupWebPush() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@campus.edu",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
}

const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

function signToken(payload: JwtPayload) {
  return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

function makeCode() {
  const ts = Date.now().toString(36).toUpperCase().slice(-5);
  const rnd = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `PP-${ts}${rnd}`;
}

function parseCookies(header: string | null) {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (k) out[k.trim()] = decodeURIComponent(rest.join("="));
  });
  return out;
}

function cookieHeader(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
}

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

async function getUser(req: Request): Promise<JwtPayload | null> {
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies["pulsepass_token"];
  if (!token) return null;
  return verifyToken(token);
}

async function notify(
  db: ReturnType<typeof getDb>,
  userId: string,
  type: string,
  title: string,
  body: string,
  exeatId?: string
) {
  try {
    await db.insert(notifications).values({ userId, type, title, body, exeatId });
  } catch {}

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  try {
    setupWebPush();
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    const pushPayload = JSON.stringify({ title, body, url: exeatId ? `/exeats/${exeatId}` : "/" });
    await Promise.allSettled(subs.map(s =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        pushPayload
      ).catch(async (err: any) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
        }
      })
    ));
  } catch {}
}

const rpName = "Campus Flow";
const rpID = process.env.WEBAUTHN_RP_ID || "campus-flow.netlify.app";
const origin = process.env.WEBAUTHN_ORIGIN || `https://${rpID}`;

export default async function handler(req: Request, ctx: Context) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "").replace(/^\/\.netlify\/functions\/api/, "");
  const method = req.method.toUpperCase();

  try {
    // Auth routes
    // Public invite validate (no auth needed)
    if (path.startsWith("/invite/validate/") && method === "GET") {
      const token = path.split("/")[3];
      if (!token) return json({ valid: false }, 200);
      const db = getDb();
      const [link] = await db.select().from(inviteLinks).where(eq(inviteLinks.token, token)).limit(1);
      if (!link) return json({ valid: false }, 200);
      if (link.usedAt) return json({ valid: false, reason: "already_used" }, 200);
      if (link.expiresAt < new Date()) return json({ valid: false, reason: "expired" }, 200);
      return json({ valid: true, role: link.role, note: link.note });
    }

    if (path === "/auth/signup" && method === "POST") {
      const body = await req.json();
      const { email, password, name, role, inviteToken, matric, hostel, room } = body;
      if (!email || !password || !name || !role) return json({ error: "Missing fields" }, 400);

      // Admin: allow env-var bootstrap OR DB invite
      if (role === "admin") {
        const envToken = process.env.ADMIN_INVITE_TOKEN;
        if (envToken && inviteToken === envToken) {
          // env-var bootstrap OK
        } else if (inviteToken) {
          const db2 = getDb();
          const [link] = await db2.select().from(inviteLinks).where(eq(inviteLinks.token, inviteToken)).limit(1);
          if (!link || link.role !== "admin" || link.usedAt || link.expiresAt < new Date()) {
            return json({ error: "Invalid or expired invite link" }, 403);
          }
        } else {
          return json({ error: "Admin accounts require an invite link" }, 403);
        }
      }

      // Security and porter: must use DB invite
      if (role === "security" || role === "porter") {
        if (!inviteToken) return json({ error: "An invite link is required for this role" }, 403);
        const db2 = getDb();
        const [link] = await db2.select().from(inviteLinks).where(eq(inviteLinks.token, inviteToken)).limit(1);
        if (!link || link.role !== role || link.usedAt || link.expiresAt < new Date()) {
          return json({ error: "Invalid or expired invite link" }, 403);
        }
      }

      if (role === "student" && (!matric || !hostel)) return json({ error: "Matric and hostel required" }, 400);
      if (role === "porter" && !hostel) return json({ error: "Hostel required for porter accounts" }, 400);

      const db = getDb();
      const norm = email.toLowerCase().trim();
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, norm)).limit(1);
      if (existing.length) return json({ error: "Email already registered" }, 409);

      const passwordHash = await hashPassword(password);
      const [user] = await db.insert(users).values({
        email: norm,
        passwordHash,
        name,
        role,
        matric: role === "student" ? matric : null,
        hostel: (role === "student" || role === "porter") ? hostel : null,
        room: role === "student" ? (room || null) : null,
      }).returning();

      // Mark invite as used for non-student roles (when using a DB invite)
      if ((role === "security" || role === "porter") && inviteToken) {
        await db.update(inviteLinks).set({ usedAt: new Date(), usedBy: user.id }).where(eq(inviteLinks.token, inviteToken));
      }
      if (role === "admin" && inviteToken && inviteToken !== process.env.ADMIN_INVITE_TOKEN) {
        await db.update(inviteLinks).set({ usedAt: new Date(), usedBy: user.id }).where(eq(inviteLinks.token, inviteToken));
      }

      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      for (const admin of admins) {
        if (admin.id === user.id) continue;
        await notify(db, admin.id, "new_signup", "New account registered", `${user.name} registered as ${user.role}.`);
      }

      const token = signToken({ userId: user.id, role: user.role, name: user.name, hostel: user.hostel ?? null });
      return json({ id: user.id, email: user.email, name: user.name, role: user.role, matric: user.matric, hostel: user.hostel, room: user.room }, 200, {
        "Set-Cookie": cookieHeader("pulsepass_token", token, 30 * 24 * 3600),
      });
    }

    if (path === "/auth/login" && method === "POST") {
      const body = await req.json();
      const db = getDb();
      const norm = (body.email ?? "").toLowerCase().trim();
      const [user] = await db.select().from(users).where(eq(users.email, norm)).limit(1);
      if (!user) return json({ error: "Invalid email or password" }, 401);
      const ok = await verifyPassword(body.password ?? "", user.passwordHash);
      if (!ok) return json({ error: "Invalid email or password" }, 401);
      const token = signToken({ userId: user.id, role: user.role, name: user.name, hostel: user.hostel ?? null });
      return json({ id: user.id, email: user.email, name: user.name, role: user.role, matric: user.matric, hostel: user.hostel, room: user.room }, 200, {
        "Set-Cookie": cookieHeader("pulsepass_token", token, 30 * 24 * 3600),
      });
    }

    if (path === "/auth/me" && method === "GET") {
      const payload = await getUser(req);
      if (!payload) return json({ error: "Not authenticated" }, 401);
      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (!user) return json({ error: "User not found" }, 401);
      return json({ id: user.id, email: user.email, name: user.name, role: user.role, matric: user.matric, hostel: user.hostel, room: user.room });
    }

    if (path === "/auth/logout" && method === "POST") {
      return json({ ok: true }, 200, {
        "Set-Cookie": "pulsepass_token=; Path=/; HttpOnly; Max-Age=0",
      });
    }

    // Porter login (no auth required before this)
    if (path === "/porter/login" && method === "POST") {
      const body = await req.json();
      const db = getDb();
      const norm = (body.email ?? "").toLowerCase().trim();
      const [user] = await db.select().from(users).where(and(eq(users.email, norm), eq(users.role, "porter"))).limit(1);
      if (!user) return json({ error: "Invalid email or password" }, 401);
      const ok = await verifyPassword(body.password ?? "", user.passwordHash);
      if (!ok) return json({ error: "Invalid email or password" }, 401);
      const token = signToken({ userId: user.id, role: user.role, name: user.name, hostel: user.hostel ?? null });
      return json({ id: user.id, email: user.email, name: user.name, role: user.role, hostel: user.hostel, room: user.room }, 200, {
        "Set-Cookie": cookieHeader("pulsepass_token", token, 30 * 24 * 3600),
      });
    }

    // WebAuthn login (no auth required)
    if (path === "/webauthn/login/options" && method === "POST") {
      const { email } = await req.json();
      if (!email) return json({ error: "Email required" }, 400);
      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
      if (!user) return json({ error: "User not found" }, 404);
      const creds = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id));
      if (!creds.length) return json({ error: "No biometric registered" }, 404);
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: creds.map(c => ({ id: c.id, transports: c.transports ? JSON.parse(c.transports) : undefined })),
        userVerification: "preferred",
      });
      return json({ ...options, userId: user.id, challenge: options.challenge });
    }

    if (path === "/webauthn/login/verify" && method === "POST") {
      const { credential, challenge, userId } = await req.json();
      const db = getDb();
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return json({ error: "User not found" }, 404);
      const creds = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
      const cred = creds.find(c => c.id === credential.id);
      if (!cred) return json({ error: "Credential not found" }, 404);
      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.id,
          publicKey: Buffer.from(cred.publicKey, "base64"),
          counter: Number(cred.counter),
        },
      });
      if (verification.verified) {
        await db.update(webauthnCredentials).set({ counter: String(verification.authenticationInfo.newCounter) }).where(eq(webauthnCredentials.id, cred.id));
        const token = signToken({ userId: user.id, role: user.role, name: user.name, hostel: user.hostel ?? null });
        return json({ verified: true }, 200, {
          "Set-Cookie": cookieHeader("pulsepass_token", token, 30 * 24 * 3600),
        });
      }
      return json({ verified: false }, 400);
    }

    // All routes below require auth
    const payload = await getUser(req);
    if (!payload) return json({ error: "Not authenticated" }, 401);
    const db = getDb();

    function toDTO(row: { exeat_requests: typeof exeatRequests.$inferSelect; users: typeof users.$inferSelect | null }) {
      const e = row.exeat_requests;
      return {
        id: e.id,
        code: e.code,
        studentId: e.studentId,
        studentName: row.users?.name ?? "Unknown",
        matric: row.users?.matric,
        hostel: row.users?.hostel,
        room: row.users?.room,
        destination: e.destination,
        reason: e.reason,
        type: e.type,
        departDate: e.departDate,
        returnDate: e.returnDate,
        status: e.status,
        rejectReason: e.rejectReason,
        hostelCheckedOutBy: e.hostelCheckedOutBy,
        hostelCheckedOutAt: e.hostelCheckedOutAt?.toISOString() ?? null,
        hostelCheckedInBy: e.hostelCheckedInBy,
        hostelCheckedInAt: e.hostelCheckedInAt?.toISOString() ?? null,
        gateScannedOutBy: e.gateScannedOutBy,
        gateScannedOutAt: e.gateScannedOutAt?.toISOString() ?? null,
        gateScannedInBy: e.gateScannedInBy,
        gateScannedInAt: e.gateScannedInAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      };
    }

    // --- EXEAT ROUTES ---

    if (path === "/exeats/my" && method === "GET") {
      if (payload.role !== "student") return json({ error: "Forbidden" }, 403);
      const rows = await db.select().from(exeatRequests).leftJoin(users, eq(exeatRequests.studentId, users.id)).where(eq(exeatRequests.studentId, payload.userId)).orderBy(desc(exeatRequests.createdAt));
      return json(rows.map(toDTO));
    }

    if (path === "/exeats" && method === "POST") {
      if (payload.role !== "student") return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { destination, reason, type, departDate, returnDate } = body;
      const [studentRow] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      const [created] = await db.insert(exeatRequests).values({
        code: makeCode(),
        studentId: payload.userId,
        destination,
        reason,
        type,
        departDate,
        returnDate,
        status: type === "emergency" ? "approved" : "pending",
      }).returning();

      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      for (const admin of admins) {
        await notify(db, admin.id, "new_exeat", "New Exeat Request", `${payload.name} submitted a new exeat request to ${destination}.`, created.id);
      }

      return json(toDTO({ exeat_requests: created, users: studentRow }), 201);
    }

    if (path === "/exeats/all" && method === "GET") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const rows = await db.select().from(exeatRequests).leftJoin(users, eq(exeatRequests.studentId, users.id)).orderBy(desc(exeatRequests.createdAt));
      return json(rows.map(toDTO));
    }

    if (path === "/exeats/review" && method === "PATCH") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const [updated] = await db.update(exeatRequests).set({
        status: body.status,
        rejectReason: body.status === "rejected" ? (body.rejectReason ?? "No reason given") : null,
        reviewedBy: payload.userId,
        updatedAt: new Date(),
      }).where(eq(exeatRequests.id, body.id)).returning();

      if (updated) {
        const [student] = await db.select({ id: users.id }).from(users).where(eq(users.id, updated.studentId)).limit(1);
        if (student) {
          if (body.status === "approved") {
            await notify(db, student.id, "exeat_approved", "Exeat Approved", "Your exeat request has been approved. You may proceed.", body.id);
          } else if (body.status === "rejected") {
            await notify(db, student.id, "exeat_rejected", "Exeat Rejected", `Your exeat request was rejected. Reason: ${body.rejectReason ?? "No reason given"}`, body.id);
          }
        }
      }

      return json({ ok: true });
    }

    if (path === "/exeats/active" && method === "GET") {
      if (payload.role !== "security") return json({ error: "Forbidden" }, 403);
      const rows = await db.select().from(exeatRequests).leftJoin(users, eq(exeatRequests.studentId, users.id)).where(
        or(
          eq(exeatRequests.status, "hostel_checked_out"),
          eq(exeatRequests.status, "departed"),
          eq(exeatRequests.status, "returned"),
        )
      ).orderBy(desc(exeatRequests.updatedAt));
      return json(rows.map(toDTO));
    }

    if (path === "/exeats/scan" && method === "POST") {
      if (payload.role !== "security") return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const code = (body.code ?? "").trim().toUpperCase();
      const [found] = await db.select().from(exeatRequests).leftJoin(users, eq(exeatRequests.studentId, users.id)).where(eq(exeatRequests.code, code)).limit(1);
      if (!found) return json({ kind: "invalid", message: "Pass not recognized." });
      const e = found.exeat_requests;

      if (e.status === "approved") {
        return json({ kind: "not_checked_out_of_hostel", message: "Student has not checked out of hostel yet." });
      }

      if (e.status === "hostel_checked_out") {
        await db.update(exeatRequests).set({
          status: "departed",
          gateScannedOutBy: payload.userId,
          gateScannedOutAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(exeatRequests.id, e.id));
        await notify(db, e.studentId, "gate_out", "Gate Departure", `You have been cleared to depart. Destination: ${e.destination}`, e.id);
        return json({ kind: "valid-out", message: `${found.users?.name ?? "Student"} cleared to depart.`, studentName: found.users?.name, destination: e.destination, returnDate: e.returnDate });
      }

      if (e.status === "departed") {
        await db.update(exeatRequests).set({
          status: "returned",
          gateScannedInBy: payload.userId,
          gateScannedInAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(exeatRequests.id, e.id));
        await notify(db, e.studentId, "gate_in", "Returned to Campus", "You have returned to campus. Please check in at your hostel.", e.id);
        return json({ kind: "valid-in", message: `${found.users?.name ?? "Student"} returned to campus. Student must now check in at hostel.` });
      }

      return json({ kind: "expired", message: `Pass status: ${e.status}. Cannot scan.` });
    }

    if (path.startsWith("/exeats/details/") && method === "GET") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const exeatId = path.split("/")[3];
      const [row] = await db.select().from(exeatRequests).leftJoin(users, eq(exeatRequests.studentId, users.id)).where(eq(exeatRequests.id, exeatId)).limit(1);
      if (!row) return json({ error: "Not found" }, 404);

      const actorIds = [
        row.exeat_requests.hostelCheckedOutBy,
        row.exeat_requests.hostelCheckedInBy,
        row.exeat_requests.gateScannedOutBy,
        row.exeat_requests.gateScannedInBy,
      ].filter(Boolean) as string[];

      const actors = actorIds.length
        ? await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, actorIds))
        : [];
      const actorMap = Object.fromEntries(actors.map(a => [a.id, a]));

      return json({
        ...toDTO(row),
        hostelCheckedOutByName: row.exeat_requests.hostelCheckedOutBy ? actorMap[row.exeat_requests.hostelCheckedOutBy]?.name ?? null : null,
        hostelCheckedInByName: row.exeat_requests.hostelCheckedInBy ? actorMap[row.exeat_requests.hostelCheckedInBy]?.name ?? null : null,
        gateScannedOutByName: row.exeat_requests.gateScannedOutBy ? actorMap[row.exeat_requests.gateScannedOutBy]?.name ?? null : null,
        gateScannedInByName: row.exeat_requests.gateScannedInBy ? actorMap[row.exeat_requests.gateScannedInBy]?.name ?? null : null,
      });
    }

    // --- PORTER ROUTES ---

    if (path === "/porters/create" && method === "POST") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { email, password, name, hostel } = body;
      if (!email || !password || !name || !hostel) return json({ error: "Missing fields" }, 400);

      const norm = email.toLowerCase().trim();
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, norm)).limit(1);
      if (existing.length) return json({ error: "Email already registered" }, 409);

      const passwordHash = await hashPassword(password);
      const [porter] = await db.insert(users).values({
        email: norm,
        passwordHash,
        name,
        role: "porter",
        hostel,
      }).returning();

      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      for (const admin of admins) {
        await notify(db, admin.id, "new_porter", "Porter Created", `Porter ${porter.name} has been assigned to ${porter.hostel}.`);
      }

      return json({ id: porter.id, email: porter.email, name: porter.name, role: porter.role, hostel: porter.hostel }, 201);
    }

    if (path === "/porters" && method === "GET") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const porters = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        hostel: users.hostel,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.role, "porter")).orderBy(desc(users.createdAt));
      return json(porters);
    }

    if (path.startsWith("/porters/") && method === "DELETE" && !path.includes("scan")) {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const porterId = path.split("/")[2];
      await db.delete(users).where(and(eq(users.id, porterId), eq(users.role, "porter")));
      return json({ ok: true });
    }

    // --- SECURITY ROUTES ---

    if (path === "/security/create" && method === "POST") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { email, password, name } = body;
      if (!email || !password || !name) return json({ error: "Missing fields" }, 400);

      const norm = email.toLowerCase().trim();
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, norm)).limit(1);
      if (existing.length) return json({ error: "Email already registered" }, 409);

      const passwordHash = await hashPassword(password);
      const [officer] = await db.insert(users).values({
        email: norm,
        passwordHash,
        name,
        role: "security",
      }).returning();

      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      for (const admin of admins) {
        await notify(db, admin.id, "new_security", "Security Officer Created", `Security officer ${officer.name} has been created.`);
      }

      return json({ id: officer.id, email: officer.email, name: officer.name, role: officer.role }, 201);
    }

    if (path === "/security" && method === "GET") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const officers = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.role, "security")).orderBy(desc(users.createdAt));
      return json(officers);
    }

    if (path.startsWith("/security/") && method === "DELETE") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const officerId = path.split("/")[2];
      await db.delete(users).where(and(eq(users.id, officerId), eq(users.role, "security")));
      return json({ ok: true });
    }

    if (path === "/porters/scan" && method === "POST") {
      if (payload.role !== "porter") return json({ error: "Forbidden" }, 403);
      if (!payload.hostel) return json({ error: "Porter has no hostel assigned" }, 400);

      const body = await req.json();
      const code = (body.code ?? "").trim().toUpperCase();

      const [found] = await db.select().from(exeatRequests).leftJoin(users, eq(exeatRequests.studentId, users.id)).where(eq(exeatRequests.code, code)).limit(1);
      if (!found) return json({ kind: "invalid", message: "Pass not recognized." });

      const e = found.exeat_requests;
      const student = found.users;

      if (student?.hostel !== payload.hostel) {
        return json({ kind: "wrong_hostel", message: `Student is from ${student?.hostel ?? "unknown hostel"}, not yours.` });
      }

      if (e.status === "approved") {
        await db.update(exeatRequests).set({
          status: "hostel_checked_out",
          hostelCheckedOutBy: payload.userId,
          hostelCheckedOutAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(exeatRequests.id, e.id));
        await notify(db, e.studentId, "hostel_out", "Hostel Check-Out", `You have been checked out of ${payload.hostel}. Proceed to the gate.`, e.id);
        return json({ kind: "hostel-out", message: `${student?.name ?? "Student"} checked out of hostel.`, studentName: student?.name, destination: e.destination });
      }

      if (e.status === "returned") {
        await db.update(exeatRequests).set({
          status: "hostel_returned",
          hostelCheckedInBy: payload.userId,
          hostelCheckedInAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(exeatRequests.id, e.id));
        await notify(db, e.studentId, "hostel_in", "Hostel Check-In Complete", `You have been checked in at ${payload.hostel}. Welcome back!`, e.id);
        return json({ kind: "hostel-in", message: `${student?.name ?? "Student"} checked in at hostel.` });
      }

      return json({ kind: "invalid_state", message: `Cannot scan at hostel when status is "${e.status}".` });
    }

    // --- NOTIFICATION ROUTES ---

    if (path === "/notifications" && method === "GET") {
      const rows = await db.select().from(notifications)
        .where(eq(notifications.userId, payload.userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      return json(rows.map(n => ({ ...n, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null })));
    }

    if (path === "/notifications/read-all" && method === "POST") {
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, payload.userId), isNull(notifications.readAt)));
      return json({ ok: true });
    }

    if (path.startsWith("/notifications/") && path.endsWith("/read") && method === "POST") {
      const notifId = path.split("/")[2];
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notifId), eq(notifications.userId, payload.userId)));
      return json({ ok: true });
    }

    // --- PUSH SUBSCRIPTION ROUTES ---

    if (path === "/push/subscribe" && method === "POST") {
      const subscription = await req.json();
      await db.insert(pushSubscriptions).values({
        userId: payload.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }).onConflictDoNothing();
      return json({ ok: true });
    }

    if (path === "/push/unsubscribe" && method === "POST") {
      const { endpoint } = await req.json();
      await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, payload.userId), eq(pushSubscriptions.endpoint, endpoint)));
      return json({ ok: true });
    }

    if (path === "/push/vapid-key" && method === "GET") {
      return json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
    }

    // --- WEBAUTHN ROUTES ---

    if (path === "/webauthn/register/options" && method === "POST") {
      const existing = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, payload.userId));
      const [userRow] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new TextEncoder().encode(payload.userId),
        userName: userRow?.email ?? payload.userId,
        excludeCredentials: existing.map(c => ({ id: c.id, transports: c.transports ? JSON.parse(c.transports) : undefined })),
        authenticatorSelection: { userVerification: "preferred", residentKey: "preferred" },
      });
      return json({ ...options, challenge: options.challenge });
    }

    if (path === "/webauthn/register/verify" && method === "POST") {
      const { credential, challenge } = await req.json();
      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
      if (verification.verified && verification.registrationInfo) {
        const { credential: cred } = verification.registrationInfo;
        await db.insert(webauthnCredentials).values({
          id: cred.id,
          userId: payload.userId,
          publicKey: Buffer.from(cred.publicKey).toString("base64"),
          counter: String(cred.counter),
          transports: credential.response?.transports ? JSON.stringify(credential.response.transports) : null,
        });
        return json({ verified: true });
      }
      return json({ verified: false }, 400);
    }

    // --- INVITE LINK ROUTES (admin only) ---

    if (path === "/admin/invites" && method === "GET") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const links = await db.select().from(inviteLinks).orderBy(desc(inviteLinks.createdAt)).limit(100);
      return json(links.map(l => ({
        id: l.id,
        token: l.token,
        role: l.role,
        note: l.note,
        url: buildInviteUrl(req, l.token, l.role),
        expiresAt: l.expiresAt.toISOString(),
        usedAt: l.usedAt?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
      })));
    }

    if (path === "/admin/invites" && method === "POST") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { role: invRole, note, expiresHours = 48 } = body;
      if (!invRole || !["admin", "security", "porter"].includes(invRole)) return json({ error: "Invalid role" }, 400);
      const token = makeInviteToken();
      const expiresAt = new Date(Date.now() + Number(expiresHours) * 60 * 60 * 1000);
      const [link] = await db.insert(inviteLinks).values({
        token,
        role: invRole,
        note: note || null,
        createdBy: payload.userId,
        expiresAt,
      }).returning();
      return json({
        id: link.id,
        token: link.token,
        role: link.role,
        note: link.note,
        url: buildInviteUrl(req, link.token, link.role),
        expiresAt: link.expiresAt.toISOString(),
        usedAt: null,
        createdAt: link.createdAt.toISOString(),
      }, 201);
    }

    if (path.startsWith("/admin/invites/") && method === "DELETE") {
      if (payload.role !== "admin") return json({ error: "Forbidden" }, 403);
      const inviteId = path.split("/")[3];
      await db.delete(inviteLinks).where(and(eq(inviteLinks.id, inviteId), eq(inviteLinks.createdBy, payload.userId)));
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Internal server error" }, 500);
  }
}

export const config = { path: "/api/*" };
