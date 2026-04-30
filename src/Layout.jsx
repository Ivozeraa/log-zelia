import { Outlet } from 'react-router-dom'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'

function Layout() {
  return (
    <div className="font-inter">

      <Header/>

      <div className="pt-16 flex">

        <aside className="fixed top-16 left-0 w-64 h-[calc(100vh-4rem)] z-40">
          <Sidebar />
        </aside>

        <main className="ml-64 w-full p-6 z-10 relative">
          <Outlet />
        </main>

      </div>
    </div>
  )
}

export default Layout