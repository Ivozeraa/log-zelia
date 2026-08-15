import { useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabase";
import { AuthContext } from "./AuthContextImpl";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (authUser, { blocking = false } = {}) => {
    if (!authUser) {
      setUser(null);
      if (blocking) setLoading(false);
      return;
    }

    if (blocking) setLoading(true);

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
    } finally {
      if (blocking) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const handleSession = async (session, blocking = false) => {
      if (!mounted) return;
      if (!session?.user) {
        setUser(null);
        if (blocking) setLoading(false);
        return;
      }
      await loadUser(session.user, { blocking });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const blocking = event === "INITIAL_SESSION" && !initialized;
      initialized = true;

      if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
        return;
      }

      void handleSession(session, blocking);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || initialized) return;
      initialized = true;
      void handleSession(session, true);
    });

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

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: () => loadUser(user, { blocking: false }), logout }}>
      {children}
    </AuthContext.Provider>
  );
}
