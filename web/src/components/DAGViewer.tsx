import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'

const statusColors: Record<string, string> = {
  pending: '#64748b',
  running: '#3b82f6',
  success: '#22c55e',
  failed: '#ef4444',
  cancelled: '#a855f7',
}

interface TaskNodeData {
  label: string
  status: string
}

const TaskNode = ({ data }: { data: TaskNodeData }) => {
  const color = statusColors[data.status] || '#64748b'
  return (
    <div
      className="px-4 py-2 rounded-lg shadow-lg border-2 min-w-[160px] text-center"
      style={{ borderColor: color, backgroundColor: '#1e293b' }}
    >
      <div className="text-sm font-medium text-white truncate">{data.label}</div>
      <div className="text-xs mt-1 capitalize" style={{ color }}>
        {data.status}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  taskNode: TaskNode,
}

interface DAGViewerProps {
  tasks?: Array<{
    id: string
    name: string
    status: string
    started_at?: string
    finished_at?: string
  }>
}

export default function DAGViewer({ tasks = [] }: DAGViewerProps) {
  const initialNodes: Node[] = useMemo(() => {
    if (tasks.length === 0) {
      return [
        {
          id: 'placeholder',
          type: 'taskNode',
          position: { x: 250, y: 150 },
          data: { label: 'No tasks to display', status: 'pending' },
        },
      ]
    }

    const nodes: Node[] = tasks.map((task, index) => {
      const row = Math.floor(index / 3)
      const col = index % 3
      return {
        id: task.id,
        type: 'taskNode',
        position: { x: col * 280 + 50, y: row * 120 + 50 },
        data: { label: task.name, status: task.status },
      }
    })
    return nodes
  }, [tasks])

  const initialEdges: Edge[] = useMemo(() => {
    if (tasks.length === 0) return []
    const edges: Edge[] = []
    for (let i = 0; i < tasks.length - 1; i++) {
      edges.push({
        id: `e-${tasks[i].id}-${tasks[i + 1].id}`,
        source: tasks[i].id,
        target: tasks[i + 1].id,
        animated: tasks[i].status === 'running' || tasks[i + 1].status === 'running',
        style: { stroke: '#475569', strokeWidth: 2 },
      })
    }
    return edges
  }, [tasks])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onInit = useCallback(() => {
    // React Flow initialized
  }, [])

  return (
    <div className="h-[500px] w-full bg-dark-900 rounded-lg border border-dark-700 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls className="bg-dark-800 border-dark-600" />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as TaskNodeData
            return statusColors[data?.status || 'pending'] || '#64748b'
          }}
          maskColor="rgba(15, 23, 42, 0.8)"
          className="bg-dark-800"
        />
      </ReactFlow>
    </div>
  )
}
