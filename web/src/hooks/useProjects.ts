import { useState, useEffect, useCallback } from 'react'
import { api, endpoints, isDemo } from '../services/api'

const mockProjects = [
  { id: 'proj_1', name: 'ETL Pipeline', description: 'Extract, Transform, Load pipeline', versions_count: 3, last_run_status: 'success', created_at: '2024-01-15T10:30:00Z' },
  { id: 'proj_2', name: 'Data Sync', description: 'Nightly database synchronization', versions_count: 2, last_run_status: 'running', created_at: '2024-02-20T14:00:00Z' },
  { id: 'proj_3', name: 'Report Generator', description: 'Weekly analytics reports', versions_count: 1, last_run_status: 'failed', created_at: '2024-03-10T09:15:00Z' },
]

export interface Project {
  id: string
  name: string
  description?: string
  versions_count?: number
  last_run_status?: string
  created_at?: string
  updated_at?: string
}

export interface Version {
  id: string
  version: string
  description?: string
  status: string
  created_at?: string
  activated_at?: string
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(endpoints.projects)
      const mapped = (response.data.data || []).map((item: any) => ({
        ...item,
        id: item.project_id,
      }))
      setProjects(mapped)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch projects')
    } finally {
      setLoading(false)
    }
  }, [])

  const createProject = useCallback(async (name: string, description?: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post(endpoints.projects, { name, description })
      const created = { ...response.data.data, id: response.data.data.project_id }
      setProjects((prev) => [...prev, created])
      return created
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create project')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await api.delete(`${endpoints.projects}/${id}`)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete project')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchVersions = useCallback(async (projectId: string): Promise<Version[]> => {
    if (isDemo) {
      return [
        { id: 'ver_1', version: 'v1.2.0', description: 'Production-ready ETL pipeline', status: 'active', created_at: '2024-01-20T10:00:00Z' },
        { id: 'ver_2', version: 'v1.1.0', description: 'Added parallel extraction', status: 'inactive', created_at: '2024-01-15T10:00:00Z' },
      ]
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(endpoints.projectVersions(projectId))
      const mapped = (response.data.data || []).map((item: any) => ({
        id: item.version_id,
        version: item.version_tag,
        description: item.manifest_json,
        status: item.is_active ? 'active' : 'inactive',
        created_at: item.created_at,
      }))
      return mapped
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch versions')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadVersion = useCallback(async (projectId: string, file: File, manifest: Record<string, any>, versionTag: string) => {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('manifest', JSON.stringify(manifest))
      formData.append('version_tag', versionTag)
      const response = await api.post(`${endpoints.projectVersions(projectId)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data.data
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload version')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const activateVersion = useCallback(async (projectId: string, versionId: string) => {
    setLoading(true)
    setError(null)
    try {
      await api.post(`${endpoints.projectVersions(projectId)}/${versionId}/activate`)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to activate version')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateVersionFile = useCallback(async (projectId: string, versionId: string, filename: string, content: string) => {
    setLoading(true)
    setError(null)
    try {
      await api.put(endpoints.updateVersionFile(projectId, versionId, filename), { content })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update file')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const createRun = useCallback(async (projectId: string, versionId: string) => {
    if (isDemo) {
      return {
        run_id: `run_${Date.now()}`,
        project_id: projectId,
        version_id: versionId,
        status: 'pending',
        created_at: new Date().toISOString(),
      }
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.post(endpoints.runs, { project_id: projectId, version_id: versionId })
      return response.data.data
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create run')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isDemo) {
      setProjects(mockProjects)
      setLoading(false)
      return
    }
    fetchProjects()
  }, [fetchProjects])

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    deleteProject,
    fetchVersions,
    uploadVersion,
    activateVersion,
    updateVersionFile,
    createRun,
  }
}
