import Editor from '@monaco-editor/react'

interface CodeEditorProps {
  value?: string
  language?: string
  onChange?: (value: string | undefined) => void
  readOnly?: boolean
  height?: string | number
}

export default function CodeEditor({
  value = '',
  language = 'yaml',
  onChange,
  readOnly = false,
  height = '400px',
}: CodeEditorProps) {
  const handleEditorDidMount = (_: any) => {
    // Editor mounted
  }

  return (
    <div className="rounded-lg border border-dark-700 overflow-hidden">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16 },
          wordWrap: 'on',
        }}
      />
    </div>
  )
}
