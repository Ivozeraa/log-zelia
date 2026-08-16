import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import logo from "../../assets/images/logo.png"
import { UserSidebar } from "../user/UserSidebar"
import { Sidebar } from "./Sidebar"
import { FaBell, FaBars, FaComments } from "react-icons/fa"
import { CurrentUserAvatar } from "../user/CurrentUserAvatar"
import { useCurrentUserName } from "../../hooks/useCurrentUserName"
import { useNotificacoes } from "../../hooks/useNotifcations"

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
  const name = useCurrentUserName()
  const navigate = useNavigate()
  const { notificacoes, naoLidas, marcarComoLida, marcarTodasComoLidas } = useNotificacoes()

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

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-gray-200 bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-700 dark:bg-slate-950/95 sm:px-5 md:px-6">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setOpenMenu((prev) => !prev)} className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-lg text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:text-white dark:hover:bg-slate-800 md:hidden" aria-label={openMenu ? "Fechar menu" : "Abrir menu"} aria-expanded={openMenu}><FaBars /></button>
            <img className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" src={logo} alt="Logo Log Zélia" width="40" height="40" />
            <p className="truncate font-bold font-montserrat text-lg leading-none text-green-700 sm:text-xl md:text-2xl">LOG <span className="text-orange-500 dark:text-orange-600">ZÉLIA</span></p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 md:gap-5">
            {Number(user?.role_id) === 1 && <button type="button" onClick={() => navigate("/app/feedbacks")} className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg text-slate-600 transition hover:bg-slate-100 hover:text-green-700 active:scale-95 dark:text-white dark:hover:bg-slate-800" aria-label="Feedbacks da landing" title="Feedbacks da landing"><FaComments /></button>}
            <div className="relative" ref={sinoRef}>
              <button type="button" onClick={() => setOpenSino((prev) => !prev)} className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-white dark:hover:bg-slate-800 dark:hover:text-slate-300" aria-label="Notificações" aria-expanded={openSino}><FaBell />{naoLidas > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">{naoLidas > 9 ? "9+" : naoLidas}</span>}</button>
              {openSino && <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1.5rem)] max-w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Notificações</span>{naoLidas > 0 && <button type="button" onClick={marcarTodasComoLidas} className="text-xs text-blue-600 hover:underline dark:text-blue-400">Marcar todas como lidas</button>}</div><div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">{notificacoes.length === 0 ? <div className="px-4 py-8 text-center"><p className="mb-2 text-2xl">🔔</p><p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma notificação</p></div> : notificacoes.map((n) => <div key={n.id} onClick={() => handleClickNotificacao(n)} className={`flex items-start gap-3 px-4 py-3 transition ${n.lida ? "bg-white dark:bg-slate-900" : "bg-amber-50 dark:bg-amber-950/30"} ${n.aluno_id ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" : ""}`}><span className="mt-0.5 shrink-0 text-base leading-none">⚠️</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><p className="text-xs font-semibold leading-snug text-slate-800 dark:text-slate-200">{n.mensagem}</p><p className="text-[11px] text-slate-400 dark:text-slate-500">{formatarTempo(n.criado_em)}</p></div>{!n.lida && <button type="button" onClick={(e) => { e.stopPropagation(); marcarComoLida(n.id) }} title="Marcar como lida" aria-label="Marcar como lida" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />}</div>)}</div>{notificacoes.length > 0 && <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50"><p className="text-center text-[11px] text-slate-400 dark:text-slate-500">{naoLidas > 0 ? `${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}` : "Tudo em dia ✓"}</p></div>}</div>}
            </div>
            <button type="button" className="flex min-w-0 items-center gap-2 rounded-xl p-1 transition hover:bg-slate-100 active:scale-[0.98] dark:hover:bg-slate-800" onClick={() => setOpenUser((prev) => !prev)} aria-label="Abrir perfil"><p className="hidden max-w-36 truncate text-sm dark:text-white sm:block md:max-w-52 md:text-base">{user?.nome || name || "Usuário"}</p><CurrentUserAvatar /></button>
          </div>
        </div>
      </header>
      <UserSidebar open={openUser} setOpen={setOpenUser} />
      <Sidebar open={openMenu} setOpen={setOpenMenu} />
    </>
  )
}
