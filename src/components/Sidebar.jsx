import { FaHome, FaExclamationCircle, FaPaste, FaCog } from 'react-icons/fa'

export const Sidebar = () => {
  return (
    <nav className='flex flex-col gap-5'>
      <span className='flex items-center gap-2'>
        <FaHome />
        <p>Início</p>
      </span>

      <span className='flex items-center gap-2'>
        <FaExclamationCircle />
        <p>Advertências</p>
      </span>

      <span className='flex items-center gap-2'>
        <FaPaste />
        <p>Gestão</p>
      </span>

      <span className='flex items-center gap-2'>
        <FaCog />
        <p>Configurações</p>
      </span>
    </nav>
  )
}
