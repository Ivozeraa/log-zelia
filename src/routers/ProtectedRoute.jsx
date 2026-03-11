import { useEffect, useState } from "react"
import { supabase } from "../utils/supabase"
import { Navigate } from "react-router-dom"

export default function ProtectedRoute({ children }) {

  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}