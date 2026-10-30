import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../utils/supabase";
import { AuthContext } from "./AuthContextImpl";
import { debugError, debugLog, debugQuery } from "../utils/debug";
import { clearCached } from "../utils/requestCache";

const AUTH_INIT_TIMEOUT_MS = 10000;

const withTimeout = (promise, timeoutMs, message) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => window.clearTimeout(timer));
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const signingInRef = useRef(false);
  const loadedUserIdRef = useRef(null);
  const pendingProfileRef = useRef(null);

  const loadUser = useCallback(async (authUser) => {
    if (!authUser) {
      loadedUserIdRef.current = null;
      setUser(null);
      return null;
    }

    // Reutiliza a consulta que estiver em andamento para o mesmo usuário.
    if (pendingProfileRef.current?.id === authUser.id) {
      return pendingProfileRef.current.promise;
    }

    const performLoad = async () => {
      debugLog("AUTH", "loadUser iniciado", { id: authUser.id });
      try {
      let schoolDetails = null;
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
            .select("id, nome, cidade, created_at, ativo")
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
        schoolDetails = escola || null;
      }

      const nextUser = {
        id: authUser.id,
        nome: perfil?.nome || authUser.user_metadata?.name || "Usuário",
        role_id: perfil?.role_id ?? null,
        escola_id: perfil?.escola_id ?? null,
        pdt: perfil?.pdt ?? false,
        schoolDetails,
        email: authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url || null,
      };

      setUser(nextUser);
      loadedUserIdRef.current = !perfilError && perfil ? authUser.id : null;
      debugLog("AUTH", "loadUser concluído", { role_id: nextUser.role_id, escola_id: nextUser.escola_id });
      return nextUser;
    } catch (err) {
      loadedUserIdRef.current = null;
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
    };

    const promise = performLoad();
    pendingProfileRef.current = { id: authUser.id, promise };
    try {
      return await promise;
    } finally {
      if (pendingProfileRef.current?.promise === promise) pendingProfileRef.current = null;
    }
  }, []);

  const verifySession = useCallback(async () => {
    // getSession já renova tokens expirados quando necessário; getUser faz a
    // única validação remota da identidade antes de carregar o perfil.
    const { data: sessionData, error: sessionError } = await withTimeout(
      supabase.auth.getSession(), AUTH_INIT_TIMEOUT_MS, "Tempo limite ao verificar a sessão."
    );
    if (sessionError) throw sessionError;
    if (!sessionData?.session) {
      loadedUserIdRef.current = null;
      setUser(null);
      return null;
    }

    const { data, error } = await withTimeout(
      supabase.auth.getUser(), AUTH_INIT_TIMEOUT_MS, "Tempo limite ao confirmar o usuário."
    );
    if (error || !data?.user) {
      await supabase.auth.signOut({ scope: "local" });
      loadedUserIdRef.current = null;
      setUser(null);
      return null;
    }
    return loadUser(data.user);
  }, [loadUser]);

  const signIn = useCallback(async (email, password) => {
    signingInRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data?.user) return { data, error };

      // Este mesmo login dispara SIGNED_IN; o listener ignora esse evento
      // enquanto a operação está ativa, evitando duas consultas ao perfil.
      await loadUser(data.user);
      return { data, error: null };
    } finally {
      signingInRef.current = false;
    }
  }, [loadUser]);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const initializeAuth = async () => {
      try {
        debugLog("AUTH", "inicialização: getSession");
        const result = await withTimeout(
          debugQuery("AUTH", "obter sessão inicial", supabase.auth.getSession()),
          AUTH_INIT_TIMEOUT_MS,
          "Tempo limite ao inicializar a sessão.",
        );
        const {
          data: { session },
          error,
        } = result;

        if (error) debugError("AUTH", "Erro obtendo sessão", error);
        if (!mounted) return;

        if (session?.user) {
          // Só confirmar uma vez com Auth Server; nenhuma renovação forçada.
          const { data: verified, error: authError } = await withTimeout(
            supabase.auth.getUser(), AUTH_INIT_TIMEOUT_MS,
            "Tempo limite ao confirmar a sessão inicial."
          );
          if (authError || !verified?.user) {
            await supabase.auth.signOut({ scope: "local" });
            if (mounted) setUser(null);
          } else if (mounted) {
            await loadUser(verified.user);
          }
        } else {
          setUser(null);
        }

        initialized = true;
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
          loadedUserIdRef.current = null;
          clearCached();
          setUser(null);
          setLoading(false);
          return;
        }

        // INITIAL_SESSION já é tratado por initializeAuth. Ignorar aqui
        // evita uma segunda consulta ao perfil durante a abertura do app.
        if (event === "INITIAL_SESSION") return;
        // Focar novamente na aba pode emitir SIGNED_IN sem troca de usuário.
        // Não consultar o mesmo perfil novamente se ele já foi carregado.
        if (event === "SIGNED_IN" && (signingInRef.current || loadedUserIdRef.current === session?.user?.id)) return;
        if (!session?.user) return;

        // TOKEN_REFRESHED renova o JWT, mas não altera o perfil do usuário.
        // Evitamos uma nova consulta ao banco sem necessidade.
        if (event === "TOKEN_REFRESHED") return;

        if (initialized || event === "SIGNED_IN" || event === "USER_UPDATED") {
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
      loadedUserIdRef.current = null;
      clearCached();
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
