import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { Eye, EyeOff, ArrowLeft, Fingerprint } from "lucide-react";
import Logo from "../components/Logo";
import { startAuthentication } from "@simplewebauthn/browser";

export default function Auth() {
  const [, nav] = useLocation();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    matric: "",
    hostel: "",
    room: "",
  });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await api.auth.login(form.email, form.password);
      } else {
        await api.auth.signup({
          email: form.email,
          password: form.password,
          name: form.name,
          role: "student",
          matric: form.matric,
          hostel: form.hostel,
          room: form.room || undefined,
        });
      }
      await refresh();
      nav("/student");
    } catch (err: unknown) {
      setError((err as Error).message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometric() {
    const email = form.email.trim();
    if (!email) {
      setError("Enter your email first, then tap the biometric button.");
      return;
    }
    setBiometricLoading(true);
    setError("");
    try {
      const options = await api.webauthn.loginOptions(email);
      const credential = await startAuthentication({ optionsJSON: options });
      const result = await api.webauthn.loginVerify(credential, options.challenge, options.userId);
      if (result.verified) {
        await refresh();
        nav("/student");
      } else {
        setError("Biometric verification failed.");
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? "Biometric login failed.");
    } finally {
      setBiometricLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <motion.div whileHover={{ rotate: 5, scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
              <Logo size={52} />
            </motion.div>
          </div>
          <h1 className="text-2xl font-bold text-gradient">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-[var(--color-muted-foreground)] text-sm">
            {mode === "login" ? "Sign in to your student account" : "Register as a student — staff use invite links"}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={submit} className="glass-card rounded-2xl p-6 space-y-4"
        >
          <AnimatePresence mode="popLayout">
            {mode === "signup" && (
              <motion.div key="name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Full Name</label>
                <input value={form.name} onChange={set("name")} required autoComplete="name" className="input-base" placeholder="Ada Obi" />
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={set("email")} required autoComplete="email" className="input-base" placeholder="you@school.edu.ng" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                required
                minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="input-base pr-10"
                placeholder="Min 8 characters"
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {mode === "signup" && (
              <motion.div key="extra" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Matric Number</label>
                  <input value={form.matric} onChange={set("matric")} required autoComplete="off" className="input-base" placeholder="CSC/2021/001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Hostel</label>
                  <input value={form.hostel} onChange={set("hostel")} required autoComplete="off" className="input-base" placeholder="e.g., Nnamdi Hall" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Room <span className="text-[var(--color-muted-foreground)] font-normal">(optional)</span></label>
                  <input value={form.room} onChange={set("room")} autoComplete="off" className="input-base" placeholder="e.g., Block A, Room 12" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
            className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity glow-border"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Please wait…
              </span>
            ) : mode === "login" ? "Sign In" : "Create Account"}
          </motion.button>

          {mode === "login" && (
            <motion.button
              type="button"
              disabled={biometricLoading}
              onClick={handleBiometric}
              whileHover={!biometricLoading ? { scale: 1.01 } : {}}
              whileTap={!biometricLoading ? { scale: 0.99 } : {}}
              className="w-full py-2.5 rounded-xl bg-[var(--color-secondary)] text-[var(--color-foreground)] font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 border border-[var(--color-border)]"
            >
              {biometricLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" />
                  Sign in with biometrics
                </>
              )}
            </motion.button>
          )}
        </motion.form>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-center text-sm text-[var(--color-muted-foreground)]">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button type="button"
            className="text-[var(--color-primary)] font-medium hover:underline"
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
            {mode === "login" ? "Sign Up" : "Sign In"}
          </button>
        </motion.p>

        {mode === "login" && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="text-center text-sm text-[var(--color-muted-foreground)]">
            Porter?{" "}
            <button type="button"
              className="text-[oklch(0.72_0.18_35)] font-medium hover:underline"
              onClick={() => nav("/porter/login")}>
              Porter Login
            </button>
          </motion.p>
        )}

        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          onClick={() => nav("/")} className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] mx-auto">
          <ArrowLeft className="w-3 h-3" /> Back to home
        </motion.button>
      </div>

      <footer className="mt-auto pt-10 text-xs text-[var(--color-muted-foreground)]">
        Made by <span className="text-[var(--color-primary)] font-semibold">shadow</span>
      </footer>
    </div>
  );
}
