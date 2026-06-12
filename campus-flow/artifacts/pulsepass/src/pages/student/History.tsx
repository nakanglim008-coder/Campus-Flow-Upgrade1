import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, type ExeatDTO } from "../../lib/api";
import { QRCodeSVG } from "qrcode.react";
import { Clock, CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
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

const TYPE_LABELS = { regular: "Regular", emergency: "Emergency", medical: "Medical", academic: "Academic" };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function History() {
  const [exeats, setExeats] = useState<ExeatDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQr, setShowQr] = useState<ExeatDTO | null>(null);

  useEffect(() => { api.exeats.my().then(setExeats).finally(() => setLoading(false)); }, []);

  return (
    <StudentLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-gradient">Request History</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">{exeats.length} request{exeats.length !== 1 ? "s" : ""} total</p>
        </motion.div>

        {loading && <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" /></div>}

        {!loading && exeats.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-12 text-center text-[var(--color-muted-foreground)]">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">No requests yet</p>
            <p className="text-sm mt-1">Submit your first exeat request from the Overview page.</p>
          </motion.div>
        )}

        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
          {exeats.map(e => {
            const cfg = STATUS_CONFIG[e.status];
            const Icon = cfg.icon;
            const canQr = e.status === "approved" || e.status === "hostel_checked_out" || e.status === "departed";
            return (
              <motion.div key={e.id} variants={fadeUp} whileHover={{ x: 3 }} transition={{ type: "spring", stiffness: 400 }}
                className="glass-card rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: `${cfg.color}22` }}>
                      <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{e.destination}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">{TYPE_LABELS[e.type]} · {e.departDate} → {e.returnDate}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0" style={{ background: `${cfg.color}22`, color: cfg.color }}>{cfg.label}</span>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)] pl-12">{e.reason}</p>
                {e.rejectReason && (
                  <p className="text-xs text-[var(--color-destructive)] pl-12 bg-[oklch(0.6_0.22_25_/_0.08)] rounded-lg px-3 py-2">Reason: {e.rejectReason}</p>
                )}
                <div className="flex items-center justify-between pl-12">
                  {canQr ? (
                    <motion.button whileHover={{ scale: 1.05 }} onClick={() => setShowQr(e)} className="text-xs text-[var(--color-primary)] font-medium hover:underline">View QR Pass</motion.button>
                  ) : <span />}
                  <p className="text-xs text-[var(--color-muted-foreground)]">{new Date(e.createdAt).toLocaleDateString()}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <AnimatePresence>
        {showQr && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4" onClick={() => setShowQr(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="glass-card rounded-3xl p-8 flex flex-col items-center gap-5 max-w-xs w-full" onClick={e => e.stopPropagation()}>
              <h2 className="font-bold text-lg">Pass QR Code</h2>
              <div className="bg-white rounded-2xl p-4"><QRCodeSVG value={showQr.code} size={180} level="H" /></div>
              <div className="text-center">
                <p className="font-mono font-bold text-2xl text-[var(--color-primary)]">{showQr.code}</p>
                <p className="text-sm text-[var(--color-muted-foreground)] mt-1">Show at the gate</p>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setShowQr(null)} className="w-full py-2.5 rounded-xl bg-[var(--color-secondary)] text-sm font-medium">Close</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </StudentLayout>
  );
}
