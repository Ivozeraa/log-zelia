import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { TeacherSchedule } from './components/dashboard/TeacherSchedule'

function AppPageFallback() {
  return (
    <Box sx={{ minHeight: '50vh', width: '100%', py: 2 }}>
      <Box sx={{ width: 192, height: 32, borderRadius: 3, bgcolor: 'action.hover', mb: 2 }} />
      <Box sx={{ width: 288, maxWidth: '100%', height: 16, borderRadius: 2, bgcolor: 'action.hover' }} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, mt: 3 }}>
        {[1, 2, 3].map((item) => <Box key={item} sx={{ height: 128, borderRadius: 3, bgcolor: 'action.hover' }} />)}
      </Box>
      <Box sx={{ height: 256, borderRadius: 3, bgcolor: 'action.hover', mt: 2 }} />
    </Box>
  )
}

function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/app' || location.pathname === '/app/'

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [location.pathname])

  return (
    <Box sx={{ minHeight: '100vh', overflowX: 'hidden', bgcolor: 'background.default' }}>
      <Header />
      <Box sx={{ pt: '64px', display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <Box component="main" sx={{ width: '100%', minWidth: 0, ml: { xs: 0, md: '256px' }, px: { xs: 1.5, sm: 2.5, lg: 3 }, py: { xs: 2, sm: 2.5, lg: 3 }, position: 'relative', zIndex: 1 }}>
          <Container maxWidth={false} disableGutters sx={{ width: '100%', maxWidth: 1600, mx: 'auto' }}>
            {isHome && <TeacherSchedule />}
            <Suspense fallback={<AppPageFallback />}>
              <Outlet />
            </Suspense>
          </Container>
        </Box>
      </Box>
    </Box>
  )
}

export default Layout
