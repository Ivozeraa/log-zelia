import { useContext } from "react"
import { AuthContext } from "../contexts/AuthContextImpl"

export function useAuth() {
  return useContext(AuthContext)
}
