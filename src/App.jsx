import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

import Layout from './Layout'

// Importação de páginas
import { Home } from './pages/Home'
import { Occurrences } from './pages/Occurrences'
import { Management } from './pages/Management'
import { Settings } from './pages/Settings'

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Layout />}>
          <Route index element={<Home username={"Usuário"} />} />
          <Route path='/advertencias' element={<Occurrences />} />
          <Route path='/gestao' element={<Management />} />
          <Route path='/configuracoes' element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
