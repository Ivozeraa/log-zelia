import { Outlet } from 'react-router-dom'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'

function Layout() {
  return (
    <div className='px-10 text-2xl font-inter fixed w-full'>
      <Header username={"Usuário"} />
      <div className='flex py-5'>
        <Sidebar />
        <div className="ml-60"><Outlet /></div>
      </div>
    </div>
  )
}

export default Layout