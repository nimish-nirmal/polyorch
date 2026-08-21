import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Runs from './pages/Runs'
import RunDetail from './pages/RunDetail'
import Login from './pages/Login'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <div className="flex h-screen bg-dark-950 text-dark-100">
              <Sidebar />
              <main className="flex-1 overflow-auto ml-64">
                <div className="p-6">
                  <Navigate to="/dashboard" replace />
                </div>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <div className="flex h-screen bg-dark-950 text-dark-100">
              <Sidebar />
              <main className="flex-1 overflow-auto ml-64">
                <div className="p-6">
                  <Dashboard />
                </div>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <div className="flex h-screen bg-dark-950 text-dark-100">
              <Sidebar />
              <main className="flex-1 overflow-auto ml-64">
                <div className="p-6">
                  <Projects />
                </div>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <ProtectedRoute>
            <div className="flex h-screen bg-dark-950 text-dark-100">
              <Sidebar />
              <main className="flex-1 overflow-auto ml-64">
                <div className="p-6">
                  <ProjectDetail />
                </div>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/runs"
        element={
          <ProtectedRoute>
            <div className="flex h-screen bg-dark-950 text-dark-100">
              <Sidebar />
              <main className="flex-1 overflow-auto ml-64">
                <div className="p-6">
                  <Runs />
                </div>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/runs/:id"
        element={
          <ProtectedRoute>
            <div className="flex h-screen bg-dark-950 text-dark-100">
              <Sidebar />
              <main className="flex-1 overflow-auto ml-64">
                <div className="p-6">
                  <RunDetail />
                </div>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App