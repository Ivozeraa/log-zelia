import { useEffect, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { FaRegUserCircle, FaUserEdit, FaSignOutAlt } from "react-icons/fa"
import { Modal } from "../ui/Modal"
import { Button } from "../ui/Button"
import { EditProfile } from "./EditProfile"
import { supabase } from "../../utils/supabase"

const achievements = [
  {
    threshold: 10,
    icon: "🥉",
    title: "Vigilante",
    desc: "Começou a acompanhar com atenção",
    linear: "from-amber-100 to-orange-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    threshold: 30,
    icon: "🥈",
    title: "Guardião",
    desc: "Demonstra comprometimento contínuo",
    linear: "from-slate-100 to-gray-50",
    border: "border-slate-300",
    badge: "bg-slate-100 text-slate-600",
  },
  {
    threshold: 50,
    icon: "🥇",
    title: "Sentinela",
    desc: "Referência em disciplina escolar",
    linear: "from-yellow-100 to-amber-50",
    border: "border-yellow-300",
    badge: "bg-yellow-100 text-yellow-700",
  },
  {
    threshold: 100,
    icon: "💎",
    title: "Mestre da Ordem",
    desc: "Nível máximo de dedicação",
    linear: "from-blue-100 to-indigo-50",
    border: "border-blue-300",
    badge: "bg-blue-100 text-blue-700",
  },
]

export const UserSidebar = ({ open, setOpen }) => {
  const { user, logout } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [ocorrenciasCount, setOcorrenciasCount] = useState(0)

  useEffect(() => {
    if (open || isModalOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }
    return () => {
      document.body.style.overflow = "auto"
    }
  }, [open, isModalOpen])

  useEffect(() => {
    if (!open || !user?.id) return
    supabase
      .from("ocorrencias")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", user.id)
      .then(({ count }) => setOcorrenciasCount(count || 0))
  }, [open, user])

  const nextAchievement = achievements.find((a) => ocorrenciasCount < a.threshold)
  const prevThreshold = nextAchievement
    ? (achievements[achievements.indexOf(nextAchievement) - 1]?.threshold ?? 0)
    : achievements.at(-1).threshold
  const progressPct = nextAchievement
    ? Math.min(100, Math.round(((ocorrenciasCount - prevThreshold) / (nextAchievement.threshold - prevThreshold)) * 100))
    : 100

  function handleEditProfile() {
    setIsModalOpen(true)
    setOpen(false)
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-9998 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`
          fixed top-0 right-0 h-screen w-80
          bg-white dark:bg-slate-950 shadow-2xl z-9999
          border-l border-slate-200 dark:border-slate-800
          flex flex-col gap-6 py-10 px-6
          overflow-y-auto
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Avatar + nome */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-green-400 blur-md opacity-30" />
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user?.nome || "Avatar"}
                className="relative w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-slate-900 shadow-md"
              />
            ) : (
              <div className="relative w-20 h-20 rounded-full bg-linear-to-br from-green-100 to-emerald-200 dark:from-green-900 dark:to-emerald-800 flex items-center justify-center ring-4 ring-white dark:ring-slate-900 shadow-md">
                <FaRegUserCircle size={40} className="text-green-700 dark:text-green-300" />
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {user?.nome || "Usuário"}
            </p>
            <span className="inline-block mt-1 text-xs font-medium px-3 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
              {achievements.filter((a) => ocorrenciasCount >= a.threshold).length} / {achievements.length} conquistas
            </span>
          </div>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-2 w-full">
          <Button
            type="button"
            className="flex items-center justify-center gap-2"
            onClick={handleEditProfile}
          >
            <FaUserEdit />
            Editar Perfil
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex items-center justify-center gap-2"
            onClick={logout}
          >
            <FaSignOutAlt />
            Deslogar
          </Button>
        </div>

        {/* Divisor */}
        <div className="w-full border-t border-slate-100 dark:border-slate-800" />

        {/* Conquistas */}
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Conquistas
            </p>
            <p className="text-xs text-slate-400">
              {ocorrenciasCount} ocorrências
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {achievements.map((a) => {
              const unlocked = ocorrenciasCount >= a.threshold
              return (
                <div
                  key={a.threshold}
                  className={`relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-300 overflow-hidden
                    ${unlocked
                      ? `bg-linear-to-r ${a.linear} ${a.border} shadow-sm dark:from-slate-800 dark:to-slate-800/60 dark:border-slate-700`
                      : "border-slate-100 bg-slate-50 opacity-50 dark:border-slate-800 dark:bg-slate-900/40"
                    }`}
                >
                  {/* Brilho decorativo no canto (só desbloqueado) */}
                  {unlocked && (
                    <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/40 dark:bg-white/5 blur-xl pointer-events-none" />
                  )}

                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-sm
                    ${unlocked ? "bg-white dark:bg-slate-700" : "bg-slate-200 dark:bg-slate-800"}`}
                  >
                    {unlocked ? a.icon : "🔒"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold leading-tight
                        ${unlocked ? "text-slate-800 dark:text-white" : "text-slate-400"}`}
                      >
                        {a.title}
                      </p>
                      {unlocked && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.badge} dark:bg-slate-700 dark:text-slate-300`}>
                          ✓ obtido
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-tight mt-0.5 break-word flex">{a.desc}</p>
                  </div>

                  {!unlocked && (
                    <span className="text-xs font-semibold text-slate-400 shrink-0">
                      {a.threshold}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Barra de progresso */}
          {nextAchievement ? (
            <div className="mt-1 rounded-2xl border border-slate-100 bg-linear-to-br from-slate-50 to-white px-4 py-3 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/60 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Próxima: {nextAchievement.icon} {nextAchievement.title}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{nextAchievement.desc}</p>
                </div>
                <span className="text-xs font-bold text-green-600 dark:text-green-400 tabular-nums">
                  {progressPct}%
                </span>
              </div>

              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-linear-to-r from-green-500 to-emerald-400 transition-all duration-700 relative"
                  style={{ width: `${progressPct}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 rounded-full" />
                </div>
              </div>

              <p className="mt-2 text-[10px] text-slate-400 text-right tabular-nums">
                {ocorrenciasCount} / {nextAchievement.threshold} ocorrências
              </p>
            </div>
          ) : (
            <div className="mt-1 rounded-2xl border border-yellow-200 bg-linear-to-br from-yellow-50 to-amber-50 px-4 py-3 dark:border-yellow-900/40 dark:from-yellow-900/20 dark:to-amber-900/10 text-center shadow-sm">
              <p className="text-lg">🏆</p>
              <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mt-0.5">
                Todas as conquistas desbloqueadas!
              </p>
              <p className="text-xs text-yellow-600/70 dark:text-yellow-500/60 mt-0.5">
                Parabéns pela dedicação
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Editar Perfil"
      >
        <EditProfile onClose={() => setIsModalOpen(false)} />
      </Modal>
    </>
  )
}