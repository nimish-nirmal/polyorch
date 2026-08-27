import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useRuns } from '../hooks/useRuns'
import type { RunDetail } from '../hooks/useRuns'
import DAGViewer from '../components/DAGViewer'
import Terminal from '../components/Terminal'
import { api, endpoints } from '../services/api'

function PlayIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
  const { fetchRunDetail, fetchRunLogs, deleteRun } = useRuns()
  const navigate = useNavigate()
  const [run, setRun] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dag' | 'logs' | 'files'>('logs')
  const [versionFiles, setVersionFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const filesLoadedVersionRef = useRef<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchRunDetail(id).then((detail: RunDetail | null) => {
      if (detail) setRun(detail)
      setLoading(false)
    })
  }, [id, fetchRunDetail])

  useEffect(() => {
    if (!id || !run) return
    const interval = setInterval(() => {
      fetchRunDetail(id).then((detail: RunDetail | null) => {
        if (detail) setRun(detail)
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [id, run?.status, fetchRunDetail])

  const handleStart = async () => {
    if (!id || !run) return
    try {
      await api.post(`${endpoints.runs}/${id}/start`)
      fetchRunDetail(id).then((detail) => {
        if (detail) setRun(detail)
      })
    } catch (err: any) {
      // 409 => the run was already started/completed; nothing to do.
      if (err?.response?.status === 409) {
        fetchRunDetail(id).then((detail) => {
          if (detail) setRun(detail)
        })
        return
      }
      console.error('Failed to start run:', err)
    }
  }

  const handleViewFiles = async () => {
    if (!run) return
    setActiveTab('files')
  }

  const handleLoadVersionFiles = useCallback(async () => {
    if (!run || !run.version_id) return
    if (filesLoadedVersionRef.current === run.version_id) return
    setLoadingFiles(true)
    try {
      const files = await api.get(endpoints.versionFiles(run.project_id, run.version_id))
      setVersionFiles(files.data.data || [])
      filesLoadedVersionRef.current = run.version_id
    } catch (err) {
      console.error('Failed to load version files:', err)
    } finally {
      setLoadingFiles(false)
    }
  }, [run?.version_id, run?.project_id])

  const handleOpenFile = async (filename: string) => {
    if (!run || !run.version_id) return
    try {
      const res = await api.get(endpoints.versionFile(run.project_id, run.version_id, filename))
      setSelectedFile({ name: filename, content: res.data.data?.content || '' })
    } catch (err) {
      console.error('Failed to open file:', err)
    }
  }

  const handleClearLogs = async () => {
    if (!id) return
    if (!confirm('Clear all logs for this run?')) return
    try {
      await api.delete(`${endpoints.runs}/${id}/logs`)
      fetchRunLogs(id).then(() => {})
    } catch (err) {
      console.error('Failed to clear logs:', err)
    }
  }

  const handleDeleteRun = async () => {
    if (!id || !confirm('Delete this run and all of its logs?')) return
    try {
      await deleteRun(id)
      navigate('/runs')
    } catch (err) {
      console.error('Failed to delete run:', err)
    }
  }

  useEffect(() => {
    if (activeTab === 'files' && run?.version_id) {
      handleLoadVersionFiles()
    }
  }, [activeTab, run?.version_id, handleLoadVersionFiles])

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
    <div className="space-y-6 flex-1 flex flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-dark-400 text-sm mb-1">
            <Link to="/runs" className="hover:text-white transition-colors">Runs</Link>
            <span>/</span>
            <span className="text-white font-mono">{run.id}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-all text-2xl font-bold text-white">Run {run.id}</h1>
            <span className={`text-lg font-semibold capitalize ${getStatusColor(run.status)}`}>
              {run.status}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {run.status === 'pending' && (
            <button onClick={handleStart} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
              <PlayIcon />
              Start
            </button>
          )}
          <button onClick={handleViewFiles} className="flex items-center gap-2 px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors text-sm">
            <CodeIcon />
            View Files
          </button>
          <button onClick={handleClearLogs} className="flex items-center gap-2 px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors text-sm">
            Clear Logs
          </button>
          <button onClick={handleDeleteRun} className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-colors text-sm">
            Delete Run
          </button>
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
          <p className="text-xl font-semibold text-white font-mono">{run.version}</p>
        </div>
        <div className="bg-dark-900 rounded-xl border border-dark-700 p-4">
          <div className="flex items-center gap-2 text-dark-400 mb-1">
            <PlayIcon />
            <span className="text-sm">Trigger</span>
          </div>
          <p className="text-xl font-semibold text-white capitalize">{run.triggered_by || '-'}</p>
        </div>
      </div>

      <div className="bg-dark-900 rounded-xl border border-dark-700 flex-1 flex flex-col">
        <div className="flex border-b border-dark-700">
          {(['dag', 'logs', 'files'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-dark-800/50'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              {tab === 'dag' ? 'DAG View' : tab === 'logs' ? 'Logs' : 'Files'}
            </button>
          ))}
        </div>
        <div className="min-w-0 p-4 sm:p-6 flex-1 overflow-y-auto">
          {activeTab === 'dag' && <DAGViewer tasks={run.tasks} />}
          {activeTab === 'logs' && <Terminal runId={run.id} />}
          {activeTab === 'files' && (
            <div>
              {loadingFiles ? (
                <p className="text-dark-400 text-center py-8">Loading files...</p>
              ) : versionFiles.length === 0 ? (
                <p className="text-dark-400 text-center py-8">No files available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1 bg-dark-800 rounded-lg border border-dark-700 p-4">
                    <h3 className="text-sm font-medium text-white mb-3">Files</h3>
                    <div className="space-y-1">
                      {versionFiles.map((file) => (
                        <button
                          key={file}
                          onClick={() => handleOpenFile(file)}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                            selectedFile?.name === file
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'text-dark-300 hover:text-white hover:bg-dark-700'
                          }`}
                        >
                          {file}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2 bg-dark-800 rounded-lg border border-dark-700 p-4">
                    {selectedFile ? (
                      <>
                        <h3 className="text-sm font-medium text-white mb-3">{selectedFile.name}</h3>
                        <pre className="text-sm text-dark-300 bg-dark-900 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
                          {selectedFile.content}
                        </pre>
                      </>
                    ) : (
                      <p className="text-dark-400 text-center py-8">Select a file to view its contents</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
