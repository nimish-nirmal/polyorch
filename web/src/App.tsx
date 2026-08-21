import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Runs from './pages/Runs'
import RunDetail from './pages/RunDetail'

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-dark-950 text-dark-100">
        <Sidebar />
        <main className="flex-1 overflow-auto ml-64">
          <div className="p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/runs" element={<Runs />} />
              <Route path="/runs/:id" element={<RunDetail />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  )
}

export default App
