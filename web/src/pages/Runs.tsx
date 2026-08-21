import { Link } from 'react-router-dom'
import { useRuns } from '../hooks/useRuns'
import { formatDate } from '../utils/helpers'

function RefreshIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function getStatusBadge(status: string) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-dark-600 text-dark-300 border-dark-500',
  }
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${colors[status] || colors.cancelled}`}>
      {status}
    </span>
  )
}

export default function Runs() {
  const { runs, loading, error, fetchRuns } = useRuns()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Runs</h1>
          <p className="text-dark-400 mt-1">Monitor workflow executions</p>
        </div>
        <button
          onClick={fetchRuns}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 text-dark-200 rounded-lg hover:bg-dark-700 transition-colors text-sm font-medium border border-dark-600"
        >
          <RefreshIcon />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-dark-400">Loading runs...</div>
      ) : runs.length === 0 ? (
        <div className="bg-dark-900 rounded-xl border border-dark-700 p-12 text-center">
          <p className="text-dark-400">No runs found</p>
        </div>
      ) : (
        <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-dark-400 border-b border-dark-700">
                  <th className="px-6 py-3 font-medium">Run ID</th>
                  <th className="px-6 py-3 font-medium">Project</th>
                  <th className="px-6 py-3 font-medium">Version</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Triggered By</th>
                  <th className="px-6 py-3 font-medium">Started</th>
                  <th className="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-dark-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <Link to={`/runs/${run.id}`} className="text-blue-400 hover:text-blue-300 font-mono text-sm">
                        {run.id}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{run.project_name || run.project_id}</td>
                    <td className="px-6 py-4 text-dark-300 font-mono text-sm">v{run.version}</td>
                    <td className="px-6 py-4">{getStatusBadge(run.status)}</td>
                    <td className="px-6 py-4 text-dark-300 capitalize text-sm">{run.triggered_by || '-'}</td>
                    <td className="px-6 py-4 text-dark-400 text-sm">
                      {run.started_at ? formatDate(run.started_at) : formatDate(run.created_at || '')}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/runs/${run.id}`}
                        className="text-dark-400 hover:text-white transition-colors"
                      >
                        <ArrowRightIcon />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
