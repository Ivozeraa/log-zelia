import { useEffect, useState } from "react"
import { supabase } from "../utils/supabase"

export function useCurrentUserImage(){

  const [image,setImage] = useState(null)

  useEffect(()=>{

    async function load(){

      const { data } = await supabase.auth.getUser()

      setImage(data.user?.user_metadata?.avatar_url)
    }

    load()

  },[])

  return image
}