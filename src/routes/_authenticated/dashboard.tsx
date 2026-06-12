import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRouter,
});

function DashboardRouter() {
  const { profile, loading } = useProfile();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>
    );
  }
  if (!profile) return <Navigate to="/auth" />;
  if (profile.role === "manager") return <Navigate to="/clients" />;
  return <Navigate to="/portfolio" />;
}
