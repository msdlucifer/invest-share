import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LineChart } from "lucide-react";

export const Route = createFileRoute("/invite/$code")({
  head: () => ({ meta: [{ title: "Join via invite — Folio" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { code } = useParams({ from: "/invite/$code" });
  const [managerName, setManagerName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("lookup_invite", { _code: code });
      if (error || !data || data.length === 0) {
        setManagerName(null);
        return;
      }
      setManagerName(data[0].manager_name ?? "your portfolio manager");
    })();
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground mb-6">
          <LineChart className="h-5 w-5" />
        </div>
        {managerName === undefined && <p className="text-muted-foreground">Looking up invite…</p>}
        {managerName === null && (
          <>
            <h1 className="text-2xl font-semibold">Invite not found</h1>
            <p className="mt-2 text-muted-foreground">The code <code className="font-mono">{code}</code> isn't valid.</p>
            <Button asChild className="mt-6"><Link to="/">Go home</Link></Button>
          </>
        )}
        {managerName && managerName !== null && (
          <>
            <h1 className="text-2xl font-semibold">You've been invited by {managerName}</h1>
            <p className="mt-2 text-muted-foreground">
              Sign up as a client and your portfolio will be linked to {managerName} automatically.
            </p>
            <Button asChild className="mt-6" size="lg">
              <Link to="/auth" search={{ mode: "signup", role: "client", invite: code.toUpperCase() }}>
                Create my account
              </Link>
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Already have an account? <Link to="/auth" className="text-primary hover:underline">Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
