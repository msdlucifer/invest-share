import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PortfolioView } from "@/components/portfolio-view";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  head: () => ({ meta: [{ title: "Client Portfolio — Folio" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = useParams({ from: "/_authenticated/clients/$clientId" });
  const profileQ = useQuery({
    queryKey: ["client-profile", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,name,email")
        .eq("id", clientId)
        .maybeSingle();
      return data;
    },
  });

  return (
    <AppShell>
      <Link to="/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> All clients
      </Link>
      {profileQ.isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : !profileQ.data ? (
        <div className="text-muted-foreground">Client not found or not assigned to you.</div>
      ) : (
        <PortfolioView
          userId={profileQ.data.id}
          readOnly
          title={profileQ.data.name}
          subtitle={`${profileQ.data.email} · view-only`}
        />
      )}
    </AppShell>
  );
}
