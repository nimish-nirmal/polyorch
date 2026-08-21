import { Link } from 'react-router-dom'
import { useRuns } from '../hooks/useRuns'
import { useProjects } from '../hooks/useProjects'
import { formatDate } from '../utils/helpers'

function StatCard({ title, value, icon, trend, color }: { title: string; value: string | number; icon: React.ReactNode; trend?: string; color: string }) {
  return (
    <div className="bg-dark-900 rounded-xl border border-dark-700 p-6 hover:border-dark-600 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-dark-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          {trend && (
            <p className="text-sm text-dark-400 mt-1">
              <span className="text-green-400">{trend}</span>
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
      </div>
    </div>
  )
}

function DashboardIcon() {
  return (
    <svg className="w-6 h-6 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function RunIcon() {
  return (
    <svg className="w-6 h-6 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function SuccessIcon() {
  return (
    <svg className="w-6 h-6 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function QueueIcon() {
  return (
    <svg className="w-6 h-6 text-dark-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export default function Dashboard() {
  const { runs, loading: runsLoading } = useRuns()
  const { projects, loading: projectsLoading } = useProjects()

  const totalProjects = projects.length
  const activeRuns = runs.filter((r) => r.status === 'running' || r.status === 'pending').length
  const successRuns = runs.filter((r) => r.status === 'success').length
  const successRate = runs.length > 0 ? Math.round((successRuns / runs.length) * 100) : 0

  const stats = [
    { title: 'Total Projects', value: totalProjects.toString(), icon: <DashboardIcon />, color: 'bg-blue-600/20' },
    { title: 'Active Runs', value: activeRuns.toString(), icon: <RunIcon />, color: 'bg-green-600/20' },
    { title: 'Success Rate', value: `${successRate}%`, icon: <SuccessIcon />, color: 'bg-green-600/20' },
    { title: 'Queue Depth', value: '0', icon: <QueueIcon />, color: 'bg-yellow-600/20' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'running':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-dark-600 text-dark-300 border-dark-500'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-dark-400 mt-1">Overview of your PolyOrch orchestrator</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/projects"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <PlusIcon />
            New Project
          </Link>
          <Link
            to="/runs"
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 text-dark-200 rounded-lg hover:bg-dark-700 transition-colors text-sm font-medium border border-dark-600"
          >
            <DocumentIcon />
            View Logs
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="bg-dark-900 rounded-xl border border-dark-700">
        <div className="p-6 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">Recent Runs</h2>
        </div>
        {runsLoading ? (
          <div className="p-6 text-center text-dark-400">Loading runs...</div>
        ) : runs.length === 0 ? (
          <div className="p-6 text-center text-dark-400">
            <p>No runs yet. Create a project and trigger a run to see results here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-dark-400 border-b border-dark-700">
                  <th className="px-6 py-3 font-medium">Run ID</th>
                  <th className="px-6 py-3 font-medium">Version ID</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Started At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {runs.slice(0, 10).map((run) => (
                  <tr key={run.id} className="hover:bg-dark-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <Link to={`/runs/${run.id}`} className="text-blue-400 hover:text-blue-300 font-mono text-sm">
                        {run.id}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-white font-mono text-sm">{run.version}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-dark-400 text-sm">
                      {run.started_at ? formatDate(run.started_at) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
