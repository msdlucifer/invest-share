import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { LineChart, LogOut, Users, Briefcase, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useQueryClient } from "@tanstack/react-query";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LineChart className="h-4 w-4" />
            </span>
            <span className="tracking-tight">Folio</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {profile?.role === "client" && (
              <Link
                to="/portfolio"
                className="px-3 py-1.5 rounded-md hover:bg-accent text-muted-foreground data-[status=active]:text-foreground data-[status=active]:bg-accent"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                <span className="inline-flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> Portfolio</span>
              </Link>
            )}
            {profile?.role === "manager" && (
              <>
                <Link
                  to="/clients"
                  className="px-3 py-1.5 rounded-md hover:bg-accent text-muted-foreground"
                  activeProps={{ className: "bg-accent text-foreground" }}
                >
                  <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> Clients</span>
                </Link>
                <Link
                  to="/invite"
                  className="px-3 py-1.5 rounded-md hover:bg-accent text-muted-foreground"
                  activeProps={{ className: "bg-accent text-foreground" }}
                >
                  <span className="inline-flex items-center gap-1.5"><LinkIcon className="h-4 w-4" /> Invite</span>
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden sm:flex flex-col text-right leading-tight">
                <span className="text-sm font-medium">{profile.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{profile.role}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
