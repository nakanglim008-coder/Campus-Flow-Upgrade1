import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { api, type ExeatDTO, type ExeatDetails } from "../../lib/api";
import { Clock, CheckCircle2, XCircle, ClipboardCheck, LogOut, FileText, BarChart3, Building2, X, ChevronRight, Link2 } from "lucide-react";
import Logo from "../../components/Logo";
import NotificationBell from "../../components/NotificationBell";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "oklch(0.78 0.16 80)", icon: Clock },
  approved: { label: "Approved", color: "oklch(0.70 0.20 150)", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "oklch(0.60 0.22 25)", icon: XCircle },
  hostel_checked_out: { label: "At Gate", color: "oklch(0.78 0.16 60)", icon: ClipboardCheck },
  departed: { label: "Departed", color: "oklch(0.72 0.18 250)", icon: ClipboardCheck },
  returned: { label: "Returned", color: "oklch(0.70 0.20 150)", icon: CheckCircle2 },
  hostel_returned: { label: "Checked In", color: "oklch(0.68 0.18 150)", icon: CheckCircle2 },
};

type Filter = "all" | "pending" | "approved" | "rejected";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

function fmt(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

export default function Admin() {
  const { user, logout } = useAuth();
  const [, nav] = useLocation();
  const [exeats, setExeats] = useState<ExeatDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [reviewing, setReviewing] = useState<ExeatDTO | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [details, setDetails] = useState<ExeatDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    api.exeats.all().then(setExeats).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) { nav("/auth"); return; }
    if (user.role !== "admin") { nav("/"); return; }
    load();
  }, [user]);

  useEffect(() => {
    if (!detailsId) { setDetails(null); return; }
    setDetailsLoading(true);
    api.exeats.details(detailsId).then(setDetails).finally(() => setDetailsLoading(false));
  }, [detailsId]);

  async function handleReview(status: "approved" | "rejected") {
    if (!reviewing) return;
    if (status === "rejected" && !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await api.exeats.review(reviewing.id, status, rejectReason || undefined);
      setReviewing(null);
      setRejectReason("");
      await load();
    } catch {}
    setActionLoading(false);
  }

  const filtered = filter === "all" ? exeats : exeats.filter((e) => e.status === filter);
  const pendingCount = exeats.filter((e) => e.status === "pending").length;
  const stats = [
    { label: "Total", value: exeats.length, color: "oklch(0.62 0.18 150)" },
    { label: "Pending", value: pendingCount, color: "oklch(0.78 0.16 80)" },
    { label: "Active", value: exeats.filter((e) => ["approved", "hostel_checked_out", "departed", "returned"].includes(e.status)).length, color: "oklch(0.70 0.20 150)" },
    { label: "Rejected", value: exeats.filter((e) => e.status === "rejected").length, color: "oklch(0.60 0.22 25)" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-card border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo size={30} />
          <span className="font-bold text-gradient">PulsePass</span>
          <span className="hidden sm:block text-xs px-2 py-0.5 rounded-full bg-[oklch(0.72_0.18_250_/_0.2)] text-[oklch(0.72_0.18_250)] font-medium">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-[var(--color-muted-foreground)]">{user?.name}</span>
          <NotificationBell />
          <motion.button whileHover={{ scale: 1.05 }}
            onClick={() => nav("/admin/porters")}
            className="flex items-center gap-1.5 text-xs text-[oklch(0.78_0.18_45)] hover:underline font-medium">
            <Building2 className="w-3.5 h-3.5" /> Porters
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }}
            onClick={() => nav("/admin/invites")}
            className="flex items-center gap-1.5 text-xs text-[oklch(0.72_0.18_150)] hover:underline font-medium">
            <Link2 className="w-3.5 h-3.5" /> Invites
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} onClick={logout}
            className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] p-1.5 rounded-lg hover:bg-[var(--color-secondary)]">
            <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Logout</span>
          </motion.button>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[oklch(0.72_0.18_250)]" />
            Admin Dashboard
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">Review and manage student exeat requests</p>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <motion.div key={s.label} variants={fadeUp}
              whileHover={{ y: -3, scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}
              className="glass-card rounded-2xl p-4 text-center space-y-1">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["pending", "all", "approved", "rejected"] as Filter[]).map((f) => (
            <motion.button key={f} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors capitalize ${filter === f ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
            >
              {f} {f === "pending" && pendingCount > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="ml-1 bg-[oklch(0.78_0.16_80_/_0.3)] text-[oklch(0.78_0.16_80)] rounded-full px-1.5 text-xs">{pendingCount}</motion.span>
              )}
            </motion.button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-14 text-[var(--color-muted-foreground)]">
            <FileText className="w-9 h-9 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No {filter !== "all" ? filter : ""} requests</p>
          </motion.div>
        )}

        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
          {filtered.map((e) => {
            const cfg = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <motion.div key={e.id} variants={fadeUp}
                whileHover={{ x: 2 }} transition={{ type: "spring", stiffness: 300 }}
                className="glass-card rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: `${cfg.color}22` }}>
                      <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{e.studentName}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">{e.matric} · {e.hostel}{e.room ? ` · ${e.room}` : ""}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 capitalize" style={{ background: `${cfg.color}22`, color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>

                <div className="pl-[52px] grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--color-muted-foreground)]">Destination: </span><span className="font-medium">{e.destination}</span></div>
                  <div><span className="text-[var(--color-muted-foreground)]">Type: </span><span className="font-medium capitalize">{e.type}</span></div>
                  <div><span className="text-[var(--color-muted-foreground)]">Dates: </span><span className="font-medium">{e.departDate} → {e.returnDate}</span></div>
                  <div><span className="text-[var(--color-muted-foreground)]">Code: </span><span className="font-mono font-bold text-[var(--color-primary)]">{e.code}</span></div>
                </div>

                <p className="text-xs text-[var(--color-muted-foreground)] pl-[52px]">{e.reason}</p>

                {e.rejectReason && (
                  <p className="text-xs text-[var(--color-destructive)] pl-[52px] bg-[oklch(0.6_0.22_25_/_0.08)] rounded-lg px-3 py-1.5">
                    Rejection: {e.rejectReason}
                  </p>
                )}

                <div className="pl-[52px] flex items-center gap-2">
                  {e.status === "pending" && (
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setReviewing(e)}
                      className="px-5 py-1.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-xs font-semibold hover:opacity-90 glow-border">
                      Review Request
                    </motion.button>
                  )}
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setDetailsId(detailsId === e.id ? null : e.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-secondary)] text-xs font-medium hover:opacity-90">
                    Timeline <ChevronRight className={`w-3 h-3 transition-transform ${detailsId === e.id ? "rotate-90" : ""}`} />
                  </motion.button>
                </div>

                <AnimatePresence>
                  {detailsId === e.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="pl-[52px] overflow-hidden">
                      {detailsLoading ? (
                        <div className="py-3 flex justify-center"><div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" /></div>
                      ) : details ? (
                        <div className="space-y-1.5 text-xs mt-2 bg-[var(--color-secondary)] rounded-xl p-3">
                          {[
                            { label: "Hostel check-out", at: details.hostelCheckedOutAt, by: details.hostelCheckedOutByName },
                            { label: "Gate departure", at: details.gateScannedOutAt, by: details.gateScannedOutByName },
                            { label: "Gate return", at: details.gateScannedInAt, by: details.gateScannedInByName },
                            { label: "Hostel check-in", at: details.hostelCheckedInAt, by: details.hostelCheckedInByName },
                          ].map(step => (
                            <div key={step.label} className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${step.at ? "bg-[oklch(0.70_0.20_150)]" : "bg-[var(--color-muted-foreground)] opacity-30"}`} />
                              <span className="text-[var(--color-muted-foreground)]">{step.label}:</span>
                              {step.at ? (
                                <span className="font-medium">{fmt(step.at)}{step.by ? ` · ${step.by}` : ""}</span>
                              ) : (
                                <span className="opacity-40">—</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <footer className="text-center py-3 text-xs text-[var(--color-muted-foreground)]">
        Made by <span className="text-[var(--color-primary)] font-semibold">shadow</span>
      </footer>

      <AnimatePresence>
        {reviewing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4" onClick={() => setReviewing(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.88, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="glass-card rounded-3xl p-6 w-full max-w-md space-y-5" onClick={(e) => e.stopPropagation()}>
              <div>
                <h2 className="text-lg font-bold">Review Request</h2>
                <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
                  <strong className="text-[var(--color-foreground)]">{reviewing.studentName}</strong> → {reviewing.destination}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="glass-card rounded-lg p-2"><span className="text-[var(--color-muted-foreground)]">Type: </span><span className="font-medium capitalize">{reviewing.type}</span></div>
                  <div className="glass-card rounded-lg p-2"><span className="text-[var(--color-muted-foreground)]">Dates: </span><span className="font-medium">{reviewing.departDate} – {reviewing.returnDate}</span></div>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-3 bg-[var(--color-secondary)] rounded-lg p-2">{reviewing.reason}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Rejection reason (required to reject)</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
                  className="input-base resize-none" placeholder="State why this request is being rejected…" />
              </div>

              <div className="flex gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => handleReview("approved")} disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold text-sm hover:opacity-90 disabled:opacity-50 glow-border">
                  {actionLoading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /></span> : "✓ Approve"}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => handleReview("rejected")} disabled={actionLoading || !rejectReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-[oklch(0.60_0.22_25_/_0.2)] text-[oklch(0.70_0.20_30)] font-semibold text-sm hover:opacity-90 disabled:opacity-40 border border-[oklch(0.60_0.22_25_/_0.3)]">
                  ✕ Reject
                </motion.button>
              </div>

              <button onClick={() => setReviewing(null)} className="w-full py-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
