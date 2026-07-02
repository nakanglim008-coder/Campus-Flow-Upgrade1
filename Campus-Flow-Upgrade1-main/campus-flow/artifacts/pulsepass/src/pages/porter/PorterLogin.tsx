import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { Eye, EyeOff, ArrowLeft, Building2 } from "lucide-react";
import Logo from "../../components/Logo";

export default function PorterLogin() {
  const [, nav] = useLocation();
  const { refresh } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.porter.login(form.email, form.password);
      await refresh();
      nav("/porter");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center space-y-3">
          <div className="flex justify-center gap-3 mb-4 items-center">
            <Logo size={48} />
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.72_0.18_35_/_0.2)", boxShadow: "0 0 20px oklch(0.72_0.18_35_/_0.3)" }}>
              <Building2 className="w-6 h-6" style={{ color: "oklch(0.78 0.18 45)" }} />
            </div>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "oklch(0.78 0.18 45)" }}>Porter Login</h1>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            Hostel porter access — scan exeat passes at your hostel
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={submit} className="glass-card rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={set("email")} required autoComplete="email" className="input-base" placeholder="porter@school.edu.ng" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                required
                autoComplete="current-password"
                className="input-base pr-10"
                placeholder="Password"
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="text-sm text-[var(--color-destructive)] bg-[oklch(0.6_0.22_25_/_0.12)] rounded-lg px-3 py-2">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={!loading ? { scale: 1.01 } : {}}
            whileTap={!loading ? { scale: 0.99 } : {}}
            className="w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: "oklch(0.72 0.18 45)", boxShadow: "0 0 24px oklch(0.72_0.18_45_/_0.35)" }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Signing in…
              </span>
            ) : "Sign In as Porter"}
          </motion.button>
        </motion.form>

        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          onClick={() => nav("/auth")} className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] mx-auto">
          <ArrowLeft className="w-3 h-3" /> Back to student login
        </motion.button>
      </div>

      <footer className="mt-auto pt-10 text-xs text-[var(--color-muted-foreground)]">
        Made by <span className="text-[var(--color-primary)] font-semibold">shadow</span>
      </footer>
    </div>
  );
}
