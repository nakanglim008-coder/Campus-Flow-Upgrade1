import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { api, type InviteDTO } from "../../lib/api";
import { Link2, Copy, Check, Trash2, Plus, ArrowLeft, Clock, ShieldCheck, Briefcase, RefreshCw } from "lucide-react";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";

const ROLE_CONFIG = {
  security: { label: "Security Officer", color: "oklch(0.78 0.16 35)", icon: ShieldCheck },
  porter:   { label: "Porter",           color: "oklch(0.78 0.18 45)", icon: Briefcase },
  admin:    { label: "Admin",            color: "oklch(0.72 0.18 250)", icon: ShieldCheck },
};

const EXPIRY_OPTIONS = [
  { label: "24 hours", value: 24 },
  { label: "48 hours", value: 48 },
  { label: "72 hours", value: 72 },
  { label: "7 days",   value: 168 },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.32 } } };

function timeLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  return `${h}h left`;
}

export default function AdminInvites() {
  const { user, logout } = useAuth();
  const [, nav] = useLocation();
  const [invites, setInvites] = useState<InviteDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ role: "security", note: "", expiresHours: 48 });
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    api.invites.list().then(setInvites).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) { nav("/auth"); return; }
    if (user.role !== "admin") { nav("/"); return; }
    load();
  }, [user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api.invites.create({ role: form.role, note: form.note || undefined, expiresHours: form.expiresHours });
      setInvites(prev => [created, ...prev]);
      setShowForm(false);
      setForm({ role: "security", note: "", expiresHours: 48 });
      copyToClipboard(created.url, created.id);
    } catch {}
    setCreating(false);
  }

  async function copyToClipboard(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(c => (c === id ? null : c)), 2200);
    } catch {}
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      await api.invites.revoke(id);
      setInvites(prev => prev.filter(i => i.id !== id));
    } catch {}
    setRevoking(null);
  }

  const active  = invites.filter(i => !i.usedAt && new Date(i.expiresAt) > new Date());
  const expired = invites.filter(i => !i.usedAt && new Date(i.expiresAt) <= new Date());
  const used    = invites.filter(i => i.usedAt);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-card border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Logo size={30} />
          <span className="font-bold text-gradient">PulsePass</span>
          <span className="hidden sm:block text-xs px-2 py-0.5 rounded-full bg-[oklch(0.72_0.18_250_/_0.2)] text-[oklch(0.72_0.18_250)] font-medium">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <motion.button whileHover={{ scale: 1.05 }} onClick={() => nav("/admin")}
            className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} onClick={logout}
            className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] p-1.5 rounded-lg hover:bg-[var(--color-secondary)]">
            Logout
          </motion.button>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6 max-w-3xl mx-auto w-full space-y-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gradient flex items-center gap-2"><Link2 className="w-5 h-5" /> Invite Links</h1>
            <p className="text-sm text-[var(--color-muted-foreground)] mt-1">Generate time-limited links to invite security officers and porters</p>
          </div>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={load}
              className="p-2 rounded-xl bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
              <RefreshCw className="w-4 h-4" />
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => setShowForm(s => !s)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-sm font-semibold glow-border">
              <Plus className="w-4 h-4" /> New Invite
            </motion.button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showForm && (
            <motion.form key="form" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
              onSubmit={handleCreate} className="glass-card rounded-2xl p-5 space-y-4">
              <p className="text-sm font-semibold">Generate new invite link</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="input-base">
                    <option value="security">Security Officer</option>
                    <option value="porter">Porter</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Expires in</label>
                  <select value={form.expiresHours} onChange={e => setForm(f => ({ ...f, expiresHours: Number(e.target.value) }))}
                    className="input-base">
                    {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">Note <span className="font-normal opacity-60">(optional — e.g. "North Gate porter")</span></label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="input-base" placeholder="Internal note for tracking" maxLength={200} />
              </div>
              <div className="flex gap-2 justify-end">
                <motion.button type="button" whileHover={{ scale: 1.02 }} onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--color-secondary)] text-sm font-medium">Cancel</motion.button>
                <motion.button type="submit" disabled={creating} whileHover={!creating ? { scale: 1.02 } : {}}
                  className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-sm font-semibold disabled:opacity-50">
                  {creating ? "Generating…" : "Generate & Copy Link"}
                </motion.button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {loading && <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" /></div>}

        {!loading && invites.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl p-12 text-center text-[var(--color-muted-foreground)]">
            <Link2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No invite links yet</p>
            <p className="text-sm mt-1">Click "New Invite" to generate your first link.</p>
          </motion.div>
        )}

        {[{ title: "Active", items: active, dim: false }, { title: "Used", items: used, dim: true }, { title: "Expired", items: expired, dim: true }]
          .filter(g => g.items.length > 0)
          .map(group => (
            <div key={group.title} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] px-1">{group.title} ({group.items.length})</p>
              <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
                {group.items.map(inv => {
                  const cfg = ROLE_CONFIG[inv.role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.security;
                  const Icon = cfg.icon;
                  const isCopied = copied === inv.id;
                  const canRevoke = !inv.usedAt;
                  return (
                    <motion.div key={inv.id} variants={fadeUp}
                      className={`glass-card rounded-2xl p-4 space-y-3 ${group.dim ? "opacity-50" : ""}`}>
                      <div className="flex items-start gap-3 justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}22` }}>
                            <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{cfg.label}</p>
                            {inv.note && <p className="text-xs text-[var(--color-muted-foreground)] truncate">{inv.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {inv.usedAt ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.70_0.20_150_/_0.15)] text-[oklch(0.70_0.20_150)]">Used</span>
                          ) : new Date(inv.expiresAt) <= new Date() ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[oklch(0.6_0.22_25_/_0.15)] text-[oklch(0.6_0.22_25)]">Expired</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: `${cfg.color}18`, color: cfg.color }}>
                              <Clock className="w-3 h-3" /> {timeLeft(inv.expiresAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono bg-[var(--color-secondary)] rounded-lg px-3 py-1.5 truncate text-[var(--color-muted-foreground)]">
                          {inv.url}
                        </code>
                        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                          onClick={() => copyToClipboard(inv.url, inv.id)}
                          className="flex-shrink-0 p-2 rounded-lg bg-[var(--color-secondary)] hover:bg-[var(--color-border)] transition-colors"
                          title="Copy link">
                          {isCopied ? <Check className="w-4 h-4 text-[oklch(0.70_0.20_150)]" /> : <Copy className="w-4 h-4 text-[var(--color-muted-foreground)]" />}
                        </motion.button>
                        {canRevoke && (
                          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                            onClick={() => handleRevoke(inv.id)}
                            disabled={revoking === inv.id}
                            className="flex-shrink-0 p-2 rounded-lg bg-[oklch(0.6_0.22_25_/_0.12)] hover:bg-[oklch(0.6_0.22_25_/_0.2)] transition-colors disabled:opacity-40"
                            title="Revoke">
                            <Trash2 className="w-4 h-4 text-[var(--color-destructive)]" />
                          </motion.button>
                        )}
                      </div>

                      <p className="text-xs text-[var(--color-muted-foreground)] pl-12">
                        Created {new Date(inv.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                        {inv.usedAt && ` · Used ${new Date(inv.usedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}`}
                      </p>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          ))}
      </div>
    </div>
  );
}
