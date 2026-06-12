import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { api, type ExeatDTO } from "../../lib/api";
import { QRCodeSVG } from "qrcode.react";
import { ClipboardCheck, Clock, XCircle, CheckCircle2, Plus, TrendingUp } from "lucide-react";
import StudentLayout from "./StudentLayout";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "oklch(0.78 0.16 80)", icon: Clock },
  approved: { label: "Approved", color: "oklch(0.70 0.20 150)", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "oklch(0.60 0.22 25)", icon: XCircle },
  hostel_checked_out: { label: "At Gate", color: "oklch(0.78 0.16 60)", icon: ClipboardCheck },
  departed: { label: "Departed", color: "oklch(0.72 0.18 250)", icon: ClipboardCheck },
  returned: { label: "Returned", color: "oklch(0.70 0.20 150)", icon: CheckCircle2 },
  hostel_returned: { label: "Checked In", color: "oklch(0.68 0.18 150)", icon: CheckCircle2 },
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };

export default function Overview() {
  const { user } = useAuth();
  const [, nav] = useLocation();
  const [exeats, setExeats] = useState<ExeatDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQr, setShowQr] = useState<ExeatDTO | null>(null);

  useEffect(() => {
    api.exeats.my().then(setExeats).finally(() => setLoading(false));
  }, []);

  const active = exeats.find(e => ["approved", "hostel_checked_out", "departed", "returned"].includes(e.status));
  const recent = exeats.slice(0, 5);
  const stats = [
    { label: "Total", value: exeats.length, color: "oklch(0.62 0.18 150)" },
    { label: "Pending", value: exeats.filter(e => e.status === "pending").length, color: "oklch(0.78 0.16 80)" },
    { label: "Active", value: exeats.filter(e => ["approved", "hostel_checked_out", "departed", "returned", "hostel_returned"].includes(e.status)).length, color: "oklch(0.70 0.20 150)" },
  ];

  return (
    <StudentLayout>
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        {/* Greeting */}
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-gradient">Good day, {user?.name?.split(" ")[0]} 👋</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
            {user?.hostel} · <span className="font-mono">{user?.matric}</span>
          </p>
        </motion.div>

        {/* Mini stats */}
        {!loading && exeats.length > 0 && (
          <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
            {stats.map(s => (
              <div key={s.label} className="glass-card rounded-xl p-3 text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-[var(--color-muted-foreground)]">{s.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Active pass */}
        <AnimatePresence>
          {active && (
            <motion.div variants={fadeUp} key="active"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-2xl p-5 border border-[oklch(0.7_0.2_150_/_0.4)] glow-border">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">🟢 Active Pass</span>
                  <h2 className="font-bold text-lg">{active.destination}</h2>
                  <p className="text-sm text-[var(--color-muted-foreground)]">Returns: <span className="text-[var(--color-foreground)] font-medium">{active.returnDate}</span></p>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className="font-mono text-sm bg-[var(--color-secondary)] px-2 py-0.5 rounded font-bold text-[var(--color-primary)]">{active.code}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: `${STATUS_CONFIG[active.status].color}22`, color: STATUS_CONFIG[active.status].color }}>
                      {STATUS_CONFIG[active.status].label}
                    </span>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowQr(active)}
                  className="flex-shrink-0 w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                  <QRCodeSVG value={active.code} size={52} level="M" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!active && !loading && (
          <motion.button variants={fadeUp}
            whileHover={{ scale: 1.01, borderColor: "var(--color-primary)" }}
            onClick={() => nav("/student/new")}
            className="w-full py-7 glass-card rounded-2xl border-dashed border-2 border-[oklch(0.4_0.1_150_/_0.4)] flex flex-col items-center gap-2 hover:bg-[oklch(0.3_0.1_150_/_0.08)] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[oklch(0.3_0.1_150_/_0.4)] flex items-center justify-center">
              <Plus className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <span className="text-sm font-medium text-[var(--color-primary)]">Submit an exeat request</span>
            <span className="text-xs text-[var(--color-muted-foreground)]">Regular · Medical · Academic · Emergency</span>
          </motion.button>
        )}

        {/* Recent requests */}
        {recent.length > 0 && (
          <motion.div variants={fadeUp} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Recent Requests
              </h2>
              <button onClick={() => nav("/student/history")} className="text-xs text-[var(--color-primary)] hover:underline">View all</button>
            </div>
            <motion.div variants={stagger} className="space-y-2">
              {recent.map((e) => {
                const cfg = STATUS_CONFIG[e.status];
                const Icon = cfg.icon;
                return (
                  <motion.div key={e.id} variants={fadeUp}
                    whileHover={{ x: 3 }} transition={{ type: "spring", stiffness: 400 }}
                    className="glass-card rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `${cfg.color}22` }}>
                        <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.destination}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">{e.departDate} → {e.returnDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(e.status === "approved" || e.status === "departed") && (
                        <button onClick={() => setShowQr(e)} className="text-xs text-[var(--color-primary)] font-medium hover:underline">QR</button>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${cfg.color}22`, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </motion.div>

      {/* QR Modal */}
      <AnimatePresence>
        {showQr && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4" onClick={() => setShowQr(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="glass-card rounded-3xl p-8 flex flex-col items-center gap-5 max-w-xs w-full" onClick={e => e.stopPropagation()}>
              <h2 className="font-bold text-lg">Pass QR Code</h2>
              <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 2, repeat: Infinity }} className="bg-white rounded-2xl p-4">
                <QRCodeSVG value={showQr.code} size={180} level="H" />
              </motion.div>
              <div className="text-center space-y-1">
                <p className="font-mono font-bold text-2xl text-[var(--color-primary)]">{showQr.code}</p>
                <p className="text-sm text-[var(--color-muted-foreground)]">{showQr.destination}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Show this to security at the gate</p>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setShowQr(null)} className="w-full py-2.5 rounded-xl bg-[var(--color-secondary)] text-sm font-medium hover:opacity-90">
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </StudentLayout>
  );
}
