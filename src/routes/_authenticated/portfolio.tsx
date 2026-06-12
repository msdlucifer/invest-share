import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PortfolioView } from "@/components/portfolio-view";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({ meta: [{ title: "My Portfolio — Folio" }] }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { profile, loading } = useProfile();
  return (
    <AppShell>
      {loading || !profile ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <PortfolioView
          userId={profile.id}
          title="My Portfolio"
          subtitle="Live NSE & BSE prices, updated every 30s."
        />
      )}
    </AppShell>
  );
}
