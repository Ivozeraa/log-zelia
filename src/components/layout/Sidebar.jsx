import { SidebarOptions as So } from '../ui/SidebarOptions'
import { FaHome, FaExclamationCircle, FaPaste, FaCog, FaWrench, FaCalendarAlt, FaBullhorn, FaKey } from 'react-icons/fa'
import { useAuth } from '../../hooks/useAuth'
import { SectionTitle } from '../ui/SectionTitle'
import { Drawer, Box, Divider } from '@mui/material'

export const Sidebar = ({ open = false, setOpen = () => {} }) => {
  const { user } = useAuth()
  const canSeeManagement = [1, 2, 3].includes(Number(user?.role_id))
  const canManageAnnouncements = Number(user?.role_id) === 1
  const canSeeSchedules = Number(user?.role_id) !== 4
  const handleClick = () => { if (window.innerWidth < 768) setOpen(false) }

  const content = (
    <Box sx={{ width: 256, height: '100%', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', p: 2.5, gap: 0.75 }}>
      <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 1 }}><SectionTitle text="Menu" /></Box>
      <So to="/app" end icon={FaHome} text="Início" onClick={handleClick} />
      <So to="/app/advertencias" icon={FaExclamationCircle} text="Advertências" onClick={handleClick} />
      {canSeeSchedules && <So to="/app/horarios" icon={FaCalendarAlt} text="Horários" onClick={handleClick} />}
      {canSeeManagement && <><So to="/app/gestao" icon={FaPaste} text="Gestão" onClick={handleClick} /><So to="/app/gestao/senhas-alunos" icon={FaKey} text="Senhas dos alunos" onClick={handleClick} /></>}
      {canManageAnnouncements && <So to="/app/avisos" icon={FaBullhorn} text="Avisos" onClick={handleClick} />}
      <So to="/app/suporte" icon={FaWrench} text="Suporte" onClick={handleClick} />
      <Box sx={{ mt: 'auto', pt: 1.5 }}><Divider sx={{ mb: 1.5 }} /><So to="/app/configuracoes" icon={FaCog} text="Configurações" onClick={handleClick} /></Box>
    </Box>
  )

  return <>
    <Drawer variant="temporary" open={open} onClose={() => setOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: 256, boxSizing: 'border-box' } }}>{content}</Drawer>
    <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, width: 256, flexShrink: 0, '& .MuiDrawer-paper': { width: 256, boxSizing: 'border-box', top: '64px', height: 'calc(100% - 64px)', borderRight: 1, borderColor: 'divider' } }}>{content}</Drawer>
  </>
}
