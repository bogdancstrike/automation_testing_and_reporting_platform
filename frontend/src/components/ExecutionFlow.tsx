import { useEffect, useMemo } from 'react';
import { ReactFlow, Background, Controls, MarkerType, useNodesState, useEdgesState } from '@xyflow/react';
import dagre from 'dagre';
import { Tag } from 'antd';
import '@xyflow/react/dist/style.css';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220;
const nodeHeight = 80;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: direction === 'TB' ? 'top' : 'left',
      sourcePosition: direction === 'TB' ? 'bottom' : 'right',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

export default function ExecutionFlow({ steps, status }: { steps: any[], status: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const initialNodes: any[] = [];
    const initialEdges: any[] = [];
    
    // Filter out network calls for a cleaner logical execution flow
    const flowSteps = steps.filter(s => !s.timings?.is_network);

    flowSteps.forEach((step, idx) => {
      let bg = "#ffffff", borderColor = "#d9d9d9";
      if (step.status === "passed") { bg = "#f6ffed"; borderColor = "#b7eb8f"; }
      else if (step.status === "failed") { bg = "#fff2f0"; borderColor = "#ffccc7"; }
      else if (step.status === "error") { bg = "#fff1f0"; borderColor = "#ffa39e"; }
      else if (step.status === "timeout") { bg = "#fffbe6"; borderColor = "#ffe58f"; }
      else if (status === "running" && step.status === "running") { bg = "#e6f4ff"; borderColor = "#91caff"; }
      else { bg = "#fafafa"; borderColor = "#e8e8e8"; }

      const currentId = String(step.id || step.name || `step-${idx}`);

      initialNodes.push({
        id: currentId,
        data: { 
          label: (
            <div style={{ padding: 4, textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{step.name}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                {step.timings?.method && <Tag color="blue" style={{ fontSize: 9, lineHeight: '14px', padding: '0 4px' }}>{step.timings.method}</Tag>} 
                {step.duration_ms !== undefined ? `${step.duration_ms}ms` : ""}
              </div>
            </div>
          )
        },
        style: {
          background: bg,
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          width: nodeWidth,
          boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
        }
      });

      if (idx > 0) {
        const prev = flowSteps[idx - 1];
        const prevId = String(prev.id || prev.name || `step-${idx - 1}`);
        initialEdges.push({
          id: `e-${prevId}-${currentId}`,
          source: prevId,
          target: currentId,
          animated: status === "running",
          markerEnd: { type: MarkerType.ArrowClosed, color: '#b1b1b7' },
          style: { stroke: '#b1b1b7', strokeWidth: 1.5 },
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges, 'TB');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [steps, status]);

  if (!steps || steps.length === 0) return null;

  return (
    <div style={{ width: '100%', height: 600, border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-right"
      >
        <Background gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
