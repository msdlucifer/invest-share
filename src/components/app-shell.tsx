import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { LogOut, Users, Briefcase, Link as LinkIcon, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/logo";
import { motion } from "framer-motion";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const canGoBack =
    pathname !== "/" &&
    pathname !== "/dashboard" &&
    pathname !== "/portfolio" &&
    pathname !== "/clients" &&
    pathname !== "/clients/";

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => router.history.back()}
              disabled={!canGoBack}
              aria-label="Go back"
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link to="/" className="flex items-center">
              <Logo />
            </Link>
          </div>

          <nav className="flex items-center gap-1 text-sm">
            {profile?.role === "client" && (
              <Link
                to="/portfolio"
                className="px-3 py-1.5 rounded-md hover:bg-accent text-muted-foreground"
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
      <motion.main
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6"
      >
        {children}
      </motion.main>
    </div>
  );
}
