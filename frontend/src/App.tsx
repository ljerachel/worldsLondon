import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Qr from './pages/Qr'
import Play from './pages/Play'
import Dash from './pages/Dash'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Qr />} />
        <Route path="/play" element={<Play />} />
        <Route path="/dash" element={<Dash />} />
      </Routes>
    </BrowserRouter>
  )
}
