'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Background,
  Controls,
  Handle,
  Position,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Loader2, DollarSign, User, CheckCircle2, Clock, ChevronRight, Terminal, Info, Zap, BrainCircuit, MessageSquareText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 240;
const nodeHeight = 120;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
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
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
};

// Custom Task Node Component
const TaskNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const statusColors = {
    pending: 'border-slate-800 bg-slate-950 text-slate-500',
    bidding: 'border-blue-500/30 bg-blue-500/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]',
    assigned: 'border-purple-500/30 bg-purple-500/10 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]',
    executing: 'border-yellow-500/50 bg-yellow-500/20 text-yellow-500 animate-status-pulse',
    completed: 'border-green-500/40 bg-green-500/10 text-green-400 animate-success-flash',
    failed: 'border-red-500/30 bg-red-500/10 text-red-400',
  };

  const statusIcons = {
    pending: <Clock className="w-3.5 h-3.5" />,
    bidding: <Zap className="w-3.5 h-3.5" />,
    assigned: <User className="w-3.5 h-3.5" />,
    executing: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    completed: <CheckCircle2 className="w-3.5 h-3.5" />,
    failed: <Clock className="w-3.5 h-3.5" />,
  };

  return (
    <div className={`p-4 rounded-2xl border-2 transition-all duration-500 relative ${selected ? 'scale-105 z-50 border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : ''} ${statusColors[data.status as keyof typeof statusColors] || statusColors.pending} w-[220px]`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-700 !w-2.5 !h-2.5 border-none" />
      
      {/* Reward Pop Animation */}
      <AnimatePresence>
        {data.status === 'completed' && (
          <motion.div 
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -30, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -top-4 -right-2 text-[10px] font-black text-green-400 font-mono bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20"
          >
            +${data.budget?.toFixed(2)} USDC
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-[0.15em] opacity-80">
            {data.status}
          </span>
          {statusIcons[data.status as keyof typeof statusIcons]}
        </div>
        
        <p className={`text-[11px] font-bold leading-tight line-clamp-2 min-h-[28px] ${selected ? 'text-white' : ''}`}>
          {data.label}
        </p>
        
        <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-current/10">
          <div className="flex items-center gap-1">
             <DollarSign className="w-3 h-3" />
             <span className="text-[10px] font-mono font-bold">${data.budget?.toFixed(2)}</span>
          </div>
          {data.assignedAgentId && (
            <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-0.5 rounded-md border border-white/5">
               <span className="text-[8px] font-black opacity-50 uppercase">Agent:</span>
               <span className="text-[9px] font-bold truncate max-w-[60px]">{data.assignedAgentId.slice(0, 5)}</span>
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-slate-700 !w-2.5 !h-2.5 border-none" />
    </div>
  );
};

const nodeTypes = {
  taskNode: TaskNode,
};

// Internal Graph Component with ReactFlow Context
const Graph = ({ taskId }: { taskId: string }) => {
  const { setCenter, getNode } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [devMode, setDevMode] = useState(false);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/tree`);
      if (!res.ok) return;
      const data = await res.json();
      
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        data.nodes,
        data.edges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      // Auto-Focus Logic: Find node in 'executing' state
      const activeNode = layoutedNodes.find(n => n.data.status === 'executing');
      if (activeNode) {
        setCenter(activeNode.position.x + nodeWidth / 2, activeNode.position.y + nodeHeight / 2, { zoom: 1.2, duration: 800 });
        setSelectedNode(activeNode);
      }
    } catch (err) {
      console.error('Failed to fetch tree:', err);
    }
  }, [taskId, setNodes, setEdges, setCenter]);

  useEffect(() => {
    fetchTree();
    const interval = setInterval(fetchTree, 3000);
    return () => clearInterval(interval);
  }, [fetchTree]);

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node);
  };

  return (
    <div className="h-[500px] w-full bg-slate-950/50 rounded-2xl border border-slate-800 overflow-hidden relative flex flex-col md:flex-row">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{
             style: { stroke: '#334155', strokeWidth: 3 },
             type: 'smoothstep',
             animated: true
          }}
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls showInteractive={false} className="!bg-slate-900 !border-slate-800 !fill-slate-400" />
          <Panel position="top-left" className="bg-slate-900/80 backdrop-blur-md p-2 rounded-lg border border-slate-800">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-slate-100 font-black uppercase tracking-widest">Cognitive Viewport v1.0</span>
             </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Narrative Side Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="w-full md:w-80 border-l border-slate-800 bg-slate-900/90 backdrop-blur-xl p-6 flex flex-col gap-6 overflow-y-auto z-10"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Info className="w-3 h-3" />
                Task Intelligence
              </h3>
              <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-white leading-tight">
                {selectedNode.data.label}
              </h4>
              <div className="flex items-center gap-2">
                 <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                   selectedNode.data.status === 'completed' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                   selectedNode.data.status === 'executing' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                   'bg-slate-800 border-slate-700 text-slate-400'
                 }`}>
                   {selectedNode.data.status}
                 </span>
              </div>
            </div>

            {/* agent summary */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-400" />
                 </div>
                 <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Assigned Agent</div>
                    <div className="text-sm font-bold text-slate-200">
                      {selectedNode.data.assignedAgentId ? `Agent ${selectedNode.data.assignedAgentId.slice(0, 8)}` : 'Awaiting Selection'}
                    </div>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <div className="text-[8px] font-bold text-slate-500 uppercase">Reward</div>
                    <div className="text-xs font-mono font-bold text-green-400">${selectedNode.data.budget?.toFixed(2)}</div>
                 </div>
                 <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <div className="text-[8px] font-bold text-slate-500 uppercase">Confidence</div>
                    <div className="text-xs font-mono font-bold text-blue-400">
                      {selectedNode.data.result?.confidence ? `${(selectedNode.data.result.confidence * 100).toFixed(0)}%` : '--'}
                    </div>
                 </div>
              </div>
              
              {/* Confidence Progress Bar */}
              {selectedNode.data.result?.confidence && (
                <div className="space-y-1 mt-2">
                  <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase">
                    <span>Model Confidence</span>
                    <span className="text-blue-400">{(selectedNode.data.result.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedNode.data.result.confidence * 100}%` }}
                      className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                </div>
              )}
            </div>

              {/* Phase 6: Memory Insights */}
              {selectedNode.data.agentMemory && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2 text-[10px] font-black text-purple-400 uppercase tracking-widest">
                    <BrainCircuit className="w-3 h-3" />
                    Memory Insights
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-950 p-2 rounded-lg border border-white/5">
                      <div className="text-[8px] font-bold text-slate-500 uppercase">Success Rate</div>
                      <div className="text-xs font-bold text-slate-200">
                        {selectedNode.data.agentMemory.successCount + selectedNode.data.agentMemory.failureCount > 0 
                          ? `${((selectedNode.data.agentMemory.successCount / (selectedNode.data.agentMemory.successCount + selectedNode.data.agentMemory.failureCount)) * 100).toFixed(0)}%`
                          : '100%'}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-white/5">
                      <div className="text-[8px] font-bold text-slate-500 uppercase">Context Depth</div>
                      <div className="text-xs font-bold text-slate-200">{selectedNode.data.agentMemory.pastTasks?.length || 0} Tasks</div>
                    </div>
                  </div>
                </div>
              )}

            {/* Phase 6: Communication Trace */}
            {selectedNode.data.messagesReceived?.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <MessageSquareText className="w-3 h-3" />
                  Communication Trace
                </h5>
                <div className="space-y-2">
                  {selectedNode.data.messagesReceived.map((m: any, i: number) => (
                    <div key={i} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[10px] space-y-1">
                      <div className="flex justify-between font-black uppercase text-blue-500/60">
                        <span>From: {m.fromAgentId}</span>
                        <span suppressHydrationWarning>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed italic line-clamp-2">"{m.content}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execution step history */}
            <div className="space-y-4">
               <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cognitive Timeline</h5>
               <div className="space-y-3">
                  {[
                    { label: 'Marketplace Open', done: true },
                    { label: 'Agent Assigned', done: !!selectedNode.data.assignedAgentId },
                    { label: 'Compute Executed', done: selectedNode.data.status === 'completed' || selectedNode.data.status === 'executing' },
                    { label: 'Final Settlement', done: selectedNode.data.status === 'completed' }
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${step.done ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-slate-800'}`} />
                      <span className={`text-[11px] ${step.done ? 'text-slate-200 font-bold' : 'text-slate-600'}`}>{step.label}</span>
                    </div>
                  ))}
               </div>
            </div>

            {/* Result Preview / Dev Mode */}
            <div className="mt-auto pt-4 border-t border-slate-800">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Agent Output</span>
                  <button 
                    onClick={() => setDevMode(!devMode)}
                    className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 rounded text-[9px] font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    <Terminal className="w-2.5 h-2.5" />
                    {devMode ? 'Hide Details' : 'Dev Mode'}
                  </button>
               </div>
               
               <div className={`p-3 rounded-xl border font-mono text-[11px] h-32 overflow-y-auto ${devMode ? 'bg-slate-950 border-blue-500/30 text-blue-400/90' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                  {selectedNode.data.result ? (
                    devMode ? JSON.stringify(selectedNode.data.result, null, 2) : selectedNode.data.result.result
                  ) : (
                    "Awaiting execution output..."
                  )}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
interface ExecutionGraphProps {
  taskId: string;
}

export const ExecutionGraph: React.FC<ExecutionGraphProps> = ({ taskId }) => (
  <ReactFlowProvider>
    <Graph taskId={taskId} />
  </ReactFlowProvider>
);
