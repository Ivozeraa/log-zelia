import { useEffect, useState } from "react"
import { supabase } from "../utils/supabase"

export function useCurrentUserName(){

  const [name,setName] = useState("")

  useEffect(()=>{

    async function load(){

      const { data } = await supabase.auth.getUser()

      setName(data.user?.user_metadata?.name)
    }

    load()

  },[])

  return name
}