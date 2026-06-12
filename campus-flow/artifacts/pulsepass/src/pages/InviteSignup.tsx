import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { ShieldCheck, Eye, EyeOff, Lock } from "lucide-react";
import Logo from "../components/Logo";

type Props = { role: "admin" | "security" };

export default function InviteSignup({ role }: Props) {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [, nav] = useLocation();
  const { refresh } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.signup({ email: form.email, password: form.password, name: form.name, role, inviteToken: token });
      await refresh();
      setSuccess(true);
      setTimeout(() => nav(role === "admin" ? "/admin" : "/security"), 1400);
    } catch (err: unknown) {
      setError((err as Error).message ?? "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  const label = role === "admin" ? "Admin" : "Security Officer";
  const color = role === "admin" ? "oklch(0.72 0.18 250)" : "oklch(0.78 0.16 35)";
  const Icon = role === "admin" ? ShieldCheck : Lock;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center space-y-3">
          <div className="flex justify-center gap-3 mb-4 items-center">
            <Logo size={48} />
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${color}22`, boxShadow: `0 0 20px ${color}30` }}>
              <Icon className="w-6 h-6" style={{ color }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold" style={{ color }}>{label} Registration</h1>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            This page is for authorized <b className="text-[var(--color-foreground)]">{label.toLowerCase()}</b> accounts only. Staff are invited privately.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card rounded-2xl p-10 text-center space-y-3">
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }} className="text-5xl">✅</motion.div>
              <p className="font-semibold text-[var(--color-success)] text-lg">Account created!</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">Redirecting to your dashboard…</p>
            </motion.div>
          ) : (
            <motion.form key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              onSubmit={submit} className="glass-card rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Full Name</label>
                <input value={form.name} onChange={set("name")} required autoComplete="name" className="input-base" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={set("email")} required autoComplete="email" className="input-base" placeholder="you@school.edu.ng" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={form.password} onChange={set("password")} required minLength={8} autoComplete="new-password" className="input-base pr-10" placeholder="Min 8 characters" />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="text-sm text-[var(--color-destructive)] bg-[oklch(0.6_0.22_25_/_0.12)] rounded-lg px-3 py-2">{error}</motion.p>
                )}
              </AnimatePresence>

              <motion.button type="submit" disabled={loading} whileHover={!loading ? { scale: 1.01 } : {}} whileTap={!loading ? { scale: 0.99 } : {}}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: color, boxShadow: `0 0 24px ${color}35` }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : `Register as ${label}`}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <footer className="mt-auto pt-10 text-xs text-[var(--color-muted-foreground)]">
        Made by <span className="text-[var(--color-primary)] font-semibold">shadow</span>
      </footer>
    </div>
  );
}
