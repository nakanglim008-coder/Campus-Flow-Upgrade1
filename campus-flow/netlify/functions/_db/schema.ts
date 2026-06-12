import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", ["student", "admin", "security", "porter"]);
export const exeatStatusEnum = pgEnum("exeat_status", [
  "pending",
  "approved",
  "rejected",
  "hostel_checked_out",
  "departed",
  "returned",
  "hostel_returned",
]);
export const exeatTypeEnum = pgEnum("exeat_type", [
  "regular",
  "emergency",
  "medical",
  "academic",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  role: roleEnum("role").notNull().default("student"),
  matric: varchar("matric", { length: 50 }),
  hostel: varchar("hostel", { length: 120 }),
  room: varchar("room", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const exeatRequests = pgTable(
  "exeat_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(),
    reason: text("reason").notNull(),
    type: exeatTypeEnum("type").notNull().default("regular"),
    departDate: varchar("depart_date", { length: 20 }).notNull(),
    returnDate: varchar("return_date", { length: 20 }).notNull(),
    status: exeatStatusEnum("status").notNull().default("pending"),
    rejectReason: text("reject_reason"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    hostelCheckedOutBy: uuid("hostel_checked_out_by").references(() => users.id, { onDelete: "set null" }),
    hostelCheckedOutAt: timestamp("hostel_checked_out_at", { withTimezone: true }),
    hostelCheckedInBy: uuid("hostel_checked_in_by").references(() => users.id, { onDelete: "set null" }),
    hostelCheckedInAt: timestamp("hostel_checked_in_at", { withTimezone: true }),
    gateScannedOutBy: uuid("gate_scanned_out_by").references(() => users.id, { onDelete: "set null" }),
    gateScannedOutAt: timestamp("gate_scanned_out_at", { withTimezone: true }),
    gateScannedInBy: uuid("gate_scanned_in_by").references(() => users.id, { onDelete: "set null" }),
    gateScannedInAt: timestamp("gate_scanned_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_exeat_student").on(t.studentId),
    index("idx_exeat_status").on(t.status),
  ],
);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  exeatId: uuid("exeat_id").references(() => exeatRequests.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_notif_user").on(t.userId),
  index("idx_notif_read").on(t.readAt),
]);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_push_user").on(t.userId),
]);

export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(),
  counter: varchar("counter", { length: 20 }).notNull().default("0"),
  transports: text("transports"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_webauthn_user").on(t.userId),
]);

export type User = typeof users.$inferSelect;
export type ExeatRequest = typeof exeatRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type WebauthnCredential = typeof webauthnCredentials.$inferSelect;
