import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Runs from './pages/Runs'
import RunDetail from './pages/RunDetail'
import Login from './pages/Login'
import { isDemo } from './services/api'

const routerBase = import.meta.env.BASE_URL.replace(/\/$/, '')

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
            <AppShell><Navigate to="/dashboard" replace /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppShell><Dashboard /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppShell><Projects /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <ProtectedRoute>
            <AppShell><ProjectDetail /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/runs"
        element={
          <ProtectedRoute>
            <AppShell><Runs /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/runs/:id"
        element={
          <ProtectedRoute>
            <AppShell><RunDetail /></AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />
      )}
      <main className="min-h-screen overflow-x-hidden md:ml-64 flex flex-col">
          {isDemo && (
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/30 px-4 py-2">
              <span className="text-xs font-medium text-amber-300">Demo Mode</span>
              <span className="text-xs text-amber-400/80 ml-2">Running with mock data — no backend connected</span>
            </div>
          )}
          {!isDemo && (
            <div className="flex items-center border-b border-dark-800 bg-dark-950/95 px-4 py-3 backdrop-blur md:hidden">
              <button aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-dark-300 hover:bg-dark-800 hover:text-white">
                <span className="block h-0.5 w-5 bg-current" />
                <span className="mt-1 block h-0.5 w-5 bg-current" />
                <span className="mt-1 block h-0.5 w-5 bg-current" />
              </button>
              <span className="ml-3 text-sm font-semibold text-white">PolyOrch</span>
            </div>
          )}
          <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8 flex-1 flex-col">{children}</div>
        </main>
    </div>
  )
}

function App() {
  return (
    <Router basename={routerBase}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App