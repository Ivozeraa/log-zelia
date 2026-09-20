import { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabase";
import { AuthContext } from "./AuthContextImpl";
import { debugError, debugLog, debugQuery } from "../utils/debug";

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
    debugLog("AUTH", "loadUser iniciado", { id: authUser?.id, email: authUser?.email });
    if (!authUser) {
      setUser(null);
      return null;
    }

    try {
      const result = await withTimeout(
        debugQuery("AUTH", "carregar perfil usuarios", supabase
          .from("usuarios")
          .select("id, nome, role_id, escola_id, pdt")
          .eq("id", authUser.id)
          .maybeSingle()),
        AUTH_INIT_TIMEOUT_MS,
        "Tempo limite ao carregar perfil do usuário.",
      );

      const { data: perfil, error: perfilError } = result;

      if (perfilError) {
        debugError("AUTH", "Erro buscando perfil", perfilError);
      }

      if (perfil?.escola_id && Number(perfil.role_id) !== 1) {
        const { data: escola, error: escolaError } = await withTimeout(
          debugQuery("AUTH", "verificar escola ativa", supabase
            .from("escolas")
            .select("id, ativo")
            .eq("id", perfil.escola_id)
            .maybeSingle()),
          AUTH_INIT_TIMEOUT_MS,
          "Tempo limite ao verificar o status da escola.",
        );

        if (escolaError) {
          debugError("AUTH", "Erro verificando status da escola", escolaError);
        } else if (escola && escola.ativo === false) {
          await supabase.auth.signOut({ scope: "local" });
          setUser(null);
          return null;
        }
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
      debugLog("AUTH", "loadUser concluído", { role_id: nextUser.role_id, escola_id: nextUser.escola_id });
      return nextUser;
    } catch (err) {
      debugError("AUTH", "Erro em loadUser", err);

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
        debugLog("AUTH", "inicialização: getSession");
        const result = await withTimeout(
          supabase.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          "Tempo limite ao inicializar a sessão.",
        );
        const {
          data: { session },
          error,
        } = result;

        if (error) debugError("AUTH", "Erro obtendo sessão", error);
        if (!mounted) return;

        initialized = true;

        if (session?.user) {
          await loadUser(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        debugError("AUTH", "Erro inicializando autenticação", err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void initializeAuth();

    debugLog("AUTH", "listener onAuthStateChange registrado");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        debugLog("AUTH", `evento de autenticação: ${event}`, { hasSession: Boolean(session) });
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
