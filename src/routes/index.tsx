import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LineChart, ShieldCheck, TrendingUp, Users } from "lucide-react";

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

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LineChart className="h-4 w-4" />
            </span>
            Folio
          </div>
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

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live NSE & BSE prices
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight">
            Portfolio management,<br /> built for clarity.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl">
            Clients track their own holdings with real-time profit & loss. Portfolio
            managers monitor every assigned client from a single dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup", role: "client" }}>I'm a Client</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "signup", role: "manager" }}>I'm a Portfolio Manager</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid sm:grid-cols-3 gap-4">
          {[
            { icon: TrendingUp, title: "Live P&L", body: "Real-time market values calculated on every visit. Buy price, current value, return %." },
            { icon: Users, title: "Manager dashboards", body: "Onboard clients via invite link. View each portfolio with live data." },
            { icon: ShieldCheck, title: "Role-based access", body: "Clients edit only their own holdings. Managers get view-only access." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <div className="mt-3 font-medium">{f.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
