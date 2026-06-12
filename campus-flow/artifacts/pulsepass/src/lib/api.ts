const BASE = "/api";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin" | "security" | "porter";
  matric: string | null;
  hostel: string | null;
  room: string | null;
};

export type ExeatStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "hostel_checked_out"
  | "departed"
  | "returned"
  | "hostel_returned";

export type ExeatType = "regular" | "emergency" | "medical" | "academic";

export type ExeatDTO = {
  id: string;
  code: string;
  studentId: string;
  studentName: string;
  matric: string | null;
  hostel: string | null;
  room: string | null;
  destination: string;
  reason: string;
  type: ExeatType;
  departDate: string;
  returnDate: string;
  status: ExeatStatus;
  rejectReason: string | null;
  hostelCheckedOutBy: string | null;
  hostelCheckedOutAt: string | null;
  hostelCheckedInBy: string | null;
  hostelCheckedInAt: string | null;
  gateScannedOutBy: string | null;
  gateScannedOutAt: string | null;
  gateScannedInBy: string | null;
  gateScannedInAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExeatDetails = ExeatDTO & {
  hostelCheckedOutByName: string | null;
  hostelCheckedInByName: string | null;
  gateScannedOutByName: string | null;
  gateScannedInByName: string | null;
};

export type NotificationDTO = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  exeatId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type Porter = {
  id: string;
  email: string;
  name: string;
  hostel: string | null;
  createdAt: string;
};

export type InviteDTO = {
  id: string;
  token: string;
  role: "security" | "porter" | "admin";
  note: string | null;
  url: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    me: () => request<PublicUser>("/auth/me"),
    login: (email: string, password: string) =>
      request<PublicUser>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    signup: (data: {
      email: string;
      password: string;
      name: string;
      role: "student" | "admin" | "security";
      matric?: string;
      hostel?: string;
      room?: string;
      inviteToken?: string;
    }) => request<PublicUser>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
    logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  },
  porter: {
    login: (email: string, password: string) =>
      request<PublicUser>("/porter/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  },
  porters: {
    list: () => request<Porter[]>("/porters"),
    create: (data: { email: string; password: string; name: string; hostel: string }) =>
      request<Porter>("/porters/create", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/porters/${id}`, { method: "DELETE" }),
    scan: (code: string) =>
      request<{ kind: string; message: string; studentName?: string; destination?: string }>("/porters/scan", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
  },
  exeats: {
    my: () => request<ExeatDTO[]>("/exeats/my"),
    create: (data: {
      destination: string;
      reason: string;
      type: ExeatType;
      departDate: string;
      returnDate: string;
    }) => request<ExeatDTO>("/exeats", { method: "POST", body: JSON.stringify(data) }),
    all: () => request<ExeatDTO[]>("/exeats/all"),
    review: (id: string, status: "approved" | "rejected", rejectReason?: string) =>
      request<{ ok: boolean }>("/exeats/review", {
        method: "PATCH",
        body: JSON.stringify({ id, status, rejectReason }),
      }),
    active: () => request<ExeatDTO[]>("/exeats/active"),
    scan: (code: string) =>
      request<{ kind: string; message: string; studentName?: string; destination?: string; returnDate?: string }>("/exeats/scan", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    details: (id: string) => request<ExeatDetails>(`/exeats/details/${id}`),
  },
  notifications: {
    list: () => request<NotificationDTO[]>("/notifications"),
    markRead: (id: string) => request<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () => request<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),
  },
  push: {
    getVapidKey: () => request<{ publicKey: string | null }>("/push/vapid-key"),
    subscribe: (subscription: PushSubscriptionJSON) =>
      request<{ ok: boolean }>("/push/subscribe", { method: "POST", body: JSON.stringify(subscription) }),
    unsubscribe: (endpoint: string) =>
      request<{ ok: boolean }>("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),
  },
  webauthn: {
    registerOptions: () => request<any>("/webauthn/register/options", { method: "POST", body: "{}" }),
    registerVerify: (credential: any, challenge: string) =>
      request<{ verified: boolean }>("/webauthn/register/verify", {
        method: "POST",
        body: JSON.stringify({ credential, challenge }),
      }),
    loginOptions: (email: string) =>
      request<any>("/webauthn/login/options", { method: "POST", body: JSON.stringify({ email }) }),
    loginVerify: (credential: any, challenge: string, userId: string) =>
      request<{ verified: boolean }>("/webauthn/login/verify", {
        method: "POST",
        body: JSON.stringify({ credential, challenge, userId }),
      }),
  },
  invites: {
    list: () => request<InviteDTO[]>("/admin/invites"),
    create: (data: { role: string; note?: string; expiresHours?: number }) =>
      request<InviteDTO>("/admin/invites", { method: "POST", body: JSON.stringify(data) }),
    revoke: (id: string) =>
      request<{ ok: boolean }>(`/admin/invites/${id}`, { method: "DELETE" }),
    validate: (token: string) =>
      request<{ valid: boolean; role?: string; note?: string }>(`/invite/validate/${token}`),
  },
};
