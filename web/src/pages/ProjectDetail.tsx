import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProjects, Version } from '../hooks/useProjects'
import CodeEditor from '../components/CodeEditor'
import { formatDate } from '../utils/helpers'

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
  const { projects, loading, error, fetchVersions, uploadVersion, activateVersion } = useProjects()
  const project = projects.find((p) => p.id === id)
  const [versions, setVersions] = useState<Version[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadManifest, setUploadManifest] = useState('{\n  "version": "1.0.0",\n  "entrypoint": "main.py"\n}')
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)

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
      await uploadVersion(id, uploadFile, manifest)
      setShowUploadModal(false)
      setUploadFile(null)
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
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <UploadIcon />
          Upload Version
        </button>
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
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-white">v{version.version}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(version.status)}`}>
                        {version.status}
                      </span>
                    </div>
                    <p className="text-sm text-dark-400 mt-1">{version.description}</p>
                    <p className="text-xs text-dark-500 mt-1">Created {version.created_at ? formatDate(version.created_at) : '-'}</p>
                  </div>
                  <div className="flex gap-2">
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedVersion && (
        <div className="bg-dark-900 rounded-xl border border-dark-700">
          <div className="p-6 border-b border-dark-700">
            <h3 className="text-lg font-semibold text-white">
              Files: v{selectedVersion.version}
            </h3>
          </div>
          <div>
            <CodeEditor
              value={selectedVersion.description || 'No description available'}
              language="markdown"
              readOnly
              height="300px"
            />
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-xl border border-dark-700 p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Upload New Version</h2>
            <form onSubmit={handleUpload} className="space-y-4">
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
