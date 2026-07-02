import { Router } from "express";
import { z } from "zod";
import { eq, desc, or } from "drizzle-orm";
import { users, exeatRequests } from "@workspace/db/schema";
import { getDb } from "../lib/db";
import { requireAuth, requireRole, makeExeatCode, type JwtPayload } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: JwtPayload };

const router = Router();
router.use(requireAuth);

function toDTO(row: {
  exeat_requests: typeof exeatRequests.$inferSelect;
  users: typeof users.$inferSelect | null;
}) {
  const e = row.exeat_requests;
  return {
    id: e.id,
    code: e.code,
    studentId: e.studentId,
    studentName: row.users?.name ?? "Unknown",
    matric: row.users?.matric ?? null,
    hostel: row.users?.hostel ?? null,
    destination: e.destination,
    reason: e.reason,
    type: e.type,
    departDate: e.departDate,
    returnDate: e.returnDate,
    status: e.status,
    rejectReason: e.rejectReason,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

const createSchema = z.object({
  destination: z.string().trim().min(2).max(200),
  reason: z.string().trim().min(5).max(1000),
  type: z.enum(["regular", "emergency", "medical", "academic"]),
  departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.get("/my", requireRole("student"), async (req, res) => {
  const { userId } = (req as AuthReq).user;
  const db = getDb();
  const rows = await db
    .select()
    .from(exeatRequests)
    .leftJoin(users, eq(exeatRequests.studentId, users.id))
    .where(eq(exeatRequests.studentId, userId))
    .orderBy(desc(exeatRequests.createdAt));
  res.json(rows.map(toDTO));
});

router.post("/", requireRole("student"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }
  const data = parsed.data;
  const { userId } = (req as AuthReq).user;
  const db = getDb();

  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const [created] = await db
    .insert(exeatRequests)
    .values({
      code: makeExeatCode(),
      studentId: userId,
      destination: data.destination,
      reason: data.reason,
      type: data.type,
      departDate: data.departDate,
      returnDate: data.returnDate,
      status: data.type === "emergency" ? "approved" : "pending",
    })
    .returning();

  res.status(201).json(toDTO({ exeat_requests: created, users: userRow }));
});

router.get("/all", requireRole("admin"), async (req, res) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(exeatRequests)
    .leftJoin(users, eq(exeatRequests.studentId, users.id))
    .orderBy(desc(exeatRequests.createdAt));
  res.json(rows.map(toDTO));
});

const reviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  rejectReason: z.string().trim().max(500).optional(),
});

router.patch("/review", requireRole("admin"), async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { id, status, rejectReason } = parsed.data;
  const { userId } = (req as AuthReq).user;
  const db = getDb();

  await db
    .update(exeatRequests)
    .set({
      status,
      rejectReason: status === "rejected" ? (rejectReason ?? "No reason given") : null,
      reviewedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(exeatRequests.id, id));

  res.json({ ok: true });
});

router.get("/active", requireRole("security"), async (req, res) => {
  const db = getDb();
  const rows = await db
    .select()
    .from(exeatRequests)
    .leftJoin(users, eq(exeatRequests.studentId, users.id))
    .where(
      or(
        eq(exeatRequests.status, "approved"),
        eq(exeatRequests.status, "departed"),
        eq(exeatRequests.status, "returned"),
      ),
    )
    .orderBy(desc(exeatRequests.updatedAt));
  res.json(rows.map(toDTO));
});

const scanSchema = z.object({ code: z.string().trim().min(1).max(40) });

router.post("/scan", requireRole("security"), async (req, res) => {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { code } = parsed.data;
  const db = getDb();

  const [found] = await db
    .select()
    .from(exeatRequests)
    .leftJoin(users, eq(exeatRequests.studentId, users.id))
    .where(eq(exeatRequests.code, code))
    .limit(1);

  if (!found) {
    res.json({ kind: "invalid", message: "Pass not recognized." });
    return;
  }

  const e = found.exeat_requests;
  if (e.status === "approved") {
    await db
      .update(exeatRequests)
      .set({ status: "departed", updatedAt: new Date() })
      .where(eq(exeatRequests.id, e.id));
    res.json({
      kind: "valid-out",
      message: `${found.users?.name ?? "Student"} cleared to depart.`,
      studentName: found.users?.name,
      destination: e.destination,
      returnDate: e.returnDate,
    });
    return;
  }
  if (e.status === "departed") {
    await db
      .update(exeatRequests)
      .set({ status: "returned", updatedAt: new Date() })
      .where(eq(exeatRequests.id, e.id));
    res.json({
      kind: "valid-in",
      message: `${found.users?.name ?? "Student"} returned to campus.`,
      studentName: found.users?.name,
    });
    return;
  }
  res.json({ kind: "expired", message: `Pass status: ${e.status}. Cannot scan.` });
});

export default router;
