import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProjects, Version } from '../hooks/useProjects'
import CodeEditor from '../components/CodeEditor'
import { formatDate } from '../utils/helpers'
import { api, endpoints } from '../services/api'

function UploadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function ArrowUturnLeftIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { projects, loading, error, fetchVersions, uploadVersion, activateVersion, updateVersionFile, createRun } = useProjects()
  const project = projects.find((p) => p.id === id)
  const [versions, setVersions] = useState<Version[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadVersionTag, setUploadVersionTag] = useState('v1.1.0')
  const [uploadManifest, setUploadManifest] = useState('{\n  "version": "1.0.0",\n  "entrypoint": "main.py"\n}')
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [versionFiles, setVersionFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')

  useEffect(() => {
    if (id) {
      fetchVersions(id).then(setVersions)
    }
  }, [id, fetchVersions])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile || !id) return
    try {
      const manifest = JSON.parse(uploadManifest)
      await uploadVersion(id, uploadFile, manifest, uploadVersionTag)
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadVersionTag('')
      fetchVersions(id).then(setVersions)
    } catch (err) {
      // Error handled
    }
  }

  const handleActivate = async (versionId: string) => {
    if (!id) return
    if (!confirm('Activate this version? This will redeploy the project.')) return
    try {
      await activateVersion(id, versionId)
      fetchVersions(id).then(setVersions)
    } catch (err) {
      // Error handled
    }
  }

  const handleRun = async (versionId?: string) => {
    if (!id) return
    const selectedVersionId = versionId || versions.find((v) => v.status === 'active')?.id
    if (!selectedVersionId) {
      alert('Please activate a version before running.')
      return
    }
    try {
      const run = await createRun(id, selectedVersionId)
      if (run) {
        navigate(`/runs/${run.run_id}`)
      }
    } catch (err) {
      // Error handled
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'active':
        return 'bg-green-500/20 text-green-400'
      case 'running':
        return 'bg-blue-500/20 text-blue-400'
      case 'failed':
        return 'bg-red-500/20 text-red-400'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400'
      default:
        return 'bg-dark-600 text-dark-400'
    }
  }

  const fetchVersionFiles = async (version: Version) => {
    setSelectedVersion(version)
    setSelectedFile(null)
    setLoadingFiles(true)
    try {
      const response = await api.get(endpoints.versionFiles(id || '', version.id))
      setVersionFiles(response.data.data || [])
    } catch (err) {
      setVersionFiles([])
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleOpenFile = async (filename: string) => {
    if (!id || !selectedVersion) return
    if (isEditing) {
      setIsEditing(false)
    }
    try {
      const response = await api.get(endpoints.versionFile(id, selectedVersion.id, filename))
      setSelectedFile({ name: filename, content: response.data.data?.content || '' })
    } catch (err) {
      setSelectedFile({ name: filename, content: 'Unable to load this file.' })
    }
  }

  const getLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'py': return 'python'
      case 'js': return 'javascript'
      case 'ts': return 'typescript'
      case 'json': return 'json'
      case 'sh': case 'bash': return 'shell'
      case 'yaml': case 'yml': return 'yaml'
      case 'md': return 'markdown'
      case 'html': return 'html'
      case 'css': return 'css'
      case 'go': return 'go'
      default: return 'plaintext'
    }
  }

  const handleEdit = () => {
    if (!selectedFile) return
    setEditedContent(selectedFile.content)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedContent('')
  }

  const handleSaveClick = async () => {
    if (!id || !selectedVersion || !selectedFile) return
    try {
      await updateVersionFile(id, selectedVersion.id, selectedFile.name, editedContent)
      const response = await api.get(endpoints.versionFile(id, selectedVersion.id, selectedFile.name))
      setSelectedFile({ name: selectedFile.name, content: response.data.data?.content || editedContent })
      setIsEditing(false)
      setEditedContent('')
      fetchVersions(id).then(setVersions)
    } catch (err: any) {
      alert(err?.message || 'Failed to save file')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-dark-400 text-sm mb-1">
            <button onClick={() => navigate('/projects')} className="hover:text-white transition-colors">
              Projects
            </button>
            <span>/</span>
            <span className="text-white">{project?.name || 'Loading...'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{project?.name || 'Project Details'}</h1>
          <p className="text-dark-400 mt-1">{project?.description || 'No description provided'}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            <UploadIcon />
            Upload Version
          </button>
          <button onClick={() => handleRun()} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            Run
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-dark-900 rounded-xl border border-dark-700">
        <div className="p-6 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">Versions</h2>
          <p className="text-sm text-dark-400 mt-1">{versions.length} version{versions.length !== 1 ? 's' : ''} uploaded</p>
        </div>
        {loading && versions.length === 0 ? (
          <div className="p-6 text-center text-dark-400">Loading versions...</div>
        ) : versions.length === 0 ? (
          <div className="p-6 text-center text-dark-400">
            <p>No versions uploaded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700">
            {versions.map((version) => (
              <div key={version.id} className="p-4 hover:bg-dark-800/50 transition-colors">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm text-white">{version.version}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(version.status)}`}>
                        {version.status}
                      </span>
                    </div>
                    <p className="text-sm text-dark-400 mt-1">{version.description}</p>
                    <p className="text-xs text-dark-500 mt-1">Created {version.created_at ? formatDate(version.created_at) : '-'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      onClick={() => handleRun(version.id)}
                      disabled={loading}
                      className="px-3 py-2 text-sm text-green-400 rounded-lg bg-green-600/20 hover:bg-green-600/30 disabled:opacity-50"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => fetchVersionFiles(version)}
                      className="p-2 text-dark-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                      title="View files"
                    >
                      <DocumentIcon />
                    </button>
                    {version.status !== 'active' && (
                      <button
                        onClick={() => handleActivate(version.id)}
                        className="flex items-center gap-1 px-3 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors text-sm"
                      >
                        <ArrowUturnLeftIcon />
                        Activate
                      </button>
                    )}
                    {version.status === 'active' && (
                      <span className="self-center text-xs text-green-400">Active version</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedVersion && (
        <div className="bg-dark-900 rounded-xl border border-dark-700">
          <div className="p-6 border-b border-dark-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Files: {selectedVersion.version}
            </h3>
            <div className="flex gap-2">
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  disabled={!selectedFile}
                  className="px-3 py-2 text-sm text-blue-400 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-2 text-sm text-dark-300 rounded-lg bg-dark-800 hover:bg-dark-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveClick}
                    disabled={loading}
                    className="px-3 py-2 text-sm text-white rounded-lg bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
            <div className="rounded-lg border border-dark-700 bg-dark-800 p-3">
              {loadingFiles ? <p className="text-sm text-dark-400">Loading files...</p> : versionFiles.length === 0 ? <p className="text-sm text-dark-400">No files available</p> : (
                <div className="space-y-1">
                  {versionFiles.map((file) => (
                    <button key={file} onClick={() => handleOpenFile(file)} className={`w-full truncate rounded px-3 py-2 text-left text-sm ${selectedFile?.name === file ? 'bg-blue-600/20 text-blue-400' : 'text-dark-300 hover:bg-dark-700 hover:text-white'}`}>
                      {file}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-h-[300px] md:col-span-2">
              {selectedFile ? (
                <CodeEditor
                  value={isEditing ? editedContent : selectedFile.content}
                  language={getLanguage(selectedFile.name)}
                  readOnly={!isEditing}
                  height="300px"
                  onChange={isEditing ? (value) => setEditedContent(value || '') : undefined}
                />
              ) : (
                <p className="py-8 text-center text-sm text-dark-400">Select a file to view its contents</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-xl border border-dark-700 p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Upload New Version</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Version Tag</label>
                <input
                  type="text"
                  value={uploadVersionTag}
                  onChange={(e) => setUploadVersionTag(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:border-blue-500"
                  placeholder="v1.1.0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Version Archive (ZIP)</label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Manifest (JSON)</label>
                <textarea
                  value={uploadManifest}
                  onChange={(e) => setUploadManifest(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white font-mono text-sm"
                  rows={5}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 bg-dark-800 text-dark-200 rounded-lg hover:bg-dark-700 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
