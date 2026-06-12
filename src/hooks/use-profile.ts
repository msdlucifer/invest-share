import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: "client" | "manager";
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (active) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id,name,email,role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (active) {
        setProfile(data as Profile | null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { profile, loading };
}
