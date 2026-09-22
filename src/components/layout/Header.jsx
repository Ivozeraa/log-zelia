import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import { useSchool } from "../../hooks/useSchool"
import logo from "../../assets/images/logo.png"
import { UserSidebar } from "../user/UserSidebar"
import { Sidebar } from "./Sidebar"
import { FaBell, FaBars, FaComments } from "react-icons/fa"
import { CurrentUserAvatar } from "../user/CurrentUserAvatar"
import { useCurrentUserName } from "../../hooks/useCurrentUserName"
import { useNotificacoes } from "../../hooks/useNotifcations"
import { useSchoolFeatures } from "../../hooks/useSchoolFeatures"
import { useSchoolConfig } from "../../hooks/useSchoolConfig"
import { usePlatformConfig } from "../../hooks/usePlatformConfig"

const formatarTempo = (isoString) => {
  if (!isoString) return ""
  const diff = Date.now() - new Date(isoString).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "agora"
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

export function Header() {
  const { user } = useAuth()
  const { school } = useSchool()
  const { config: schoolConfig } = useSchoolConfig()
  const { config: platformConfig } = usePlatformConfig()
  const { hasFeature } = useSchoolFeatures()
  const name = useCurrentUserName()
  const navigate = useNavigate()
  const { notificacoes, naoLidas, marcarComoLida, marcarTodasComoLidas } = useNotificacoes()
  const notificationsEnabled = hasFeature("notificacoes")

  const [openUser, setOpenUser] = useState(false)
  const [openMenu, setOpenMenu] = useState(false)
  const [openSino, setOpenSino] = useState(false)
  const sinoRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (sinoRef.current && !sinoRef.current.contains(e.target)) setOpenSino(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleClickNotificacao(n) {
    if (!n.aluno_id) return
    marcarComoLida(n.id)
    setOpenSino(false)
    navigate("/app/advertencias", { state: { alunoId: n.aluno_id } })
  }

  const schoolName = school?.nome || "LogView"
  const brandParts = (() => {
    const value = platformConfig.nome_aplicacao?.trim() || "LogView"
    const match = value.match(/^(.+?)(?:\s+|(?=[A-ZÁÉÍÓÚÀÂÃÊÔÕÜÇ]))(.+)$/u)
    return match ? [match[1].trim(), match[2].trim()] : [value, ""]
  })()
