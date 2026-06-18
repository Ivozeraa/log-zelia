import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import logo from "../../assets/images/logo.png"
import { UserSidebar } from "../user/UserSidebar"
import { Sidebar } from "./Sidebar"
import { FaBell, FaBars } from "react-icons/fa"
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
      if (sinoRef.current && !sinoRef.current.contains(e.target)) {
        setOpenSino(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleClickNotificacao(n) {
    if (!n.aluno_id) return
    marcarComoLida(n.id)
    setOpenSino(false)
    navigate("/advertencias", { state: { alunoId: n.aluno_id } })
  }

  return (
    <>
      <header className="h-16 flex justify-between items-center fixed w-full px-6 border-b-2 border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-950 z-50">

        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpenMenu(!openMenu)}
            className="md:hidden text-xl cursor-pointer dark:text-white"
          >
            <FaBars />
          </button>

          <img className="w-12" src={logo} alt="Logo Log Zélia" />

          <p className="font-bold font-montserrat text-2xl text-green-700 leading-none">
            LOG <span className="text-orange-500 dark:text-orange-600">ZÉLIA</span>
          </p>
        </div>

        <div className="flex gap-6 items-center">

          <div className="relative" ref={sinoRef}>
            <button
              onClick={() => setOpenSino((prev) => !prev)}
              className="relative flex items-center justify-center text-xl text-slate-600 dark:text-white hover:text-slate-900 dark:hover:text-slate-300 transition"
              aria-label="Notificações"
            >
              <FaBell />
              {naoLidas > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                  {naoLidas > 9 ? "9+" : naoLidas}
                </span>
              )}
            </button>

            {openSino && (
              <div className="absolute right-0 top-full mt-3 w-80 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden z-50">

                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Notificações
                  </span>
                  {naoLidas > 0 && (
                    <button
                      onClick={marcarTodasComoLidas}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline transition"
                    >
                      Marcar todas como lidas
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notificacoes.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-2xl mb-2">🔔</p>
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        Nenhuma notificação
                      </p>
                    </div>
                  ) : (
                    notificacoes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleClickNotificacao(n)}
                        className={`flex items-start gap-3 px-4 py-3 transition ${
                          n.lida
                            ? "bg-white dark:bg-slate-900"
                            : "bg-amber-50 dark:bg-amber-950/30"
                        } ${
                          n.aluno_id
                            ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            : ""
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 text-base leading-none">
                          ⚠️
                        </span>

                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                            {n.mensagem}
                          </p>
                          
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            {formatarTempo(n.criado_em)}
                          </p>
                        </div>

                        {!n.lida && (
                          <button
                            onClick={(e) => { e.stopPropagation(); marcarComoLida(n.id) }}
                            title="Marcar como lida"
                            className="shrink-0 mt-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {notificacoes.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                      {naoLidas > 0
                        ? `${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}`
                        : "Tudo em dia ✓"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setOpenUser(!openUser)}
          >
            <p className="hidden sm:block text-base dark:text-white">
              {user?.nome || name || "Usuário"}
            </p>
            <CurrentUserAvatar />
          </div>
        </div>
      </header>

      <UserSidebar open={openUser} setOpen={setOpenUser} />
      <Sidebar open={openMenu} setOpen={setOpenMenu} />
    </>
  )
}