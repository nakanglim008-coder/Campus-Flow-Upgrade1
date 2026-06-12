import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, type PublicUser } from "./api";

type AuthCtx = {
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const u = await api.auth.me();
      setUser(u);
    } catch {
      setUser(null);
    }
  }

  async function logout() {
    try { await api.auth.logout(); } catch {}
    setUser(null);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  return <Ctx.Provider value={{ user, loading, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
