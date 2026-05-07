import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { AuthContext } from "./AuthContextImpl";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadUser(session) {
    try {
      if (!session?.user) {
        setUser(null);
        return;
      }

      const authUser = session.user;

      const { data: perfil, error } = await supabase
        .from("usuarios")
        .select("nome, role_id, escola_id, pdt")
        .eq("id", authUser.id)
        .single();

      if (error) {
        console.error("Erro perfil:", error);
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
      console.error("Erro loadUser:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      await loadUser(session);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth event:", event);

        if (event === "SIGNED_OUT") {
          setUser(null);
          return;
        }

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          await loadUser(session);
        }
      },
    );

    return () => {
      mounted = false;
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
        refreshUser: async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          await loadUser(session);
        },
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}