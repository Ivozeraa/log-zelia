import { useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { AuthContext } from "./AuthContextImpl";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadUser(authUser) {
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
      setLoading(false);
    }
  }

  useEffect(() => {
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          setUser(null);
          setLoading(false);
          resolved = true;
          return;
        }

        resolved = true;
        setLoading(true);
        loadUser(session.user);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user && !resolved) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: () => {}, logout }}>
      {children}
    </AuthContext.Provider>
  );
}