import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/auth";
import { LayoutDashboard, History, Plus, LogOut, Menu, X, Settings } from "lucide-react";
import { useState } from "react";
import Logo from "../../components/Logo";
import NotificationBell from "../../components/NotificationBell";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/student", icon: LayoutDashboard, label: "Overview" },
    { href: "/student/new", icon: Plus, label: "New Request" },
    { href: "/student/history", icon: History, label: "History" },
    { href: "/student/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Topbar */}
      <header className="glass-card border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-1.5 rounded-lg hover:bg-[var(--color-secondary)]" onClick={() => setOpen(o => !o)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-bold text-gradient">PulsePass</span>
          </div>
          <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-[oklch(0.3_0.1_150_/_0.35)] text-[var(--color-primary)] font-medium">Student</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-[var(--color-muted-foreground)] truncate max-w-[140px]">{user?.name}</span>
          <NotificationBell />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] p-1.5 rounded-lg hover:bg-[var(--color-secondary)]">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </motion.button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <AnimatePresence>
          {(open || typeof window !== "undefined") && (
            <aside className={`fixed md:static top-[57px] left-0 bottom-0 z-20 w-56 glass-card border-r border-[var(--color-border)] p-4 flex-col gap-1 md:flex ${open ? "flex" : "hidden"}`}>
              <nav className="flex flex-col gap-1">
                {links.map(({ href, icon: Icon, label }) => {
                  const active = location === href;
                  return (
                    <Link key={href} href={href}>
                      <motion.a
                        onClick={() => setOpen(false)}
                        whileHover={{ x: 3 }} transition={{ type: "spring", stiffness: 400 }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${active ? "bg-[oklch(0.3_0.1_150_/_0.45)] text-[var(--color-primary)] glow-border" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-secondary)]"}`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                        {active && <motion.span layoutId="sidebar-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />}
                      </motion.a>
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto pt-4 border-t border-[var(--color-border)]">
                <div className="px-3 py-2.5 rounded-xl bg-[var(--color-secondary)] space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">Matric</p>
                  <p className="text-xs font-mono font-semibold truncate text-[var(--color-foreground)]">{user?.matric ?? "—"}</p>
                  <p className="text-[10px] text-[var(--color-muted-foreground)] truncate">{user?.hostel ?? "—"}</p>
                </div>
              </div>
            </aside>
          )}
        </AnimatePresence>

        {/* Overlay for mobile */}
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-10 bg-black/60 md:hidden" onClick={() => setOpen(false)} />
          )}
        </AnimatePresence>

        <motion.main
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex-1 p-4 md:p-6 max-w-4xl">
          {children}
        </motion.main>
      </div>

      <footer className="text-center py-3 text-xs text-[var(--color-muted-foreground)]">
        Made by <span className="text-[var(--color-primary)] font-semibold">shadow</span>
      </footer>
    </div>
  );
}
