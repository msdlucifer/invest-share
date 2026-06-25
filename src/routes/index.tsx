import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, TrendingUp, Users, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Folio — Multi-Asset Portfolio Management for Clients & Managers" },
      { name: "description", content: "Track equity, bonds and commodities with live prices. Managers oversee every assigned client portfolio from one dashboard." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Static ambient gradient backdrop — no infinite animation */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 20% 0%, oklch(0.45 0.22 275 / 0.35), transparent 60%), radial-gradient(ellipse 50% 45% at 90% 20%, oklch(0.5 0.2 305 / 0.22), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px"
        style={{ background: "linear-gradient(90deg, transparent, oklch(0.7 0.2 275 / 0.4), transparent)" }}
      />

      <header className="border-b border-border/50 backdrop-blur-md bg-background/60 sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 backdrop-blur px-3 py-1 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-70" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            Equity · Bonds · Commodities
          </span>
          <h1 className="mt-6 font-serif text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
            Portfolio management,<br />
            <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[oklch(0.78_0.18_270)] via-[oklch(0.7_0.2_285)] to-[oklch(0.65_0.2_310)]">
              built for clarity.
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            Clients track equity, bonds and commodities with real-time profit &amp; loss. Portfolio
            managers monitor every assigned client from a single dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="group">
              <Link to="/auth" search={{ mode: "signup", role: "client" }}>
                I'm a Client
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "signup", role: "manager" }}>I'm a Portfolio Manager</Link>
            </Button>
          </div>
        </motion.div>

        <div className="mt-24 grid sm:grid-cols-3 gap-4">
          {[
            { icon: TrendingUp, title: "Multi-asset live P&L", body: "Equity and commodity prices update automatically. Bonds use manual pricing." },
            { icon: Users, title: "Manager dashboards", body: "Onboard clients via invite link. Open any client to see their portfolio with live data." },
            { icon: ShieldCheck, title: "Role-based access", body: "Clients manage their own assets. Managers get view-only access — no edits, no deletes." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.06, ease: "easeOut" }}
              className="group rounded-xl border border-border/60 bg-card/60 backdrop-blur p-6 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 font-serif text-lg font-bold">{f.title}</div>
              <div className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.body}</div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
