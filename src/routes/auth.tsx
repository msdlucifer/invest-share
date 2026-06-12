import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Logo } from "@/components/logo";

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
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");

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
        setStep("otp");
        toast.success("We sent a 6-digit code to your email");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "signup" });
      if (error) throw error;
      toast.success("Email verified!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      toast.success("New code sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative overflow-hidden">
      {/* Animated background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.18 250 / 0.35), transparent 70%)" }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.16 300 / 0.25), transparent 70%)" }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="hidden lg:flex flex-col justify-between p-10 bg-accent/40 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Logo />
        </Link>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-2xl font-medium leading-snug max-w-md tracking-tight">
            "Clean numbers, live prices, and one dashboard for every client portfolio."
          </p>
          <p className="mt-4 text-sm text-muted-foreground">Built for Indian markets · NSE & BSE</p>
        </motion.div>
        <div className="text-xs text-muted-foreground">© Folio</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Back button */}
          <button
            type="button"
            onClick={() => (step === "otp" ? setStep("form") : history.back())}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
              >
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
                        className={`px-3 py-1.5 text-sm rounded capitalize transition-all ${
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
                    {loading ? "Please wait…" : mode === "login" ? "Log in" : "Continue"}
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
              </motion.div>
            ) : (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.25 }}
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                  <MailCheck className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it below to verify your account.
                </p>

                <form onSubmit={onVerify} className="mt-6 space-y-4">
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                    {loading ? "Verifying…" : "Verify & continue"}
                  </Button>
                </form>

                <p className="mt-6 text-sm text-muted-foreground text-center">
                  Didn't receive it?{" "}
                  <button onClick={resendCode} className="text-primary hover:underline">Resend code</button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
