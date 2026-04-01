import { useEffect, useState } from "react"
import { supabase } from "../utils/supabase"
import { AuthContext } from "./AuthContextImpl"

export function AuthProvider({ children }) {

  const [user,setUser] = useState(null)
  const [loading,setLoading] = useState(true)

  async function loadUser(){

    const { data, error } = await supabase.auth.getUser()
    if(error){
      console.error("Erro auth.getUser:", error)
      setLoading(false)
      return
    }

    if(!data.user){
      setUser(null)
      setLoading(false)
      return
    }

    const authUser = data.user

    const { data: perfil, error: perfilError } = await supabase
      .from("usuarios")
      .select("nome, role_id, escola_id")
      .eq("id", authUser.id)
      .single()

    if(perfilError && perfilError.code !== "42703"){
      console.error("Erro buscando perfil:", perfilError)
    }

    const finalName = perfil?.nome || authUser.user_metadata?.name || authUser.email || "Usuário"
    const finalAvatar = authUser.user_metadata?.avatar_url || (perfil && perfil.avatar_url) || null

    setUser({
      id: authUser.id,
      nome: finalName,
      role_id: perfil?.role_id || null,
      escola_id: perfil?.escola_id || null,
      email: authUser.email,
      avatar_url: finalAvatar,
    })

    setLoading(false)
  }

  useEffect(()=>{
    const init = async () => {
      await loadUser()
    }

    init()

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => {
      authListener?.subscription?.unsubscribe?.()
    }
  },[])

  return (
    <AuthContext.Provider value={{user,loading,refreshUser: loadUser}}>
      {children}
    </AuthContext.Provider>
  )
}