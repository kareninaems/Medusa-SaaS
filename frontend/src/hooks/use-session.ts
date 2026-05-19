import { useCallback, useEffect, useState } from "react";

import { api } from "@/src/services/api";
import { User } from "@/src/types/app";
import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "medusa-session-token";

export function useSession() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    setLoading(true);
    const storedToken = await storage.secureGet(TOKEN_KEY, "");
    if (!storedToken) {
      setToken(null);
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await api.me(storedToken);
      setToken(storedToken);
      setUser(profile);
    } catch {
      await storage.secureRemove(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const applyAuth = useCallback(async (nextToken: string, nextUser: User) => {
    await storage.secureSet(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const latest = await api.me(token);
    setUser(latest);
  }, [token]);

  const signOut = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return {
    token,
    user,
    loading,
    applyAuth,
    refreshUser,
    signOut,
  };
}
