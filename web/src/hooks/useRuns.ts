import { useState, useEffect, useCallback } from 'react'
import { api, endpoints } from '../services/api'

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
    try {
      const response = await api.get(endpoints.runLogs(id))
      return response.data.data || []
    } catch (err: any) {
      console.error('Failed to fetch run logs:', err)
      return []
    }
  }, [])

  const deleteRun = useCallback(async (id: string) => {
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
