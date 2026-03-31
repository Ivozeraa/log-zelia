import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "../utils/supabase"

const AuthContext = createContext()

export function AuthProvider({ children }) {

  const [user,setUser] = useState(null)
  const [loading,setLoading] = useState(true)

  useEffect(()=>{

    async function loadUser(){

      const { data } = await supabase.auth.getUser()

      if(!data.user){
        setLoading(false)
        return
      }

      const authUser = data.user

      const { data: perfil } = await supabase
        .from("usuarios")
        .select("nome, role_id, escola_id")
        .eq("id", authUser.id)
        .single()

      setUser({
        id: authUser.id,
        ...perfil
      })

      setLoading(false)
    }

    loadUser()

  },[])

  return (
    <AuthContext.Provider value={{user,loading}}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)