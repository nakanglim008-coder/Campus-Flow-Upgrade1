import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { api, type Porter } from "../../lib/api";
import { Building2, Trash2, UserPlus, ArrowLeft, Eye, EyeOff, LogOut } from "lucide-react";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";

export default function AdminPorters() {
  const { user, logout } = useAuth();
  const [, nav] = useLocation();
  const [porters, setPorters] = useState<Porter[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: "", password: "", name: "", hostel: "" });
  const [showPass, setShowPass] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { nav("/auth"); return; }
    if (user.role !== "admin") { nav("/"); return; }
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    api.porters.list().then(setPorters).finally(() => setLoading(false));
  }

  function setF(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      await api.porters.create(form);
      setForm({ email: "", password: "", name: "", hostel: "" });
      await load();
    } catch (err: unknown) {
      setCreateError((err as Error).message ?? "Failed to create porter");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.porters.delete(id);
      setPorters(ps => ps.filter(p => p.id !== id));
    } catch {}
    setDeletingId(null);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-card border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo size={30} />
          <span className="font-bold text-gradient">PulsePass</span>
          <span className="hidden sm:block text-xs px-2 py-0.5 rounded-full bg-[oklch(0.72_0.18_250_/_0.2)] text-[oklch(0.72_0.18_250)] font-medium">Admin</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden md:block text-sm text-[var(--color-muted-foreground)]">{user?.name}</span>
          <ThemeToggle />
          <motion.button whileHover={{ scale: 1.05 }} onClick={logout}
            className="text-sm text-[var(--color-muted-foreground)] p-1.5 rounded-lg hover:bg-[var(--color-secondary)]">
            <span className="hidden sm:inline">Logout</span>
            <LogOut className="w-4 h-4 sm:hidden" />
          </motion.button>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-3">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => nav("/admin")}
            className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            <ArrowLeft className="w-4 h-4" /> Back
          </motion.button>
        </div>

        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[oklch(0.78_0.18_45)]" />
            Porter Management
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">Create and manage hostel porters</p>
        </motion.div>

        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          onSubmit={handleCreate} className="glass-card rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[oklch(0.78_0.18_45)]" /> Create New Porter
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Full Name</label>
              <input value={form.name} onChange={setF("name")} required className="input-base" placeholder="Porter name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={setF("email")} required className="input-base" placeholder="porter@school.edu.ng" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={setF("password")}
                  required
                  minLength={8}
                  className="input-base pr-10"
                  placeholder="Min 8 characters"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Assigned Hostel</label>
              <input 
                type="text"
                value={form.hostel} 
                onChange={setF("hostel")} 
                required
                className="input-base"
                placeholder="Enter hostel name"
              />
            </div>
          </div>

          <AnimatePresence>
            {createError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-sm text-[var(--color-destructive)] bg-[oklch(0.6_0.22_25_/_0.12)] rounded-lg px-3 py-2">
                {createError}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button type="submit" disabled={creating}
            whileHover={!creating ? { scale: 1.01 } : {}} whileTap={!creating ? { scale: 0.99 } : {}}
            className="px-6 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90"
            style={{ background: "oklch(0.72 0.18 45)" }}>
            {creating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creating…
              </span>
            ) : "Create Porter"}
          </motion.button>
        </motion.form>

        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-[var(--color-muted-foreground)]">
            {porters.length} porter{porters.length !== 1 ? "s" : ""} registered
          </h2>

          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && porters.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-12 text-center text-[var(--color-muted-foreground)]">
              <Building2 className="w-9 h-9 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No porters created yet</p>
            </motion.div>
          )}

          <motion.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show" className="space-y-3">
            {porters.map(p => (
              <motion.div key={p.id}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "oklch(0.72_0.18_45_/_0.2)" }}>
                    <Building2 className="w-4 h-4" style={{ color: "oklch(0.78 0.18 45)" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)] truncate">{p.email} · {p.hostel ?? "No hostel"}</p>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => handleDelete(p.id)}
                  disabled={deletingId === p.id}
                  className="p-2 rounded-lg text-[var(--color-destructive)] hover:bg-[oklch(0.6_0.22_25_/_0.1)] disabled:opacity-40 flex-shrink-0">
                  {deletingId === p.id
                    ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                    : <Trash2 className="w-4 h-4" />}
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      <footer className="text-center py-3 text-xs text-[var(--color-muted-foreground)]">
        Made by <span className="text-[var(--color-primary)] font-semibold">shadow</span>
      </footer>
    </div>
  );
}
