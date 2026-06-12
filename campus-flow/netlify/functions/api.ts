import type { Context } from "@netlify/functions";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, or, and, inArray, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import webpush from "web-push";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { users, exeatRequests, notifications, pushSubscriptions, webauthnCredentials } from "./_db/schema";

type Role = "student" | "admin" | "security" | "porter";
type JwtPayload = { userId: string; role: Role; name: string; hostel: string | null };

function getDb() {
  const url = process.env.DATABASE_URL!;
  return drizzle(neon(url), {
    schema: { users, exeatRequests, notifications, pushSubscriptions, webauthnCredentials },
  });
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
    if (path === "/auth/signup" && method === "POST") {
      const body = await req.json();
      const { email, password, name, role, inviteToken, matric, hostel, room } = body;
      if (!email || !password || !name || !role) return json({ error: "Missing fields" }, 400);
      if (role === "admin" && inviteToken !== process.env.ADMIN_INVITE_TOKEN) return json({ error: "Invalid admin invite token" }, 403);
      if (role === "security" && inviteToken !== process.env.SECURITY_INVITE_TOKEN) return json({ error: "Invalid security invite token" }, 403);
      if (role === "student" && (!matric || !hostel)) return json({ error: "Matric and hostel required" }, 400);

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
        hostel: role === "student" ? hostel : null,
        room: role === "student" ? (room || null) : null,
      }).returning();

      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      for (const admin of admins) {
        await notify(db, admin.id, "new_signup", "New student registered", `${user.name} (${user.matric}) has registered.`);
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

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: "Internal server error" }, 500);
  }
}

export const config = { path: "/api/*" };
