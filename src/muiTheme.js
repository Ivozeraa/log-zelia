import { createTheme } from '@mui/material/styles'

export function createMuiTheme(mode = localStorage.getItem('theme') || 'light') {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: { main: '#16a34a' },
      secondary: { main: '#f97316' },
      background: {
        default: isDark ? '#030712' : '#f5f5f5',
        paper: isDark ? '#0f172a' : '#ffffff',
      },
    },
    typography: {
      fontFamily: 'Inter, Poppins, Montserrat, Arial, sans-serif',
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
  })
}
