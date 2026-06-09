import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ensureProfile } from "@/services/medusa";
import type { Profile } from "@/types/medusa";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadProfile(s);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s) loadProfile(s);
        else { setProfile(null); setLoading(false); }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(s: Session) {
    try {
      const p = await ensureProfile(s);
      setProfile(p);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, profile, loading, signOut, setProfile };
}
