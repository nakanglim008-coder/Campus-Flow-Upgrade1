import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { Bell, BellOff, Fingerprint, ArrowLeft, ShieldCheck } from "lucide-react";
import { usePushNotifications } from "../../hooks/use-push-notifications";
import { api } from "../../lib/api";
import { startRegistration } from "@simplewebauthn/browser";
import Logo from "../../components/Logo";

export default function Settings() {
  const { user } = useAuth();
  const [, nav] = useLocation();
  const { subscribe, unsubscribe, isSubscribed } = usePushNotifications();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricDone, setBiometricDone] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!user) { nav("/auth"); return; }
    isSubscribed().then(setPushEnabled);
  }, [user]);

  async function togglePush() {
    setPushLoading(true);
    setMsg(null);
    try {
      if (pushEnabled) {
        await unsubscribe();
        setPushEnabled(false);
        setMsg({ type: "ok", text: "Push notifications disabled." });
      } else {
        await subscribe();
        const sub = await isSubscribed();
        setPushEnabled(sub);
        setMsg({ type: sub ? "ok" : "err", text: sub ? "Push notifications enabled!" : "Couldn't enable — check browser permission." });
      }
    } catch (err: unknown) {
      setMsg({ type: "err", text: (err as Error).message ?? "Failed" });
    }
    setPushLoading(false);
  }

  async function registerBiometric() {
    setBiometricLoading(true);
    setMsg(null);
    try {
      const options = await api.webauthn.registerOptions();
      const credential = await startRegistration({ optionsJSON: options });
      const result = await api.webauthn.registerVerify(credential, options.challenge);
      if (result.verified) {
        setBiometricDone(true);
        setMsg({ type: "ok", text: "Biometric registered! You can now sign in with your fingerprint or face." });
      } else {
        setMsg({ type: "err", text: "Biometric registration failed." });
      }
    } catch (err: unknown) {
      setMsg({ type: "err", text: (err as Error).message ?? "Biometric registration failed" });
    }
    setBiometricLoading(false);
  }

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-card border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo size={30} />
          <span className="font-bold text-gradient">PulsePass</span>
        </div>
      </header>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-5">
        <div className="flex items-center gap-3 mt-1">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => nav("/student")}
            className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            <ArrowLeft className="w-4 h-4" /> Back
          </motion.button>
        </div>

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-gradient">Account Settings</h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">{user?.name} · {user?.email}</p>
        </motion.div>

        <AnimatePresence>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.type === "ok" ? "bg-[oklch(0.70_0.20_150_/_0.15)] text-[oklch(0.70_0.20_150)]" : "bg-[oklch(0.60_0.22_25_/_0.12)] text-[var(--color-destructive)]"}`}>
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-sm">Notifications</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: pushEnabled ? "oklch(0.70_0.20_150_/_0.2)" : "var(--color-secondary)" }}>
                {pushEnabled ? <Bell className="w-4 h-4 text-[oklch(0.70_0.20_150)]" /> : <BellOff className="w-4 h-4 text-[var(--color-muted-foreground)]" />}
              </div>
              <div>
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {pushEnabled ? "You'll receive push notifications" : "Get notified even when the app is closed"}
                </p>
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={togglePush} disabled={pushLoading}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors ${pushEnabled ? "bg-[var(--color-secondary)] text-[var(--color-foreground)]" : "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"}`}>
              {pushLoading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" /> : pushEnabled ? "Disable" : "Enable"}
            </motion.button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-sm">Security</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: biometricDone ? "oklch(0.70_0.20_150_/_0.2)" : "var(--color-secondary)" }}>
                {biometricDone ? <ShieldCheck className="w-4 h-4 text-[oklch(0.70_0.20_150)]" /> : <Fingerprint className="w-4 h-4 text-[var(--color-muted-foreground)]" />}
              </div>
              <div>
                <p className="text-sm font-medium">Biometric Login</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {biometricDone ? "Biometric registered successfully" : "Sign in with your fingerprint or face ID"}
                </p>
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={registerBiometric} disabled={biometricLoading || biometricDone}
              className="px-4 py-1.5 rounded-lg bg-[var(--color-secondary)] text-xs font-semibold disabled:opacity-50 transition-colors hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-foreground)]">
              {biometricLoading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" /> : biometricDone ? "Registered" : "Register"}
            </motion.button>
          </div>
        </motion.div>
      </div>

      <footer className="text-center py-3 text-xs text-[var(--color-muted-foreground)]">
        Made by <span className="text-[var(--color-primary)] font-semibold">shadow</span>
      </footer>
    </div>
  );
}
