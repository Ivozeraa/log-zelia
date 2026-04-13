import { useEffect, useState } from "react"
import { supabase } from "../utils/supabase"
import { Navigate } from "react-router-dom"
import { Loading } from "../components/Loading"

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

  if (session === undefined) return <Loading />

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}