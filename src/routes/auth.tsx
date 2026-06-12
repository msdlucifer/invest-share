import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LineChart } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
  role: z.enum(["client", "manager"]).optional(),
  invite: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Folio" }] }),
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "login");
  const [role, setRole] = useState<"client" | "manager">(search.role ?? "client");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState(search.invite ?? "");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              name,
              role,
              invite_code: role === "client" ? invite.trim().toUpperCase() : undefined,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created. Redirecting…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-accent">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LineChart className="h-4 w-4" />
          </span>
          Folio
        </Link>
        <div>
          <p className="text-2xl font-medium leading-snug max-w-md">
            "Clean numbers, live prices, and one dashboard for every client portfolio."
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Built for Indian markets · NSE & BSE</p>
        </div>
        <div className="text-xs text-muted-foreground">© Folio</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Log in to your portfolio."
              : role === "manager"
                ? "Sign up as a portfolio manager."
                : "Sign up as a client."}
          </p>

          {mode === "signup" && (
            <div className="mt-5 grid grid-cols-2 gap-2 p-1 rounded-md bg-muted">
              {(["client", "manager"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-3 py-1.5 text-sm rounded capitalize ${
                    role === r ? "bg-card shadow-sm font-medium" : "text-muted-foreground"
                  }`}
                >
                  {r === "client" ? "Client" : "Portfolio Manager"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {mode === "signup" && role === "client" && (
              <div className="space-y-1.5">
                <Label htmlFor="invite">Manager invite code <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="invite"
                  placeholder="e.g. KRISH123"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value.toUpperCase())}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Don't have an account?{" "}
                <button className="text-primary hover:underline" onClick={() => setMode("signup")}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button className="text-primary hover:underline" onClick={() => setMode("login")}>Log in</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
