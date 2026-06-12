import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { api, type ExeatType } from "../../lib/api";
import StudentLayout from "./StudentLayout";
import { Send, Zap } from "lucide-react";

const TYPES: { value: ExeatType; label: string; desc: string; color: string }[] = [
  { value: "regular", label: "Regular", desc: "Standard weekend or holiday leave", color: "oklch(0.62 0.18 150)" },
  { value: "medical", label: "Medical", desc: "Hospital visit or health-related leave", color: "oklch(0.72 0.18 250)" },
  { value: "academic", label: "Academic", desc: "Study trip, conference, or external exam", color: "oklch(0.78 0.16 80)" },
  { value: "emergency", label: "Emergency", desc: "Auto-approved — urgent situations only", color: "oklch(0.65 0.22 25)" },
];

export default function NewRequest() {
  const [, nav] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    destination: "",
    reason: "",
    type: "regular" as ExeatType,
    departDate: "",
    returnDate: "",
  });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.returnDate < form.departDate) { setError("Return date must be on or after departure date"); return; }
    setLoading(true);
    try {
      await api.exeats.create(form);
      setSuccess(true);
      setTimeout(() => nav("/student"), 1200);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  const selectedType = TYPES.find(t => t.value === form.type)!;

  return (
    <StudentLayout>
      <div className="max-w-lg space-y-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-gradient">New Exeat Request</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">Fill in your campus leave details</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-2xl p-12 text-center space-y-3">
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }} className="text-5xl">✅</motion.div>
              <p className="font-bold text-lg text-[var(--color-success)]">Request submitted!</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">Redirecting to overview…</p>
            </motion.div>
          ) : (
            <motion.form key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              onSubmit={submit} className="glass-card rounded-2xl p-6 space-y-5">
              {/* Type selector */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-2">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map(t => (
                    <motion.button key={t.value} type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      className={`text-left p-3 rounded-xl border transition-all ${form.type === t.value ? "glow-border" : "border-[var(--color-border)] hover:border-[oklch(0.4_0.08_150_/_0.5)]"}`}
                      style={form.type === t.value ? { background: `${t.color}18`, borderColor: `${t.color}55` } : {}}>
                      <div className="text-xs font-semibold" style={{ color: form.type === t.value ? t.color : "var(--color-foreground)" }}>{t.label}</div>
                      <div className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5 leading-tight">{t.desc}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Destination</label>
                <input value={form.destination} onChange={set("destination")} required autoComplete="off" className="input-base" placeholder="Home, Lagos / Hospital, Enugu" />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Reason</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required rows={3}
                  className="input-base resize-none" placeholder="Brief description of why you need to leave campus" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Departure Date</label>
                  <input type="date" value={form.departDate} onChange={set("departDate")} required className="input-base" min={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Return Date</label>
                  <input type="date" value={form.returnDate} onChange={set("returnDate")} required className="input-base" min={form.departDate || new Date().toISOString().slice(0, 10)} />
                </div>
              </div>

              <AnimatePresence>
                {form.type === "emergency" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 bg-[oklch(0.65_0.22_25_/_0.1)] border border-[oklch(0.65_0.22_25_/_0.35)] rounded-xl p-3">
                    <Zap className="w-4 h-4 flex-shrink-0 text-[oklch(0.78_0.16_80)] mt-0.5" />
                    <p className="text-xs text-[oklch(0.78_0.16_80)]">Emergency leaves are <b>auto-approved</b> and can be scanned at the gate immediately.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="text-sm text-[var(--color-destructive)] bg-[oklch(0.6_0.22_25_/_0.12)] rounded-lg px-3 py-2">{error}</motion.p>
                )}
              </AnimatePresence>

              <motion.button type="submit" disabled={loading} whileHover={!loading ? { scale: 1.01 } : {}} whileTap={!loading ? { scale: 0.99 } : {}}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold text-sm hover:opacity-90 disabled:opacity-50 glow-border"
                style={form.type !== "regular" ? { background: selectedType.color } : {}}>
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Submitting…</span>
                ) : <><Send className="w-4 h-4" /> Submit Request</>}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </StudentLayout>
  );
}
