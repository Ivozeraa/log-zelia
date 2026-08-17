import { SidebarOptions as So } from '../ui/SidebarOptions'
import { FaHome, FaExclamationCircle, FaPaste, FaCog, FaWrench, FaCalendarAlt, FaBullhorn } from 'react-icons/fa'
import { useAuth } from '../../hooks/useAuth'
import { useSchool } from '../../hooks/useSchool'
import { SectionTitle } from '../ui/SectionTitle'

export const Sidebar = ({ open, setOpen }) => {
  const { user } = useAuth()
  const { school, isGlobalAdmin } = useSchool()

  const handleClick = () => {
    if (window.innerWidth < 768) {
      setOpen(false)
    }
  }

  const canSeeManagement = [1, 2, 3].includes(user?.role_id)
  const canManageAnnouncements = Number(user?.role_id) === 1
  const canSeeSchedules = Number(user?.role_id) !== 4

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 bg-black/50 z-990 md:hidden ${open ? 'block' : 'hidden'}`}
      />

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-950 border-r-2 border-gray-300 dark:border-slate-700 p-6 pb-4 gap-5 flex flex-col z-1000
          transform transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:top-16 md:h-[calc(100vh-4rem)]
        `}
      >
        <div className="md:hidden">
          <SectionTitle text="Menu" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Contexto
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-white">
            {isGlobalAdmin ? 'Acesso global' : (school?.nome || 'Sua escola')}
          </p>
        </div>

        <So to="/app" end icon={FaHome} text="Início" onClick={handleClick} />
        <So to="/app/advertencias" icon={FaExclamationCircle} text="Advertências" onClick={handleClick} />

        {canSeeSchedules && (
          <So to="/app/horarios" icon={FaCalendarAlt} text="Horários" onClick={handleClick} />
        )}

        {canSeeManagement && (
          <So to="/app/gestao" icon={FaPaste} text="Gestão" onClick={handleClick} />
        )}

        {canManageAnnouncements && (
          <So to="/app/avisos" icon={FaBullhorn} text="Avisos" onClick={handleClick} />
        )}

        <So to="/app/suporte" icon={FaWrench} text="Suporte" onClick={handleClick} />

        <div className="mt-auto border-t-2 border-gray-300 dark:border-slate-700 pt-4">
          <So to="/app/configuracoes" icon={FaCog} text="Configurações" onClick={handleClick} />
        </div>
      </aside>
    </>
  )
}
