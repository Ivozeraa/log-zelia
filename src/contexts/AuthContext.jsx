import { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabase";
import { AuthContext } from "./AuthContextImpl";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      return;
    }

    try {
      const { data: perfil, error: perfilError } = await supabase
        .from("usuarios")
        .select("id, nome, role_id, escola_id, pdt")
        .eq("id", authUser.id)
        .maybeSingle();

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
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

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

        // A sessão inicial já foi resolvida acima. Eventos posteriores
        // atualizam o perfil sem bloquear a aplicação inteira novamente.
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
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
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
