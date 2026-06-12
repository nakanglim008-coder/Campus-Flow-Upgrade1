import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { api, type ExeatDTO } from "../../lib/api";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, LogOut, ScanLine, Users, RefreshCw } from "lucide-react";
import Logo from "../../components/Logo";
import NotificationBell from "../../components/NotificationBell";

type ScanResult = {
  kind: string;
  message: string;
};

const RESULT_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  "valid-out": { emoji: "🚪", label: "Cleared to Depart", color: "oklch(0.70 0.20 150)" },
  "valid-in": { emoji: "🏠", label: "Returned to Campus", color: "oklch(0.72 0.18 250)" },
  invalid: { emoji: "❌", label: "Invalid Pass", color: "oklch(0.60 0.22 25)" },
  expired: { emoji: "⏰", label: "Pass Expired / Wrong State", color: "oklch(0.78 0.16 80)" },
  not_checked_out_of_hostel: { emoji: "🏢", label: "Not Checked Out of Hostel", color: "oklch(0.78 0.16 80)" },
};

function getConfig(kind: string) {
  return RESULT_CONFIG[kind] ?? { emoji: "❓", label: "Unknown", color: "oklch(0.78 0.16 80)" };
}

export default function Security() {
  const { user, logout } = useAuth();
  const [, nav] = useLocation();
  const [tab, setTab] = useState<"scan" | "active">("scan");
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [active, setActive] = useState<ExeatDTO[]>([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!user) { nav("/auth"); return; }
    if (user.role !== "security") { nav("/"); return; }
    return () => { stopScanner(); };
  }, [user]);

  useEffect(() => {
    if (tab === "active") loadActive();
  }, [tab]);

  async function loadActive() {
    setLoadingActive(true);
    api.exeats.active().then(setActive).finally(() => setLoadingActive(false));
  }

  async function startScanner() {
    setResult(null);
    setScanning(true);
    try {
      const qr = new Html5Qrcode("qr-reader");
      scannerRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (code) => {
          if (processingRef.current) return;
          processingRef.current = true;
          await handleScan(code);
          await stopScanner();
        },
        () => {},
      );
    } catch {
      setScanning(false);
      setResult({ kind: "invalid", message: "Camera not available. Use manual entry below." });
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
    processingRef.current = false;
  }

  async function handleScan(code: string) {
    const trimmed = code.trim().toUpperCase();
    try {
      const r = await api.exeats.scan(trimmed);
      setResult(r);
    } catch {
      setResult({ kind: "invalid", message: "Network error. Try again." });
    }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setResult(null);
    await handleScan(code);
  }

  const cfg = result ? getConfig(result.kind) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-card border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo size={30} />
          <span className="font-bold text-gradient">PulsePass</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.72_0.18_35_/_0.2)] text-[oklch(0.80_0.16_60)] font-medium">Security</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-[var(--color-muted-foreground)]">{user?.name}</span>
          <NotificationBell />
          <motion.button whileHover={{ scale: 1.05 }} onClick={logout}
            className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] p-1.5 rounded-lg hover:bg-[var(--color-secondary)]">
            <LogOut className="w-4 h-4" />
          </motion.button>
        </div>
      </header>

      <div className="flex gap-1 p-4 pb-0 max-w-lg mx-auto w-full">
        {(["scan", "active"] as const).map((t) => (
          <motion.button key={t} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all capitalize ${tab === t ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] glow-border" : "bg-[var(--color-secondary)] text-[var(--color-muted-foreground)]"}`}
          >
            {t === "scan"
              ? <span className="flex items-center justify-center gap-1.5"><ScanLine className="w-4 h-4" /> Scan</span>
              : <span className="flex items-center justify-center gap-1.5"><Users className="w-4 h-4" /> Active Passes</span>
            }
          </motion.button>
        ))}
      </div>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        <AnimatePresence mode="wait">
          {tab === "scan" && (
            <motion.div key="scan" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="relative bg-black" style={{ minHeight: scanning ? 280 : 0 }}>
                  <div id="qr-reader" className="w-full" />
                  {scanning && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-[14%] left-[14%] w-10 h-10 border-t-2 border-l-2 border-[var(--color-primary)]" />
                      <div className="absolute top-[14%] right-[14%] w-10 h-10 border-t-2 border-r-2 border-[var(--color-primary)]" />
                      <div className="absolute bottom-[14%] left-[14%] w-10 h-10 border-b-2 border-l-2 border-[var(--color-primary)]" />
                      <div className="absolute bottom-[14%] right-[14%] w-10 h-10 border-b-2 border-r-2 border-[var(--color-primary)]" />
                      <div className="absolute left-[14%] right-[14%] h-0.5 scan-beam-anim" style={{ background: "linear-gradient(to right, transparent, var(--color-primary), transparent)" }} />
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col items-center gap-3">
                  {!scanning ? (
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={startScanner}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold glow-border hover:opacity-90">
                      <Camera className="w-5 h-5" /> Start Camera Scan
                    </motion.button>
                  ) : (
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={stopScanner}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-secondary)] font-medium hover:opacity-90">
                      <CameraOff className="w-5 h-5" /> Stop Scanner
                    </motion.button>
                  )}
                  <p className="text-xs text-[var(--color-muted-foreground)] text-center">
                    Point camera at the student's QR pass code
                  </p>
                </div>
              </div>

              <form onSubmit={handleManual} className="glass-card rounded-2xl p-4 flex gap-2">
                <input value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                  className="input-base font-mono text-sm tracking-wider" placeholder="Enter pass code (e.g. PP-A1B2C)" maxLength={20} />
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  type="submit" className="flex-shrink-0 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold text-sm hover:opacity-90">
                  Check
                </motion.button>
              </form>

              <AnimatePresence>
                {result && cfg && (
                  <motion.div key="result" initial={{ opacity: 0, scale: 0.92, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="rounded-2xl p-6 text-center space-y-3"
                    style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}45` }}>
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.4 }} className="text-5xl">{cfg.emoji}</motion.div>
                    <p className="font-bold text-xl" style={{ color: cfg.color }}>{cfg.label}</p>
                    <p className="text-sm text-[var(--color-foreground)] font-medium">{result.message}</p>
                    {result.kind === "valid-in" && (
                      <p className="text-xs text-[var(--color-muted-foreground)] bg-[var(--color-secondary)] rounded-lg px-3 py-1.5">
                        Student must now check in at their hostel with the porter.
                      </p>
                    )}
                    <motion.button whileHover={{ scale: 1.03 }} onClick={() => { setResult(null); setManualCode(""); }}
                      className="mt-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] underline">
                      Scan another
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {tab === "active" && (
            <motion.div key="active" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
                  {active.length} active pass{active.length !== 1 ? "es" : ""}
                </p>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={loadActive}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </motion.button>
              </div>

              {loadingActive && <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" /></div>}

              {!loadingActive && active.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-12 text-center text-[var(--color-muted-foreground)]">
                  <Users className="w-9 h-9 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No students currently at the gate</p>
                </motion.div>
              )}

              <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="space-y-3">
                {active.map((e) => {
                  const statusColor = e.status === "departed" ? "oklch(0.72 0.18 250)" : e.status === "hostel_checked_out" ? "oklch(0.78 0.16 80)" : "oklch(0.70 0.20 150)";
                  return (
                    <motion.div key={e.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                      whileHover={{ x: 3 }} transition={{ type: "spring", stiffness: 300 }}
                      className="glass-card rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{e.studentName}</p>
                          <p className="text-xs text-[var(--color-muted-foreground)]">{e.matric} · {e.hostel}</p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize" style={{ background: `${statusColor}22`, color: statusColor }}>
                          {e.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-muted-foreground)]">{e.destination}</span>
                        <span className="font-mono font-bold text-[var(--color-primary)]">{e.code}</span>
                      </div>
                      <p className="text-xs text-[var(--color-muted-foreground)]">Returns: {e.returnDate}</p>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="text-center py-3 text-xs text-[var(--color-muted-foreground)]">
        Made by <span className="text-[var(--color-primary)] font-semibold">shadow</span>
      </footer>
    </div>
  );
}
