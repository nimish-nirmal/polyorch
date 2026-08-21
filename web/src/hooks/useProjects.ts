import { useState, useEffect, useCallback } from 'react'
import { api, endpoints } from '../services/api'

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
      setProjects(response.data)
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
      setProjects((prev) => [...prev, response.data])
      return response.data
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
    setLoading(true)
    setError(null)
    try {
      const response = await api.get(endpoints.projectVersions(projectId))
      return response.data
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch versions')
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadVersion = useCallback(async (projectId: string, file: File, manifest: Record<string, any>) => {
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('manifest', JSON.stringify(manifest))
      const response = await api.post(`${endpoints.projectVersions(projectId)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return response.data
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

  useEffect(() => {
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
  }
}
