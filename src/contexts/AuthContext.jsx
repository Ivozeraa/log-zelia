import { useRef, useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { AuthContext } from "./AuthContextImpl";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  async function loadUser() {
    if (loadingRef.current) return;
    try {
      loadingRef.current = true;
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Erro auth.getSession:", sessionError);
        setUser(null);
        return;
      }

      if (!session?.user) {
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
      loadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event);

      if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
        return;
      }

      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        loadingRef.current = false;
        await loadUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: loadUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
