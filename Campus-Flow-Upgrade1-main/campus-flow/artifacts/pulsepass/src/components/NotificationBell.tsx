import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, X } from "lucide-react";
import { api, type NotificationDTO } from "../lib/api";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationDTO[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter(n => !n.readAt).length;

  async function load() {
    try {
      const data = await api.notifications.list();
      setNotifs(data);
    } catch {}
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markRead(id: string) {
    try {
      await api.notifications.markRead(id);
      setNotifs(ns => ns.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    } catch {}
  }

  async function markAllRead() {
    try {
      await api.notifications.markAllRead();
      setNotifs(ns => ns.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    } catch {}
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl hover:bg-[var(--color-secondary)] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-[var(--color-muted-foreground)]" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
              style={{ background: "oklch(0.65 0.22 25)" }}
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 glass-card rounded-2xl shadow-2xl overflow-hidden"
            style={{ maxHeight: "70vh" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="font-semibold text-sm">Notifications</h3>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <motion.button whileHover={{ scale: 1.05 }} onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline px-2 py-1">
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </motion.button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-[var(--color-secondary)] text-[var(--color-muted-foreground)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 52px)" }}>
              {notifs.length === 0 && (
                <div className="px-4 py-10 text-center text-[var(--color-muted-foreground)]">
                  <Bell className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No notifications yet</p>
                </div>
              )}

              {notifs.slice(0, 10).map(n => (
                <motion.div key={n.id} whileHover={{ x: 2 }}
                  className={`px-4 py-3 border-b border-[var(--color-border)] last:border-0 transition-colors ${!n.readAt ? "bg-[var(--color-primary)]/5" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!n.readAt ? "text-[var(--color-foreground)]" : "text-[var(--color-muted-foreground)]"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-[var(--color-muted-foreground)] mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.readAt && (
                      <motion.button whileHover={{ scale: 1.1 }} onClick={() => markRead(n.id)}
                        className="flex-shrink-0 text-[10px] text-[var(--color-primary)] hover:underline mt-0.5">
                        Read
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
