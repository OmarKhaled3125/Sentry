import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

// 1. Column Section Header Node (Zero Icons, High Contrast)
const SectionHeaderNode = ({ data }) => {
  const darkMode = data.darkMode;
  const colors = {
    frontend: darkMode ? 'border-sky-500/60 bg-sky-950/40 text-sky-300' : 'border-sky-300 bg-sky-50/80 text-sky-950',
    backend: darkMode ? 'border-indigo-500/60 bg-indigo-950/40 text-indigo-300' : 'border-indigo-300 bg-indigo-50/80 text-indigo-950',
    ai: darkMode ? 'border-amber-500/60 bg-amber-950/40 text-amber-300' : 'border-amber-300 bg-amber-50/80 text-amber-950',
    database: darkMode ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300' : 'border-emerald-300 bg-emerald-50/80 text-emerald-950',
    core: darkMode ? 'border-teal-500/60 bg-teal-950/40 text-teal-300' : 'border-teal-300 bg-teal-50/80 text-teal-950',
  };

  const currentTheme = colors[data.category] || (darkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-300 bg-slate-100 text-slate-900');

  return (
    <div className={`w-[360px] px-5 py-3.5 rounded-2xl border-2 shadow-sm backdrop-blur-md flex items-center justify-between ${currentTheme}`}>
      <div>
        <h3 className="font-extrabold text-sm tracking-wide uppercase">{data.label}</h3>
        <p className={`text-[11px] font-normal mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          {data.description || 'Component Layer'}
        </p>
      </div>
      <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
        darkMode ? 'bg-black/40 text-slate-200 border-slate-700' : 'bg-white text-slate-800 border-slate-300'
      }`}>
        {data.count} {data.count === 1 ? 'FILE' : 'FILES'}
      </span>
      <Handle type="source" position={Position.Bottom} id="header-bottom" className="!opacity-0" />
    </div>
  );
};

// 2. Rich Component Node (Zero Icons, High Contrast)
const ComponentNode = ({ data, selected }) => {
  const darkMode = data.darkMode;
  const isSelected = selected || data.isSelected;

  const categoryStyles = {
    frontend: {
      accent: 'border-sky-500',
      badge: darkMode ? 'bg-sky-950/90 text-sky-300 border-sky-700' : 'bg-sky-100 text-sky-900 border-sky-300',
      tag: 'FRONTEND',
    },
    backend: {
      accent: 'border-indigo-500',
      badge: darkMode ? 'bg-indigo-950/90 text-indigo-300 border-indigo-700' : 'bg-indigo-100 text-indigo-900 border-indigo-300',
      tag: 'BACKEND',
    },
    ai: {
      accent: 'border-amber-500',
      badge: darkMode ? 'bg-amber-950/90 text-amber-300 border-amber-700' : 'bg-amber-100 text-amber-900 border-amber-300',
      tag: 'AI PIPELINE',
    },
    database: {
      accent: 'border-emerald-500',
      badge: darkMode ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-900 border-emerald-300',
      tag: 'STORAGE',
    },
    core: {
      accent: 'border-teal-500',
      badge: darkMode ? 'bg-teal-950/90 text-teal-300 border-teal-700' : 'bg-teal-100 text-teal-900 border-teal-300',
      tag: 'CORE',
    },
  };

  const style = categoryStyles[data.category] || {
    accent: 'border-slate-500',
    badge: darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-300',
    tag: (data.category || 'MODULE').toUpperCase(),
  };

  return (
    <div
      onClick={() => data.onSelectNode && data.onSelectNode(data)}
      className={`w-[360px] rounded-2xl border transition-all duration-200 cursor-pointer shadow-sm relative overflow-hidden group ${
        darkMode
          ? `bg-slate-900 text-slate-100 ${isSelected ? 'border-sky-400 ring-2 ring-sky-500/30' : 'border-slate-800 hover:border-slate-600'}`
          : `bg-white text-slate-900 ${isSelected ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-300 hover:border-slate-400'}`
      }`}
    >
      {/* Target Connection Handles */}
      <Handle type="target" position={Position.Left} id="left-target" className="!w-2 !h-2 !bg-sky-500 !border-slate-900" />
      <Handle type="target" position={Position.Top} id="top-target" className="!w-2 !h-2 !bg-sky-500 !border-slate-900" />

      {/* Top Accent Strip */}
      <div className={`h-1.5 w-full ${style.accent.replace('border-', 'bg-')}`} />

      {/* Card Header */}
      <div className={`p-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate font-mono text-slate-900 dark:text-slate-100 group-hover:text-sky-500 transition-colors">
              {data.name || data.label}
            </h4>
            <p className={`text-[10px] font-mono truncate mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {data.path || data.id}
            </p>
          </div>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border tracking-wider uppercase whitespace-nowrap ${style.badge}`}>
            {style.tag}
          </span>
        </div>

        {/* Summary Description */}
        {data.summary && (
          <p className={`text-xs mt-2.5 line-clamp-2 leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {data.summary}
          </p>
        )}
      </div>

      {/* Card Body - Content Sections */}
      <div className={`p-4 space-y-3 text-xs ${darkMode ? 'bg-slate-950/40' : 'bg-slate-50/70'}`}>
        {/* Endpoints */}
        {data.routes && data.routes.length > 0 && (
          <div>
            <div className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Endpoints ({data.routes.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.routes.map((route, i) => (
                <span
                  key={i}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold border ${
                    darkMode ? 'bg-indigo-950/70 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-900 border-indigo-300'
                  }`}
                >
                  {route}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Classes & Methods */}
        {data.classes && data.classes.length > 0 && (
          <div>
            <div className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Classes & Methods
            </div>
            <div className="space-y-1.5">
              {data.classes.map((cls, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg border text-[11px] font-mono ${
                    darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  <div className={`font-bold ${darkMode ? 'text-purple-300' : 'text-purple-800'}`}>class {cls.name}</div>
                  {cls.methods && cls.methods.length > 0 && (
                    <div className={`text-[10px] mt-1 pl-2 border-l ${darkMode ? 'text-slate-400 border-slate-700' : 'text-slate-600 border-slate-300'}`}>
                      {cls.methods.slice(0, 3).map((m) => `${m}()`).join(', ')}
                      {cls.methods.length > 3 && ` +${cls.methods.length - 3} more`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Functions */}
        {data.functions && data.functions.length > 0 && (
          <div>
            <div className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Functions ({data.functions.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.functions.slice(0, 4).map((fn, i) => (
                <span
                  key={i}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                    darkMode ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  }`}
                >
                  {fn}()
                </span>
              ))}
              {data.functions.length > 4 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  +{data.functions.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Imports / Dependencies */}
        {data.imports && data.imports.length > 0 && (
          <div>
            <div className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Imports
            </div>
            <div className="flex flex-wrap gap-1">
              {data.imports.slice(0, 5).map((imp, i) => (
                <span
                  key={i}
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                    darkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {imp}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Source Connection Handles */}
      <Handle type="source" position={Position.Right} id="right-source" className="!w-2 !h-2 !bg-sky-500 !border-slate-900" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="!w-2 !h-2 !bg-sky-500 !border-slate-900" />
    </div>
  );
};

const nodeTypes = {
  sectionHeader: SectionHeaderNode,
  componentNode: ComponentNode,
};

const ArchitecturePanel = ({
  nodes = [],
  edges = [],
  darkMode = false,
  onSelectNode = null,
  selectedNodeId = null,
}) => {
  const formattedNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        darkMode,
        onSelectNode,
        isSelected: selectedNodeId === node.id,
      },
    }));
  }, [nodes, darkMode, onSelectNode, selectedNodeId]);

  const formattedEdges = useMemo(() => {
    return edges.map((edge) => {
      const isHttp = edge.kind === 'http';
      const isTelemetry = edge.kind === 'telemetry';
      const isSql = edge.kind === 'sql';

      let strokeColor = darkMode ? '#64748b' : '#94a3b8';
      let strokeWidth = 1.5;

      if (isHttp) {
        strokeColor = darkMode ? '#38bdf8' : '#0284c7';
        strokeWidth = 2;
      } else if (isTelemetry) {
        strokeColor = darkMode ? '#f59e0b' : '#d97706';
        strokeWidth = 2;
      } else if (isSql) {
        strokeColor = darkMode ? '#34d399' : '#059669';
        strokeWidth = 1.8;
      }

      return {
        id: edge.id || `e-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        sourceHandle: edge.sourceHandle || 'right-source',
        targetHandle: edge.targetHandle || 'left-target',
        label: edge.label || '',
        animated: edge.animated ?? (isHttp || isTelemetry || isSql),
        style: {
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isHttp ? '5,5' : undefined,
        },
        labelStyle: {
          fill: darkMode ? '#f1f5f9' : '#0f172a',
          fontSize: 10,
          fontFamily: 'monospace',
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: darkMode ? '#0f172a' : '#ffffff',
          fillOpacity: 0.95,
          stroke: strokeColor,
          strokeWidth: 1,
          rx: 4,
          ry: 4,
        },
        labelBgPadding: [6, 4],
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 14,
          height: 14,
        },
      };
    });
  }, [edges, darkMode]);

  return (
    <div
      className={`w-full h-[82vh] min-h-[720px] rounded-2xl border shadow-sm overflow-hidden relative ${
        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'
      }`}
    >
      <ReactFlow
        nodes={formattedNodes}
        edges={formattedEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={1.5}
      >
        <Background
          color={darkMode ? '#334155' : '#cbd5e1'}
          gap={24}
          size={1.2}
          variant="dots"
        />
        <Controls
          className={`shadow-md rounded-xl overflow-hidden border ${
            darkMode ? 'fill-slate-200 bg-slate-900 border-slate-800' : 'fill-slate-800 bg-white border-slate-300'
          }`}
        />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            if (node.type === 'sectionHeader') return darkMode ? '#38bdf8' : '#0284c7';
            const cat = node.data?.category;
            if (cat === 'frontend') return '#38bdf8';
            if (cat === 'ai') return '#f59e0b';
            if (cat === 'database') return '#34d399';
            return '#818cf8';
          }}
          className={`rounded-xl border shadow-md overflow-hidden !bottom-4 !right-4 ${
            darkMode ? '!bg-slate-900/90 !border-slate-800' : '!bg-white/90 !border-slate-300'
          }`}
          maskColor={darkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.7)'}
        />
      </ReactFlow>
    </div>
  );
};

export default ArchitecturePanel;
