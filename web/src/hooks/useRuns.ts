import { useState, useEffect, useCallback } from 'react'
import { api, endpoints, isDemo } from '../services/api'

const mockRuns: Run[] = [
  { id: 'run_1', project_id: 'proj_1', project_name: 'ETL Pipeline', version: 'v1.2.3', version_id: 'ver_1', status: 'success', started_at: '2024-03-15T10:00:00Z', finished_at: '2024-03-15T10:02:15Z', created_at: '2024-03-15T09:58:00Z' },
  { id: 'run_2', project_id: 'proj_2', project_name: 'Data Sync', version: 'v1.0.0', version_id: 'ver_2', status: 'running', started_at: '2024-03-16T14:30:00Z', created_at: '2024-03-16T14:28:00Z' },
  { id: 'run_3', project_id: 'proj_1', project_name: 'ETL Pipeline', version: 'v1.2.2', version_id: 'ver_3', status: 'failed', started_at: '2024-03-14T08:00:00Z', finished_at: '2024-03-14T08:01:30Z', created_at: '2024-03-14T07:58:00Z' },
  { id: 'run_4', project_id: 'proj_3', project_name: 'Report Generator', version: 'v0.9.1', version_id: 'ver_4', status: 'pending', created_at: '2024-03-17T11:00:00Z' },
]

export interface Run {
  id: string
  project_id: string
  project_name?: string
  version: string
  version_id: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
  started_at?: string
  finished_at?: string
  created_at?: string
  triggered_by?: string
}

export interface RunDetail extends Run {
  tasks?: Array<{
    id: string
    name: string
    status: string
    started_at?: string
    finished_at?: string
  }>
  logs?: string[]
}

export function useRuns() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(endpoints.runs)
      const mapped = (response.data.data || []).map((item: any) => ({
        ...item,
        id: item.run_id,
        version: item.version_tag || item.version_id,
        version_id: item.version_id,
      }))
      setRuns(mapped)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch runs')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRunDetail = useCallback(async (id: string): Promise<RunDetail | null> => {
    if (isDemo) {
      const mock = mockRuns.find(r => r.id === id)
      if (!mock) return null
      return {
        ...mock,
        tasks: [
          { id: 'task_1', name: 'Extract', status: 'success', started_at: mock.started_at, finished_at: mock.started_at },
          { id: 'task_2', name: 'Transform', status: mock.status === 'running' ? 'running' : 'success', started_at: mock.started_at, finished_at: mock.finished_at },
          { id: 'task_3', name: 'Load', status: mock.status === 'running' ? 'pending' : mock.status, started_at: mock.started_at, finished_at: mock.finished_at },
        ],
        logs: [
          '[PolyOrch] Pipeline started',
          '[PolyOrch] Extracting data from source...',
          '[PolyOrch] Extract complete: 1,024 records',
          '[PolyOrch] Transforming data...',
          '[PolyOrch] Transform complete: 1,024 records',
          '[PolyOrch] Loading to warehouse...',
          '[PolyOrch] Pipeline completed successfully',
        ],
      }
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(`${endpoints.runs}/${id}`)
      const item = response.data.data || null
      if (item) {
        return {
          ...item,
          id: item.run_id,
          version: item.version_tag || item.version_id,
          version_id: item.version_id,
        }
      }
      return null
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch run details')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRunLogs = useCallback(async (id: string): Promise<string[]> => {
    if (isDemo) {
      const mock = mockRuns.find(r => r.id === id)
      if (mock?.status === 'running') {
        return [
          '[PolyOrch] Pipeline started',
          '[PolyOrch] Extracting data from source...',
          '[PolyOrch] Extract complete: 1,024 records',
          '[PolyOrch] Transforming data...',
          '[PolyOrch] Transform complete: 1,024 records',
          '[PolyOrch] Loading to warehouse...',
        ]
      }
      return [
        '[PolyOrch] Pipeline started',
        '[PolyOrch] Extracting data from source...',
        '[PolyOrch] Extract complete: 1,024 records',
        '[PolyOrch] Transforming data...',
        '[PolyOrch] Transform complete: 1,024 records',
        '[PolyOrch] Loading to warehouse...',
        '[PolyOrch] Pipeline completed successfully',
      ]
    }
    try {
      const response = await api.get(endpoints.runLogs(id))
      return response.data.data || []
    } catch (err: any) {
      console.error('Failed to fetch run logs:', err)
      return []
    }
  }, [])

  const deleteRun = useCallback(async (id: string) => {
    if (isDemo) {
      setRuns((prev) => prev.filter((run) => run.id !== id))
      return
    }
    setError(null)
    try {
      await api.delete(`${endpoints.runs}/${id}`)
      setRuns((prev) => prev.filter((run) => run.id !== id))
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete run')
      throw err
    }
  }, [])

  useEffect(() => {
    if (isDemo) {
      setRuns(mockRuns)
      setLoading(false)
      return
    }
    fetchRuns()
  }, [fetchRuns])

  return {
    runs,
    loading,
    error,
    fetchRuns,
    fetchRunDetail,
    fetchRunLogs,
    deleteRun,
  }
}
