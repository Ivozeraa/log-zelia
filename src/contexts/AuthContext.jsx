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
      return;
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

      setUser({
        id: authUser.id,
        nome: perfil?.nome || authUser.user_metadata?.name || "Usuário",
        role_id: perfil?.role_id ?? null,
        escola_id: perfil?.escola_id ?? null,
        pdt: perfil?.pdt ?? false,
        email: authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url || null,
      });
    } catch (err) {
      console.error("Erro em loadUser:", err);

      // Mantém a sessão disponível mesmo que a consulta ao perfil falhe.
      setUser({
        id: authUser.id,
        nome: authUser.user_metadata?.name || "Usuário",
        role_id: null,
        escola_id: null,
        pdt: false,
        email: authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url || null,
      });
    }
  }, []);

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
        const { data: { session }, error } = result;

        if (error) {
          console.error("Erro obtendo sessão:", error);
        }

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
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
