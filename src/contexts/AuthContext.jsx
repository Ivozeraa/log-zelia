import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { AuthContext } from "./AuthContextImpl";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    try {
      setLoading(true);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Erro auth.getSession:", sessionError);
        setUser(null);
        return;
      }

      if (!session) {
        setUser(null);
        return;
      }

      const authUser = session.user;

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
        nome:
          perfil?.nome ||
          authUser.user_metadata?.name ||
          "Usuário",
        role_id: perfil?.role_id ?? null,
        escola_id: perfil?.escola_id ?? null,
        pdt: perfil?.pdt ?? false,
        email: authUser.email,
        avatar_url:
          authUser.user_metadata?.avatar_url || null,
      });
    } catch (err) {
      console.error("Erro em loadUser:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }

      loadUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser: loadUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}