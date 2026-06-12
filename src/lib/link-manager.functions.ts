import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const linkToManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const code = data.code.trim().toUpperCase();
    if (!code) throw new Error("Invite code required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // verify caller is a client
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof || prof.role !== "client") throw new Error("Only clients can join a manager");

    const { data: mgr } = await supabaseAdmin
      .from("managers")
      .select("user_id")
      .eq("invite_code", code)
      .maybeSingle();
    if (!mgr) throw new Error("Invalid invite code");

    const { error } = await supabaseAdmin
      .from("manager_client_map")
      .upsert(
        { manager_id: mgr.user_id, client_id: context.userId },
        { onConflict: "client_id" },
      );
    if (error) throw new Error(error.message);

    return { ok: true };
  });
