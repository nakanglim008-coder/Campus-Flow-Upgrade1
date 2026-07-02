import { useEffect } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/auth";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import InviteSignup from "./pages/InviteSignup";
import Overview from "./pages/student/Overview";
import NewRequest from "./pages/student/NewRequest";
import History from "./pages/student/History";
import Settings from "./pages/student/Settings";
import Admin from "./pages/admin/Admin";
import AdminPorters from "./pages/admin/AdminPorters";
import AdminSecurity from "./pages/admin/AdminSecurity";
import AdminInvites from "./pages/admin/AdminInvites";
import Security from "./pages/security/Security";
import PorterLogin from "./pages/porter/PorterLogin";
import PorterDashboard from "./pages/porter/PorterDashboard";

const qc = new QueryClient();

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function StudentGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Redirect to="/auth" />;
  if (user.role !== "student") return <Redirect to={user.role === "admin" ? "/admin" : user.role === "security" ? "/security" : "/porter"} />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Redirect to="/auth" />;
  if (user.role !== "admin") return <Redirect to="/" />;
  return <>{children}</>;
}

function SecurityGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Redirect to="/auth" />;
  if (user.role !== "security") return <Redirect to="/" />;
  return <>{children}</>;
}

function PorterGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Redirect to="/porter/login" />;
  if (user.role !== "porter") return <Redirect to="/" />;
  return <>{children}</>;
}

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

function Routes() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/auth" component={Auth} />
        <Route path="/porter/login" component={PorterLogin} />
        <Route path="/invite/admin/:token">
          {() => <InviteSignup role="admin" />}
        </Route>
        <Route path="/invite/security/:token">
          {() => <InviteSignup role="security" />}
        </Route>
        <Route path="/invite/porter/:token">
          {() => <InviteSignup role="porter" />}
        </Route>
        <Route path="/student">
          <StudentGuard><Overview /></StudentGuard>
        </Route>
        <Route path="/student/new">
          <StudentGuard><NewRequest /></StudentGuard>
        </Route>
        <Route path="/student/history">
          <StudentGuard><History /></StudentGuard>
        </Route>
        <Route path="/student/settings">
          <StudentGuard><Settings /></StudentGuard>
        </Route>
        <Route path="/admin">
          <AdminGuard><Admin /></AdminGuard>
        </Route>
        <Route path="/admin/security">
          <AdminGuard><AdminSecurity /></AdminGuard>
        </Route>
        <Route path="/admin/porters">
          <AdminGuard><AdminPorters /></AdminGuard>
        </Route>
        <Route path="/admin/invites">
          <AdminGuard><AdminInvites /></AdminGuard>
        </Route>
        <Route path="/security">
          <SecurityGuard><Security /></SecurityGuard>
        </Route>
        <Route path="/porter">
          <PorterGuard><PorterDashboard /></PorterGuard>
        </Route>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Routes />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
