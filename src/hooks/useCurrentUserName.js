import { useAuth } from "./useAuth"

export function useCurrentUserName(){
  const { user } = useAuth()
  return user?.nome || user?.email || "Usuário"
}