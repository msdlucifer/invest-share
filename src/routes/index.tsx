import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, TrendingUp, Users, ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Folio — Live Stock Portfolio for Clients & Managers" },
      { name: "description", content: "Track your holdings live, or manage portfolios across clients from one dashboard." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

function Landing() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient gradient orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute top-[-10rem] left-[10%] h-[32rem] w-[32rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.18 250 / 0.30), transparent 70%)" }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[20%] right-[-8rem] h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.16 300 / 0.22), transparent 70%)" }}
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <header className="border-b border-border/50 backdrop-blur-sm bg-background/60 sticky top-0 z-30">
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

      <section className="mx-auto max-w-6xl px-6 py-24">
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="max-w-3xl">
          <motion.span
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card/80 backdrop-blur px-3 py-1 text-xs text-muted-foreground"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            Live NSE & BSE prices
          </motion.span>
          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-6 text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]"
          >
            Portfolio management,<br />
            <span className="bg-gradient-to-r from-primary via-primary to-[oklch(0.55_0.18_300)] bg-clip-text text-transparent">
              built for clarity.
            </span>
          </motion.h1>
          <motion.p {...fadeUp} transition={{ duration: 0.7, delay: 0.2 }} className="mt-5 text-lg text-muted-foreground max-w-xl">
            Clients track their own holdings with real-time profit & loss. Portfolio
            managers monitor every assigned client from a single dashboard.
          </motion.p>
          <motion.div {...fadeUp} transition={{ duration: 0.7, delay: 0.3 }} className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="group">
              <Link to="/auth" search={{ mode: "signup", role: "client" }}>
                I'm a Client
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "signup", role: "manager" }}>I'm a Portfolio Manager</Link>
            </Button>
          </motion.div>
        </motion.div>

        <div className="mt-24 grid sm:grid-cols-3 gap-4">
          {[
            { icon: TrendingUp, title: "Live P&L", body: "Real-time market values calculated on every visit. Buy price, current value, return %." },
            { icon: Users, title: "Manager dashboards", body: "Onboard clients via invite link. View each portfolio with live data." },
            { icon: ShieldCheck, title: "Role-based access", body: "Clients edit only their own holdings. Managers get view-only access." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="rounded-xl border bg-card/80 backdrop-blur p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 font-medium">{f.title}</div>
              <div className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.body}</div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
