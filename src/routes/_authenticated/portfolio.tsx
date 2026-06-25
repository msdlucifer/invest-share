import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { PortfolioView } from "@/components/portfolio-view";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { linkToManager } from "@/lib/link-manager.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({ meta: [{ title: "My Portfolio — Folio" }] }),
  component: PortfolioPage,
});

function ManagerLinkBanner({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const linkFn = useServerFn(linkToManager);
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const mgrQ = useQuery({
    queryKey: ["my-manager", userId],
    queryFn: async () => {
      const { data: link } = await supabase
        .from("manager_client_map")
        .select("manager_id")
        .eq("client_id", userId)
        .maybeSingle();
      if (!link) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("name,email")
        .eq("id", link.manager_id)
        .maybeSingle();
      return prof;
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await linkFn({ data: { code } });
      toast.success("Linked to manager");
      setCode("");
      qc.invalidateQueries({ queryKey: ["my-manager", userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (mgrQ.isLoading) return null;

  if (mgrQ.data) {
    return (
      <div className="mb-4 rounded-md border bg-accent/50 px-4 py-2.5 flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-profit" />
        <span>Your portfolio is shared with <strong>{mgrQ.data.name}</strong> ({mgrQ.data.email}).</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-md border bg-card px-4 py-3 flex items-center gap-2 flex-wrap">
      <Link2 className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">Connect to a portfolio manager:</span>
      <Input
        className="h-8 max-w-[180px] font-mono uppercase"
        placeholder="INVITE CODE"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
      />
      <Button type="submit" size="sm" disabled={saving || !code.trim()}>
        {saving ? "Linking…" : "Link"}
      </Button>
    </form>
  );
}

function PortfolioPage() {
  const { profile, loading } = useProfile();
  return (
    <AppShell>
      {loading || !profile ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <>
          <ManagerLinkBanner userId={profile.id} />
          <PortfolioView
            userId={profile.id}
            title="My Portfolio"
            subtitle="Equity, bonds and commodities. Live prices updated every 30s."
          />
        </>
      )}
    </AppShell>
  );
}
