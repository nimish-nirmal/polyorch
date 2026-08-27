import { useState } from 'react'
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

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
  const { runs, loading, error, fetchRuns, deleteRun } = useRuns()
  const [statusFilter, setStatusFilter] = useState('all')
  const visibleRuns = statusFilter === 'all' ? runs : runs.filter((run) => run.status === statusFilter)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this run and all of its logs?')) return
    try {
      await deleteRun(id)
    } catch (err) {
      // Error is displayed by the hook.
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-blue-400">Execution history</div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Runs</h1>
          <p className="mt-1 text-dark-400">Monitor every workflow execution and its selected version.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-dark-600 bg-dark-800 px-3 py-2 text-sm text-dark-200 focus:outline-none">
            <option value="all">All statuses</option>
            <option value="running">Running</option>
            <option value="pending">Pending</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          <button onClick={fetchRuns} className="flex items-center gap-2 rounded-lg border border-dark-600 bg-dark-800 px-4 py-2 text-sm font-medium text-dark-200 transition-colors hover:bg-dark-700">
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-dark-400">Loading runs...</div>
      ) : visibleRuns.length === 0 ? (
        <div className="rounded-xl border border-dark-700 bg-dark-900/90 p-12 text-center">
          <p className="text-dark-400">No runs found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-dark-700 bg-dark-900/90">
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
                {visibleRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-dark-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <Link to={`/runs/${run.id}`} className="text-blue-400 hover:text-blue-300 font-mono text-sm">
                        {run.id}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{run.project_name || run.project_id}</td>
                     <td className="px-6 py-4 text-dark-300 font-mono text-sm">{run.version}</td>
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
                      <button onClick={() => handleDelete(run.id)} className="ml-3 text-dark-500 hover:text-red-400" title="Delete run" aria-label={`Delete run ${run.id}`}>
                        <TrashIcon />
                      </button>
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
