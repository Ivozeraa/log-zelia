import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { SidebarOptions as So } from '../ui/SidebarOptions'
import { FaHome, FaExclamationCircle, FaPaste, FaCog, FaWrench, FaCalendarAlt, FaBullhorn, FaKey, FaShieldAlt, FaHistory, FaTools, FaChevronDown, FaUserCheck } from 'react-icons/fa'
import { useAuth } from '../../hooks/useAuth'
import { SectionTitle } from '../ui/SectionTitle'
import { useSchoolFeatures } from '../../hooks/useSchoolFeatures'

export const Sidebar = ({ open, setOpen }) => {
  const { user } = useAuth()
  const location = useLocation()
  const [adminOpen, setAdminOpen] = useState(false)
  const [frequenciaOpen, setFrequenciaOpen] = useState(false)

  const handleClick = () => {
    if (window.innerWidth < 768) {
      setOpen(false)
    }
  }

  const canSeeManagement = [1, 2, 3].includes(user?.role_id)
  const canManageAnnouncements = Number(user?.role_id) === 1
  const canAccessPlatformAdmin = Number(user?.role_id) === 1
  const canSeeSchedules = Number(user?.role_id) !== 4
  const { hasFeature, loading: featuresLoading } = useSchoolFeatures()
  const canSeeOccurrences = featuresLoading || hasFeature('ocorrencias')
  const canSeeHorarios = featuresLoading || hasFeature('horarios')
  const canSeeFrequencia = featuresLoading || hasFeature('frequencia')
  const isFrequenciaRoute = location.pathname.startsWith('/app/frequencia')

  useEffect(() => {
    if (isFrequenciaRoute) {
      setFrequenciaOpen(true)
    }
  }, [isFrequenciaRoute])

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
        <div className="md:hidden shrink-0">
          <SectionTitle text="Menu" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-2">
          <So to="/app" end icon={FaHome} text="Início" onClick={handleClick} />
          {canSeeOccurrences && <So to="/app/advertencias" icon={FaExclamationCircle} text="Advertências" onClick={handleClick} />}
          {canSeeFrequencia && (
            <div>
              <div className={`flex items-center rounded-xl transition-colors ${isFrequenciaRoute ? 'bg-green-700 dark:bg-green-800 text-white' : 'text-gray-700 dark:text-slate-400'}`}>
                <NavLink
                  to="/app/frequencia"
                  onClick={handleClick}
                  end
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2 p-2 cursor-pointer">
                    <FaUserCheck />
                    <p className="truncate">Frequência</p>
                  </div>
                </NavLink>

                {canSeeManagement && (
                  <button
                    type="button"
                    onClick={() => setFrequenciaOpen((current) => !current)}
                    className="shrink-0 p-3 mr-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                    aria-label={frequenciaOpen ? 'Recolher menu de frequência' : 'Expandir menu de frequência'}
                    aria-expanded={frequenciaOpen}
                  >
                    <FaChevronDown
                      className={`text-xs transition-transform duration-200 ${frequenciaOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
              </div>

              <div
                className={`overflow-hidden transition-all duration-200 ${frequenciaOpen ? 'max-h-52 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}
              >
                <div className="ml-4 pl-3 border-l border-gray-200 dark:border-slate-700 space-y-1">
                  <So to="/app/frequencia" end icon={FaUserCheck} text="Visão geral" onClick={handleClick} />
                  <So to="/app/frequencia/ponto" icon={FaUserCheck} text="Ponto de frequência" onClick={handleClick} />
                  <So to="/app/gestao/frequencia" icon={FaCog} text="Configurar frequência" onClick={handleClick} />
                </div>
              </div>
            </div>
          )}

          {canSeeSchedules && canSeeHorarios && (
            <So to="/app/horarios" icon={FaCalendarAlt} text="Horários" onClick={handleClick} />
          )}

          {canSeeManagement && (
            <>
              <So to="/app/gestao" icon={FaPaste} text="Gestão" onClick={handleClick} />
              <So to="/app/gestao/senhas-alunos" icon={FaKey} text="Senhas dos alunos" onClick={handleClick} />
            </>
          )}

          {canAccessPlatformAdmin && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setAdminOpen((current) => !current)}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-gray-700 hover:text-green-800 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-green-700 dark:hover:bg-slate-900 transition-colors"
                aria-expanded={adminOpen}
              >
                <FaShieldAlt />
                <span className="flex-1 text-left">Administração</span>
                <FaChevronDown
                  className={`text-xs transition-transform duration-200 ${adminOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 ${adminOpen ? 'max-h-60 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}
              >
                <div className="ml-3 pl-3 border-l border-gray-200 dark:border-slate-700 space-y-1">
                  <So to="/app/admin" icon={FaShieldAlt} text="Dashboard" onClick={handleClick} />
                  <So to="/app/admin/usuarios" icon={FaKey} text="Usuários da plataforma" onClick={handleClick} />
                  <So to="/app/admin/auditoria" icon={FaHistory} text="Auditoria" onClick={handleClick} />
                  <So to="/app/admin/recursos" icon={FaTools} text="Recursos" onClick={handleClick} />
                </div>
              </div>
            </div>
          )}

          {canManageAnnouncements && (
            <So to="/app/avisos" icon={FaBullhorn} text="Avisos" onClick={handleClick} />
          )}

          <So to="/app/suporte" icon={FaWrench} text="Suporte" onClick={handleClick} />
        </div>

        <div className="shrink-0 border-t-2 border-gray-300 dark:border-slate-700 pt-4">
          <So to="/app/configuracoes" icon={FaCog} text="Configurações" onClick={handleClick} />
        </div>
      </aside>
    </>
  )
}
