import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useRuns } from '../hooks/useRuns'
import type { RunDetail } from '../hooks/useRuns'
import { formatDate } from '../utils/helpers'
import DAGViewer from '../components/DAGViewer'
import Terminal from '../components/Terminal'

function PlayIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CpuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  )
}

function getStatusColor(status: string) {
  switch (status) {
    case 'success':
      return 'text-green-400'
    case 'running':
      return 'text-blue-400'
    case 'failed':
      return 'text-red-400'
    case 'pending':
      return 'text-yellow-400'
    default:
      return 'text-dark-400'
  }
}

export default function RunDetail() {
  const { id } = useParams<{ id: string }>()
  const { fetchRunDetail } = useRuns()
  const [run, setRun] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dag' | 'logs' | 'tasks'>('dag')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchRunDetail(id).then((detail) => {
      if (detail) setRun(detail)
      setLoading(false)
    })
  }, [id, fetchRunDetail])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-dark-400">Loading run details...</div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-400">Run not found</div>
      </div>
    )
  }

  const duration = run.started_at && run.finished_at
    ? Math.floor((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-dark-400 text-sm mb-1">
            <Link to="/runs" className="hover:text-white transition-colors">Runs</Link>
            <span>/</span>
            <span className="text-white font-mono">{run.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Run {run.id}</h1>
            <span className={`text-lg font-semibold capitalize ${getStatusColor(run.status)}`}>
              {run.status}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          {run.status === 'running' && (
            <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
              <StopIcon />
              Stop
            </button>
          )}
          {run.status === 'pending' && (
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
              <PlayIcon />
              Start
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-dark-900 rounded-xl border border-dark-700 p-4">
          <div className="flex items-center gap-2 text-dark-400 mb-1">
            <ClockIcon />
            <span className="text-sm">Duration</span>
          </div>
          <p className="text-xl font-semibold text-white">
            {duration !== null ? `${duration}s` : '-'}
          </p>
        </div>
        <div className="bg-dark-900 rounded-xl border border-dark-700 p-4">
          <div className="flex items-center gap-2 text-dark-400 mb-1">
            <CpuIcon />
            <span className="text-sm">Project</span>
          </div>
          <p className="text-xl font-semibold text-white">{run.project_name || run.project_id}</p>
        </div>
        <div className="bg-dark-900 rounded-xl border border-dark-700 p-4">
          <div className="flex items-center gap-2 text-dark-400 mb-1">
            <CodeIcon />
            <span className="text-sm">Version</span>
          </div>
          <p className="text-xl font-semibold text-white font-mono">v{run.version}</p>
        </div>
        <div className="bg-dark-900 rounded-xl border border-dark-700 p-4">
          <div className="flex items-center gap-2 text-dark-400 mb-1">
            <PlayIcon />
            <span className="text-sm">Trigger</span>
          </div>
          <p className="text-xl font-semibold text-white capitalize">{run.triggered_by || '-'}</p>
        </div>
      </div>

      <div className="bg-dark-900 rounded-xl border border-dark-700">
        <div className="flex border-b border-dark-700">
          {(['dag', 'logs', 'tasks'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-dark-800/50'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              {tab === 'dag' ? 'DAG View' : tab === 'logs' ? 'Logs' : 'Tasks'}
            </button>
          ))}
        </div>
        <div className="p-6">
          {activeTab === 'dag' && <DAGViewer tasks={run.tasks} />}
          {activeTab === 'logs' && <Terminal runId={run.id} />}
          {activeTab === 'tasks' && (
            <div>
              {run.tasks && run.tasks.length > 0 ? (
                <div className="space-y-2">
                  {run.tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{task.name}</p>
                        <p className="text-sm text-dark-400 capitalize">{task.status}</p>
                      </div>
                      {task.started_at && (
                        <p className="text-sm text-dark-400">{formatDate(task.started_at)}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-dark-400 text-center py-8">No tasks available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
