import { useAuth } from "./useAuth"

export function useCurrentUserImage(){
  const { user } = useAuth()
  return user?.avatar_url || null
}