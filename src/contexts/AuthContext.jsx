import { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabase";
import { AuthContext } from "./AuthContextImpl";

const AUTH_INIT_TIMEOUT_MS = 10000;

const withTimeout = (promise, timeoutMs, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      return null;
    }

    try {
      const result = await withTimeout(
        supabase
          .from("usuarios")
          .select("id, nome, role_id, escola_id, pdt")
          .eq("id", authUser.id)
          .maybeSingle(),
        AUTH_INIT_TIMEOUT_MS,
        "Tempo limite ao carregar perfil do usuário.",
      );

      const { data: perfil, error: perfilError } = result;

      if (perfilError) {
        console.error("Erro buscando perfil:", perfilError);
      }

      const nextUser = {
        id: authUser.id,
        nome: perfil?.nome || authUser.user_metadata?.name || "Usuário",
        role_id: perfil?.role_id ?? null,
        escola_id: perfil?.escola_id ?? null,
        pdt: perfil?.pdt ?? false,
        email: authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url || null,
      };

      setUser(nextUser);
      return nextUser;
    } catch (err) {
      console.error("Erro em loadUser:", err);

      const fallbackUser = {
        id: authUser.id,
        nome: authUser.user_metadata?.name || "Usuário",
        role_id: null,
        escola_id: null,
        pdt: false,
        email: authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url || null,
      };

      setUser(fallbackUser);
      return fallbackUser;
    }
  }, []);

  const verifySession = useCallback(async () => {
    const { data: sessionData, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      AUTH_INIT_TIMEOUT_MS,
      "Tempo limite ao verificar a sessão.",
    );

    if (sessionError) throw sessionError;

    let session = sessionData?.session ?? null;

    // Há uma sessão armazenada: tente renovar o token antes da validação.
    if (session?.refresh_token) {
      const { data: refreshData, error: refreshError } = await withTimeout(
        supabase.auth.refreshSession({
          refresh_token: session.refresh_token,
        }),
        AUTH_INIT_TIMEOUT_MS,
        "Tempo limite ao renovar a sessão.",
      );

      if (refreshError || !refreshData?.session) {
        await supabase.auth.signOut({ scope: "local" });
        setUser(null);
        return null;
      }

      session = refreshData.session;
    }

    if (!session?.user) {
      setUser(null);
      return null;
    }

    // getUser() consulta o Auth Server e confirma que a sessão ainda é válida.
    const { data: userData, error: userError } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_INIT_TIMEOUT_MS,
      "Tempo limite ao confirmar o usuário.",
    );

    if (userError || !userData?.user) {
      await supabase.auth.signOut({ scope: "local" });
      setUser(null);
      return null;
    }

    return await loadUser(userData.user);
  }, [loadUser]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.user) {
      return { data, error };
    }

    await loadUser(data.user);

    return { data, error: null };
  }, [loadUser]);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const initializeAuth = async () => {
      try {
        const result = await withTimeout(
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          "Tempo limite ao inicializar a sessão.",
        );
        const {
          data: { session },
          error,
        } = result;

        if (error) console.error("Erro obtendo sessão:", error);
        if (!mounted) return;

        initialized = true;

        if (session?.user) {
          await loadUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Erro inicializando autenticação:", err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
          return;
        }

        if (!session?.user) return;

        if (initialized || event !== "INITIAL_SESSION") {
          void loadUser(session.user);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUser]);

  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setLoading(false);
    }
  }

  const refreshUser = useCallback(async () => {
    if (!user) return;
    await loadUser(user);
  }, [loadUser, user]);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, verifySession, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
