import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Logo from "../components/Logo";
import {
  ArrowRight, Shield, QrCode, ClipboardCheck, CheckCircle2,
  ChevronDown, Users, Lock, Smartphone, Zap, Eye, Bell, Globe,
  Menu, X,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px 0px" });
  return (
    <motion.div ref={ref} variants={stagger} initial="hidden" animate={inView ? "show" : "hidden"} className={className}>
      {children}
    </motion.div>
  );
}

const steps = [
  {
    num: "01",
    title: "Student submits a request",
    desc: "Using the PulsePass app, students fill in destination, reason, type and dates. Emergency leaves are instant.",
    icon: ClipboardCheck,
    color: "oklch(0.62 0.18 150)",
  },
  {
    num: "02",
    title: "Admin reviews & decides",
    desc: "The school admin sees all pending requests in a clean dashboard. One tap to approve or reject with a note.",
    icon: Shield,
    color: "oklch(0.72 0.18 250)",
  },
  {
    num: "03",
    title: "Security scans at the gate",
    desc: "The security officer opens PulsePass, scans the student's QR code, and the pass is marked departed — or returned.",
    icon: QrCode,
    color: "oklch(0.78 0.16 80)",
  },
];

const features = [
  {
    icon: Zap,
    title: "Instant emergency passes",
    desc: "Emergency exeats skip the queue entirely — auto-approved the moment a student submits. The QR code is ready immediately.",
    color: "oklch(0.78 0.16 80)",
  },
  {
    icon: QrCode,
    title: "Live QR scanning",
    desc: "Security uses the in-app camera scanner at the gate. No app download required — PulsePass works in any browser.",
    color: "oklch(0.62 0.18 150)",
  },
  {
    icon: Bell,
    title: "Real-time status updates",
    desc: "Students know the second their request is approved or rejected. Admins see the live count of pending requests.",
    color: "oklch(0.72 0.18 250)",
  },
  {
    icon: Eye,
    title: "Full audit trail",
    desc: "Every pass is timestamped — when it was submitted, reviewed, scanned out, and scanned back in. Zero ambiguity.",
    color: "oklch(0.70 0.20 150)",
  },
  {
    icon: Smartphone,
    title: "Mobile-first, installable",
    desc: "Works on any device. Add to your home screen for a native app feel — no Play Store or App Store required.",
    color: "oklch(0.62 0.18 150)",
  },
  {
    icon: Globe,
    title: "No paper. Ever.",
    desc: "Exeat forms, permit slips, physical passes — all replaced. One system for students, admins, and security.",
    color: "oklch(0.78 0.16 80)",
  },
];

const roles = [
  {
    role: "Student",
    icon: Users,
    color: "oklch(0.62 0.18 150)",
    items: [
      "Submit regular, medical, academic, or emergency exeat requests",
      "View your pass status in real time",
      "Get a QR code the moment your pass is approved",
      "See your full request history",
    ],
    cta: "Sign up as student",
    href: "/auth",
  },
  {
    role: "Admin",
    icon: Shield,
    color: "oklch(0.72 0.18 250)",
    items: [
      "Dashboard showing all pending, approved, and rejected requests",
      "One-click approve or reject with reason",
      "Filter by student name, matric, hostel, or status",
      "See exactly who is off-campus right now",
    ],
    cta: "Admin signup (invite only)",
    href: null,
  },
  {
    role: "Security",
    icon: QrCode,
    color: "oklch(0.78 0.16 80)",
    items: [
      "Camera QR scanner — no manual entry needed",
      "Instant result: valid departure, invalid pass, or return",
      "See a live list of all students who are off-campus",
      "Manual code entry fallback for any device",
    ],
    cta: "Security signup (invite only)",
    href: null,
  },
];

const stats = [
  { value: "3", label: "User roles", sub: "Student · Admin · Security" },
  { value: "4", label: "Exeat types", sub: "Regular · Medical · Academic · Emergency" },
  { value: "0", label: "Paper forms", sub: "Fully digital end-to-end" },
  { value: "∞", label: "Audit trail", sub: "Every action timestamped" },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const [, nav] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "admin") nav("/admin");
      else if (user.role === "security") nav("/security");
      else nav("/student");
    }
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* NAV */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-[var(--color-border)] px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <Logo size={34} />
            <span className="text-lg font-bold text-gradient">PulsePass</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--color-muted-foreground)]">
            <a href="#how-it-works" className="hover:text-[var(--color-foreground)] transition-colors">How it works</a>
            <a href="#features" className="hover:text-[var(--color-foreground)] transition-colors">Features</a>
            <a href="#roles" className="hover:text-[var(--color-foreground)] transition-colors">Roles</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => nav("/auth")} className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">Sign in</button>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => nav("/auth")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-sm font-semibold glow-border hover:opacity-90 transition-opacity"
            >
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          <button className="md:hidden p-2 rounded-lg hover:bg-[var(--color-secondary)]" onClick={() => setMobileNav(o => !o)}>
            {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileNav && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="md:hidden overflow-hidden pb-4">
              <div className="flex flex-col gap-3 pt-2">
                {["#how-it-works", "#features", "#roles"].map((href, i) => (
                  <a key={href} href={href} onClick={() => setMobileNav(false)} className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] px-2 py-1.5">
                    {["How it works", "Features", "Roles"][i]}
                  </a>
                ))}
                <button onClick={() => { setMobileNav(false); nav("/auth"); }} className="mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-sm font-semibold">
                  Get started <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* HERO */}
      <section ref={heroRef} className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 relative overflow-hidden">
        {/* Animated bg orbs */}
        <motion.div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, oklch(0.3 0.12 150 / 0.25), transparent 70%)", y: heroY, opacity: heroOpacity }} />
        <motion.div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, oklch(0.25 0.08 160 / 0.2), transparent 70%)", y: heroY }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-4xl mx-auto space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[var(--color-primary)] bg-[oklch(0.3_0.1_150_/_0.2)] text-[var(--color-primary)] text-xs font-semibold uppercase tracking-widest mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
              Smart Campus Movement System
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
            <div className="flex justify-center mb-6">
              <motion.div whileHover={{ rotate: 5, scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
                <Logo size={72} className="shadow-2xl" />
              </motion.div>
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight">
              <span className="text-gradient">Leave campus.</span>
              <br />
              <span className="text-[var(--color-foreground)]">Stay safe.</span>
            </h1>
          </motion.div>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg sm:text-xl text-[var(--color-muted-foreground)] max-w-2xl mx-auto leading-relaxed">
            PulsePass replaces paper exeat forms with a fully digital system. Students apply on their phone, admins approve instantly, and security scans a QR code at the gate. <span className="text-[var(--color-foreground)] font-medium">No friction. No paper. No excuses.</span>
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => nav("/auth")}
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold text-base glow-border hover:opacity-95 transition-opacity"
            >
              Start for free <ArrowRight className="w-5 h-5" />
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => nav("/auth")}
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-[var(--color-border)] text-[var(--color-foreground)] font-medium text-base hover:bg-[var(--color-secondary)] transition-colors"
            >
              <Lock className="w-4 h-4 text-[var(--color-muted-foreground)]" /> Admin / Security access
            </motion.button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--color-muted-foreground)]">
              {["✓ No paper forms", "✓ Works offline (QR)", "✓ Mobile-first & installable", "✓ Encrypted invite links for staff"].map(t => (
                <span key={t} className="flex items-center gap-1">{t}</span>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[var(--color-muted-foreground)]">
          <span className="text-xs">Scroll to explore</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </section>

      {/* STATS */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <Section>
            <motion.div variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s) => (
                <motion.div key={s.label} variants={fadeUp}
                  whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}
                  className="glass-card rounded-2xl p-5 sm:p-6 text-center group cursor-default">
                  <div className="text-4xl sm:text-5xl font-bold text-gradient mb-1">{s.value}</div>
                  <div className="text-sm font-semibold text-[var(--color-foreground)] mb-1">{s.label}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">{s.sub}</div>
                </motion.div>
              ))}
            </motion.div>
          </Section>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <Section>
            <motion.div variants={fadeUp} className="text-center mb-14 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">How it works</div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gradient">Three steps. Zero paper.</h2>
              <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
                PulsePass connects students, admins, and security in one seamless flow — from initial request to gate clearance.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-[68px] left-[calc(16.66%+12px)] right-[calc(16.66%+12px)] h-0.5"
                style={{ background: "linear-gradient(to right, transparent, oklch(0.4 0.1 150 / 0.5), oklch(0.4 0.1 150 / 0.5), transparent)" }} />

              {steps.map((s, i) => (
                <motion.div key={s.num} variants={fadeUp}
                  whileHover={{ y: -6, boxShadow: `0 20px 60px ${s.color}20` }}
                  transition={{ type: "spring", stiffness: 250 }}
                  className="glass-card rounded-2xl p-6 relative">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${s.color}22` }}>
                        <s.icon className="w-7 h-7" style={{ color: s.color }} />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: s.color, color: "oklch(0.08 0.02 155)" }}>
                        {i + 1}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold opacity-20 font-mono">{s.num}</div>
                      <h3 className="font-bold text-base">{s.title}</h3>
                      <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Section>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-4 bg-[oklch(0.11_0.015_155_/_0.5)]">
        <div className="max-w-5xl mx-auto">
          <Section>
            <motion.div variants={fadeUp} className="text-center mb-14 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">Features</div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gradient">Built for real campuses</h2>
              <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
                Every feature was designed around actual campus workflows — not generic templates.
              </p>
            </motion.div>

            <motion.div variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f) => (
                <motion.div key={f.title} variants={fadeUp}
                  whileHover={{ y: -4, borderColor: `${f.color}50` }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="glass-card rounded-2xl p-5 group border border-transparent">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ background: `${f.color}22` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                  <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </Section>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <Section>
            <motion.div variants={fadeUp} className="text-center mb-14 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">Roles</div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gradient">Everyone has a place</h2>
              <p className="text-[var(--color-muted-foreground)] max-w-xl mx-auto">
                PulsePass has purpose-built dashboards for each role in the exeat workflow.
              </p>
            </motion.div>

            <motion.div variants={stagger} className="grid md:grid-cols-3 gap-5">
              {roles.map((r) => (
                <motion.div key={r.role} variants={fadeUp}
                  whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 250 }}
                  className="glass-card rounded-2xl p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${r.color}22` }}>
                      <r.icon className="w-5 h-5" style={{ color: r.color }} />
                    </div>
                    <h3 className="font-bold text-base" style={{ color: r.color }}>{r.role}</h3>
                  </div>
                  <ul className="space-y-2 flex-1">
                    {r.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: r.color }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  {r.href ? (
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => nav(r.href!)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                      style={{ background: r.color, color: "oklch(0.08 0.02 155)" }}>
                      {r.cta}
                    </motion.button>
                  ) : (
                    <div className="w-full py-2 rounded-xl text-sm text-center font-medium opacity-50 cursor-not-allowed"
                      style={{ border: `1px solid ${r.color}50`, color: r.color }}>
                      🔐 {r.cta}
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </Section>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-2xl mx-auto">
          <Section>
            <motion.div variants={fadeUp}
              className="glass-card rounded-3xl p-10 sm:p-14 text-center space-y-6 glow-border relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, oklch(0.3 0.12 150 / 0.3), transparent 60%)" }} />
              <div className="relative z-10 space-y-6">
                <div className="flex justify-center">
                  <Logo size={56} />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gradient">Ready to go paperless?</h2>
                <p className="text-[var(--color-muted-foreground)] text-base leading-relaxed">
                  Sign up as a student today. Ask your school admin to reach out for an admin/security invite link.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => nav("/auth")}
                    className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-[var(--color-primary)] text-[var(--color-primary-foreground)] font-semibold glow-border hover:opacity-95">
                    Create student account <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </Section>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[var(--color-border)] py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-bold text-sm text-gradient">PulsePass</span>
          </div>
          <div className="flex gap-6 text-xs text-[var(--color-muted-foreground)]">
            <a href="#how-it-works" className="hover:text-[var(--color-foreground)]">How it works</a>
            <a href="#features" className="hover:text-[var(--color-foreground)]">Features</a>
            <a href="#roles" className="hover:text-[var(--color-foreground)]">Roles</a>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Made by <span className="text-[var(--color-primary)] font-semibold">shadow</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
