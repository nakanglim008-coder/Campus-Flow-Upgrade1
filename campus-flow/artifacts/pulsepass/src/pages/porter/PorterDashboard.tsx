import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, LogOut, ScanLine, Building2 } from "lucide-react";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";

type ScanResult = {
  kind: string;
  message: string;
};

const KIND_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  "hostel-out": { emoji: "🚪", label: "Checked Out of Hostel", color: "oklch(0.70 0.20 150)" },
  "hostel-in": { emoji: "🏠", label: "Checked In at Hostel", color: "oklch(0.72 0.18 250)" },
  invalid: { emoji: "❌", label: "Invalid Pass", color: "oklch(0.60 0.22 25)" },
  invalid_state: { emoji: "⚠️", label: "Cannot Scan Now", color: "oklch(0.78 0.16 80)" },
  wrong_hostel: { emoji: "🏢", label: "Wrong Hostel", color: "oklch(0.78 0.16 80)" },
};

function getConfig(kind: string) {
  return KIND_CONFIG[kind] ?? { emoji: "❓", label: "Unknown", color: "oklch(0.78 0.16 80)" };
}

export default function PorterDashboard() {
  const { user, logout } = useAuth();
  const [, nav] = useLocation();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!user) { nav("/porter/login"); return; }
    if (user.role !== "porter") { nav("/"); return; }
    return () => { stopScanner(); };
  }, [user]);

  async function startScanner() {
    setResult(null);
    setScanning(true);
    try {
      const qr = new Html5Qrcode("porter-qr-reader");
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
      const r = await api.porters.scan(trimmed);
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
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.72_0.18_45_/_0.2)", color: "oklch(0.78 0.18 45)" }}>Porter</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-[var(--color-muted-foreground)]">{user?.name}</span>
          {user?.hostel && (
            <span className="hidden sm:flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
              <Building2 className="w-3 h-3" /> {user.hostel}
            </span>
          )}
          <ThemeToggle />
          <motion.button whileHover={{ scale: 1.05 }} onClick={logout}
            className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] p-1.5 rounded-lg hover:bg-[var(--color-secondary)]">
            <LogOut className="w-4 h-4" />
          </motion.button>
        </div>
      </header>

      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-gradient flex items-center gap-2">
            <ScanLine className="w-5 h-5" /> Hostel Scanner
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
            Scan student exeat passes at <strong>{user?.hostel ?? "your hostel"}</strong>
          </p>
        </motion.div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="relative bg-black" style={{ minHeight: scanning ? 280 : 0 }}>
            <div id="porter-qr-reader" className="w-full" />
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
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold hover:opacity-90"
                style={{ background: "oklch(0.72 0.18 45)", boxShadow: "0 0 20px oklch(0.72_0.18_45_/_0.35)" }}>
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
            type="submit" className="flex-shrink-0 px-4 py-2 rounded-xl text-white font-semibold text-sm hover:opacity-90"
            style={{ background: "oklch(0.72 0.18 45)" }}>
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
              <motion.button whileHover={{ scale: 1.03 }} onClick={() => { setResult(null); setManualCode(""); }}
                className="mt-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] underline">
                Scan another
              </motion.button>
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
