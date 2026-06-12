import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, Users, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — Folio" }] }),
  component: ClientsPage,
});

type ClientRow = { id: string; name: string; email: string; holdings: number };

function ClientsPage() {
  const { profile } = useProfile();
  const [q, setQ] = useState("");

  const clientsQ = useQuery({
    queryKey: ["manager-clients", profile?.id],
    enabled: !!profile && profile.role === "manager",
    queryFn: async (): Promise<ClientRow[]> => {
      const { data: links, error } = await supabase
        .from("manager_client_map")
        .select("client_id");
      if (error) throw error;
      const ids = (links ?? []).map((l) => l.client_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", ids);
      const { data: holdings } = await supabase
        .from("holdings")
        .select("user_id")
        .in("user_id", ids);
      const counts = new Map<string, number>();
      for (const h of holdings ?? []) counts.set(h.user_id, (counts.get(h.user_id) ?? 0) + 1);
      return (profs ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        holdings: counts.get(p.id) ?? 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    const f = q.trim().toLowerCase();
    return (clientsQ.data ?? []).filter(
      (c) => !f || c.name.toLowerCase().includes(f) || c.email.toLowerCase().includes(f),
    );
  }, [clientsQ.data, q]);

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clientsQ.data?.length ?? 0} assigned client{(clientsQ.data?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {clientsQ.isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (clientsQ.data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-medium">No clients yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Share your invite link to onboard your first client.</p>
          <Link to="/invite" className="mt-4 inline-block text-sm text-primary hover:underline">Get my invite link →</Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-card divide-y">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              className="flex items-center justify-between px-4 py-3 hover:bg-accent/50"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{c.holdings} holding{c.holdings === 1 ? "" : "s"}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
