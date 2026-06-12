import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invite")({
  head: () => ({ meta: [{ title: "Invite — Folio" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { profile } = useProfile();
  const [copied, setCopied] = useState<string | null>(null);

  const codeQ = useQuery({
    queryKey: ["manager-code", profile?.id],
    enabled: !!profile && profile.role === "manager",
    queryFn: async () => {
      const { data } = await supabase
        .from("managers")
        .select("invite_code")
        .eq("user_id", profile!.id)
        .maybeSingle();
      return data?.invite_code ?? null;
    },
  });

  const inviteLink =
    typeof window !== "undefined" && codeQ.data ? `${window.location.origin}/invite/${codeQ.data}` : "";

  const copy = async (val: string, key: string) => {
    await navigator.clipboard.writeText(val);
    setCopied(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Your invite link</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Share this link with clients. Anyone who signs up through it is automatically linked to you.
        </p>

        {codeQ.isLoading ? (
          <div className="mt-6 text-muted-foreground">Loading…</div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-lg border bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Invite code</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-mono text-2xl font-semibold tracking-wider">{codeQ.data}</span>
                <Button size="sm" variant="outline" onClick={() => copy(codeQ.data!, "code")}>
                  {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Invite link</div>
              <div className="mt-2 flex items-center gap-2">
                <Input readOnly value={inviteLink} className="font-mono text-sm" />
                <Button size="sm" onClick={() => copy(inviteLink, "link")}>
                  {copied === "link" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  Copy
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-accent/40 p-4 text-sm text-muted-foreground">
              When a client signs up through your link, they're automatically added to your client list — no manual approval needed.
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
