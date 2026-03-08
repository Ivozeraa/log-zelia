import { Outlet } from 'react-router-dom'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'

function Layout() {
  return (
    <div className='px-7 text-2xl font-inter'>
      <Header username={"Usuário"} />
      <div className='flex py-5 gap-10'>
        <Sidebar />
        <Outlet />
      </div>
    </div>
  )
}

export default Layout