import { Routes, Route } from 'react-router-dom'
import AttendancePage from './pages/AttendancePage'
import MembershipCardPage from './pages/MembershipCardPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AttendancePage />} />
      <Route path="/card" element={<MembershipCardPage />} />
    </Routes>
  )
}
