import React, { useState, useEffect, useMemo, useRef } from 'react';
import ArchitecturePanel from './ArchitecturePanel';

const DEFAULT_LAYER_METADATA = {
  frontend: { label: 'Frontend Layer', description: 'User Interface & Client Components' },
  backend: { label: 'Backend Services', description: 'API Handlers & Server Services' },
  ai: { label: 'AI & Pipeline Core', description: 'LLM, RAG & Orchestration Engine' },
  database: { label: 'Database & Storage', description: 'Database Models & Telemetry Store' },
  core: { label: 'Core & Utilities', description: 'Shared Helpers & System Libraries' },
};

// Generic System File Classifier
const classifyFileCategory = (file) => {
  if (file.category) return file.category;
  const path = (file.path || file.id || '').toLowerCase();
  const name = (file.name || file.label || '').toLowerCase();

  if (path.startsWith('frontend') || path.match(/\.(jsx|tsx|vue|svelte|html|css)$/) || name.includes('ui') || name.includes('dashboard') || name.includes('panel')) {
    return 'frontend';
  }
  if (name.includes('scanner') || name.includes('architecture') || name.includes('app.py') || path.includes('server') || path.includes('backend') || path.includes('api')) {
    return 'backend';
  }
  if (name.includes('pipeline') || name.includes('llm') || name.includes('rag') || name.includes('orchestrat') || name.includes('model') || name.includes('prompt')) {
    return 'ai';
  }
  if (name.includes('db') || name.includes('sqlite') || name.includes('exporter') || name.includes('store') || name.includes('schema') || path.includes('db')) {
    return 'database';
  }
  return 'core';
};

// Universal Collision-Free Column Layout Generator
const buildGlobalArchitectureGraph = (rawFiles = [], externalEdges = [], customLayers = []) => {
  const nodes = [];
  const edges = [];

  const processedFiles = rawFiles
    .filter((f) => f && (f.name || f.label || f.path || f.id))
    .map((file) => {
      const name = file.name || file.label || file.id?.split(':')?.pop() || 'Module';
      const path = file.path || file.file || file.id?.replace('file:', '') || name;
      const category = file.category || classifyFileCategory({ ...file, name, path });

      return {
        id: file.id || `file:${path}`,
        name,
        label: name,
        path,
        category,
        summary: file.summary || '',
        routes: file.routes || [],
        classes: file.classes || [],
        functions: file.functions || [],
        imports: file.imports || [],
        lines: file.lines || 0,
      };
    });

  const uniqueCategories = [...new Set(processedFiles.map((f) => f.category))];
  const columns = [];

  uniqueCategories.forEach((catKey) => {
    const meta = customLayers.find((l) => l.key === catKey) || DEFAULT_LAYER_METADATA[catKey] || {
      label: `${catKey.toUpperCase()} LAYER`,
      description: `${catKey.toUpperCase()} components & modules`,
    };

    columns.push({
      key: catKey,
      label: meta.label || catKey,
      description: meta.description || '',
      files: processedFiles.filter((f) => f.category === catKey),
    });
  });

  if (columns.length === 0) {
    columns.push({
      key: 'modules',
      label: 'PROJECT MODULES',
      description: 'Discovered source files',
      files: processedFiles,
    });
  }

  const COLUMN_X_SPACING = 480;
  const START_X = 60;
  const HEADER_Y = 40;
  const FIRST_CARD_Y = 150;
  const CARD_VERTICAL_GAP = 80;

  // ... other code unchanged ...


  columns.forEach((col, colIdx) => {
    const colX = START_X + colIdx * COLUMN_X_SPACING;
    const sectionId = `sec-${col.key}`;

    nodes.push({
      id: sectionId,
      type: 'sectionHeader',
      position: { x: colX, y: HEADER_Y },
      data: {
        label: col.label,
        description: col.description,
        count: col.files.length,
        category: col.key,
      },
    });

    let currentY = FIRST_CARD_Y;

    col.files.forEach((file) => {
      let cardHeight = 170;
      if (file.routes && file.routes.length > 0) cardHeight += 50;
      if (file.classes && file.classes.length > 0) cardHeight += 65 * file.classes.length;
      if (file.functions && file.functions.length > 0) cardHeight += 45;
      if (file.imports && file.imports.length > 0) cardHeight += 40;

      nodes.push({
        id: file.id,
        type: 'componentNode',
        position: { x: colX, y: currentY },
        data: {
          ...file,
          category: col.key,
        },
      });

      currentY += cardHeight + CARD_VERTICAL_GAP;
    });
  });

  const validNodeIds = new Set(nodes.map((n) => n.id));

  externalEdges.forEach((extEdge) => {
    if (validNodeIds.has(extEdge.source) && validNodeIds.has(extEdge.target)) {
      edges.push({
        ...extEdge,
        id: extEdge.id || `e-${extEdge.source}->${extEdge.target}`,
        sourceHandle: 'right-source',
        targetHandle: 'left-target',
      });
    }
  });

  return { nodes, edges };
};

const TraceDashboard = () => {
  const [spans, setSpans] = useState([]);
  const [selectedTraceId, setSelectedTraceId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState('architecture');
  const [darkMode, setDarkMode] = useState(true);

  // Project state
  const [currentProjectPath, setCurrentProjectPath] = useState('');
  const [customPathInput, setCustomPathInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [archData, setArchData] = useState({ project: '', files: [], cross_edges: [], layers: [] });
  const [selectedArchCategory, setSelectedArchCategory] = useState('all');
  const [archSearchQuery, setArchSearchQuery] = useState('');
  const [inspectedNode, setInspectedNode] = useState(null);

  const [architectureNodes, setArchitectureNodes] = useState([]);
  const [architectureEdges, setArchitectureEdges] = useState([]);
  const directoryInputRef = useRef(null);

  const fetchProject = (targetPath = '') => {
    setIsScanning(true);
    setScanError(null);

    const archUrl = targetPath
      ? `http://127.0.0.1:5000/api/architecture?path=${encodeURIComponent(targetPath)}`
      : 'http://127.0.0.1:5000/api/architecture';

    const tracesUrl = targetPath
      ? `http://127.0.0.1:5000/api/traces?path=${encodeURIComponent(targetPath)}`
      : 'http://127.0.0.1:5000/api/traces';

    Promise.all([
      fetch(archUrl).then((r) => r.json()),
      fetch(tracesUrl).then((r) => r.json()),
    ])
      .then(([archRes, tracesRes]) => {
        setIsScanning(false);
        if (archRes.error) {
          setScanError(archRes.error);
          return;
        }

        const projectPath = archRes.root_path || targetPath || '';
        setCurrentProjectPath(projectPath);
        setCustomPathInput(projectPath);

        const files = archRes.files || archRes.nodes || [];
        const edges = archRes.cross_edges || archRes.edges || [];
        const layers = archRes.layers || [];
        setArchData({ project: archRes.project || 'Trace Failure Forensics & Pipeline Architectures', root_path: projectPath, files, cross_edges: edges, layers });

        const layout = buildGlobalArchitectureGraph(files, edges, layers);
        setArchitectureNodes(layout.nodes);
        setArchitectureEdges(layout.edges);

        // Update spans for this project
        const projectSpans = tracesRes.spans || (Array.isArray(tracesRes) ? tracesRes : []);
        setSpans(projectSpans);
        if (projectSpans.length > 0) {
          setSelectedTraceId(projectSpans[0].trace_id);
        } else {
          setSelectedTraceId(null);
        }
      })
      .catch((err) => {
        setIsScanning(false);
        setScanError(err.message || 'Failed to scan project');
      });
  };

  useEffect(() => {
    fetchProject('');
  }, []);

  // Native OS directory browse handler
  const handleBrowseDirectory = () => {
    setIsScanning(true);
    fetch('http://127.0.0.1:5000/api/browse-directory', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        setIsScanning(false);
        if (data.path) {
          setCustomPathInput(data.path);
          fetchProject(data.path);
        }
      })
      .catch(() => {
        setIsScanning(false);
        if (directoryInputRef.current) {
          directoryInputRef.current.click();
        }
      });
  };

  const handleHtml5DirectorySelected = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const samplePath = files[0].webkitRelativePath || '';
      const topDir = samplePath.split('/')[0];
      if (topDir) {
        setCustomPathInput(topDir);
        fetchProject(topDir);
      }
    }
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    fetch('http://127.0.0.1:5000/api/traces/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentProjectPath }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsSimulating(false);
        // Refresh traces
        fetch(`http://127.0.0.1:5000/api/traces?path=${encodeURIComponent(currentProjectPath)}`)
          .then((r) => r.json())
          .then((tracesRes) => {
            const projectSpans = tracesRes.spans || (Array.isArray(tracesRes) ? tracesRes : []);
            setSpans(projectSpans);
            if (data.spans && data.spans.length > 0) {
              setSelectedTraceId(data.spans[0].trace_id);
            }
          });
      })
      .catch((err) => {
        setIsSimulating(false);
        console.error('Simulation error:', err);
      });
  };

  const displayedGraph = useMemo(() => {
    let files = archData.files || [];

    if (selectedArchCategory !== 'all') {
      files = files.filter((f) => {
        const cat = f.category || classifyFileCategory(f);
        return cat === selectedArchCategory;
      });
    }

    if (archSearchQuery.trim()) {
      const q = archSearchQuery.toLowerCase();
      files = files.filter((f) => {
        const name = (f.name || f.label || '').toLowerCase();
        const path = (f.path || '').toLowerCase();
        const summary = (f.summary || '').toLowerCase();
        const routes = (f.routes || []).some((r) => r.toLowerCase().includes(q));
        const functions = (f.functions || []).some((fn) => fn.toLowerCase().includes(q));
        const classes = (f.classes || []).some((c) => c.name.toLowerCase().includes(q));
        return name.includes(q) || path.includes(q) || summary.includes(q) || routes || functions || classes;
      });
    }

    return buildGlobalArchitectureGraph(files, archData.cross_edges || [], archData.layers || []);
  }, [archData, selectedArchCategory, archSearchQuery]);

  const traces = [...new Set(spans.map((s) => s.trace_id))];
  const activeSpans = spans.filter((s) => s.trace_id === selectedTraceId).sort((a, b) => (a.start_time || 0) - (b.start_time || 0));

  const stepStatus = activeSpans.map((s) => {
    const cleanName = s.name.replace(/^step_\d+_/, '').replace(/_/g, ' ');
    const duration = s.end_time && s.start_time ? Math.max((s.end_time - s.start_time) / 1e6, 0) : 0;
    return {
      id: s.span_id,
      name: cleanName,
      fullName: s.name,
      status: s.status_code || 'OK',
      duration,
      description: s.status_description,
    };
  });

  const availableCategories = useMemo(() => {
    const rawCategories = [...new Set((archData.files || []).map((f) => f.category || classifyFileCategory(f)))];
    return rawCategories.map((key) => {
      const meta = (archData.layers || []).find((l) => l.key === key) || DEFAULT_LAYER_METADATA[key] || {
        label: key.toUpperCase(),
      };
      return { key, label: meta.label };
    });
  }, [archData]);

  const handleInspectInArchitecture = (spanName) => {
    setViewMode('architecture');
    const matchedFile = archData.files.find((f) => {
      const inFunctions = (f.functions || []).some((fn) => spanName.includes(fn) || fn.includes(spanName));
      const inName = spanName.toLowerCase().includes(f.name.toLowerCase().replace(/\.[^/.]+$/, ''));
      return inFunctions || inName;
    });
    if (matchedFile) {
      setInspectedNode(matchedFile);
    }
  };

  return (
    <div className={`${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} min-h-screen font-sans p-6 flex flex-col gap-5 transition-colors duration-200`}>
      {/* Hidden HTML5 folder fallback input */}
      <input
        type="file"
        ref={directoryInputRef}
        webkitdirectory="true"
        directory="true"
        onChange={handleHtml5DirectorySelected}
        className="hidden"
      />

      {/* Header Bar */}
      <header className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border shadow-sm backdrop-blur-md relative ${
        darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
      }`}>
        <div className="flex items-center gap-4">
          {viewMode === 'forensics' && (
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-colors ${
                darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              }`}
            >
              {sidebarCollapsed ? 'EXPAND' : 'COLLAPSE'}
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-mono font-black text-sm shadow-sm">
              FF
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className={`text-base font-extrabold tracking-tight ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>TRACE FAILURE FORENSICS & PIPELINE ARCHITECTURES</h1>
                {/* Project Header */}
              </div>
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {currentProjectPath || 'Root Workspace'}
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className={`border rounded-xl p-1 flex gap-1 shadow-sm ${darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'}`}>
          <button
            onClick={() => setViewMode('architecture')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider transition-all uppercase ${
              viewMode === 'architecture'
                ? darkMode ? 'bg-sky-600 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm border border-slate-300'
                : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            SYSTEM ARCHITECTURE
          </button>
          <button
            onClick={() => setViewMode('forensics')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wider transition-all uppercase ${
              viewMode === 'forensics'
                ? darkMode ? 'bg-sky-600 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm border border-slate-300'
                : darkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EXECUTION FORENSICS
          </button>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setDarkMode((v) => !v)}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold tracking-wider transition-all ${
            darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-sm'
          }`}
        >
          {darkMode ? 'LIGHT' : 'DARK'}
        </button>
      </header>

      {/* Main Content Areas */}
      {viewMode === 'architecture' ? (
        <div className="flex flex-col gap-4 flex-1">
          {/* Architecture Toolbar */}
          <div className={`p-4 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-4 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            {/* Custom Project Scanner Input + Browse Button */}
            <div className="flex items-center gap-2 flex-1 min-w-[340px] max-w-xl">
              <button
                onClick={handleBrowseDirectory}
                disabled={isScanning}
                className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold font-mono tracking-wider transition-all shadow-sm flex items-center gap-1 uppercase ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-sky-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                }`}
              >
                BROWSE
              </button>
              <input
                type="text"
                placeholder="Enter project folder path (e.g. . or d:/MyProject)..."
                value={customPathInput}
                onChange={(e) => setCustomPathInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchProject(customPathInput)}
                className={`flex-1 px-3 py-1.5 text-xs rounded-xl border font-mono transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  darkMode ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                onClick={() => fetchProject(customPathInput)}
                disabled={isScanning}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-sm"
              >
                {isScanning ? 'SCANNING...' : 'SCAN'}
              </button>
            </div>

            {/* Dynamic Layer Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-bold font-mono uppercase tracking-wider mr-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                LAYER:
              </span>
              <button
                onClick={() => setSelectedArchCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase transition-all border ${
                  selectedArchCategory === 'all'
                    ? darkMode
                      ? 'bg-sky-950 text-sky-300 border-sky-600 shadow-sm'
                      : 'bg-sky-100 text-sky-900 border-sky-400 shadow-sm'
                    : darkMode
                    ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900'
                }`}
              >
                ALL
              </button>
              {availableCategories.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedArchCategory(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase transition-all border ${
                    selectedArchCategory === tab.key
                      ? darkMode
                        ? 'bg-sky-950 text-sky-300 border-sky-600 shadow-sm'
                        : 'bg-sky-100 text-sky-900 border-sky-400 shadow-sm'
                      : darkMode
                      ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      : 'bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search symbols..."
                  value={archSearchQuery}
                  onChange={(e) => setArchSearchQuery(e.target.value)}
                  className={`w-48 px-3 py-1.5 text-xs rounded-xl border font-mono transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                    darkMode ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
                {archSearchQuery && (
                  <button
                    onClick={() => setArchSearchQuery('')}
                    className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
          </div>

          {scanError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono flex items-center justify-between">
              <span>SCANNER ERROR: {scanError}</span>
              <button onClick={() => setScanError(null)} className="text-red-400 hover:text-red-200">CLOSE</button>
            </div>
          )}

          {/* Architecture Canvas + Node Inspector Drawer */}
          <div className="flex gap-4 flex-1 items-start relative">
            <div className="flex-1">
              <ArchitecturePanel
                nodes={displayedGraph.nodes}
                edges={displayedGraph.edges}
                darkMode={darkMode}
                onSelectNode={(nodeData) => setInspectedNode(nodeData)}
                selectedNodeId={inspectedNode?.id}
              />
            </div>

            {/* Node Inspector Drawer */}
            {inspectedNode && (
              <div
                className={`w-96 rounded-2xl border shadow-xl p-5 flex flex-col gap-4 animate-in slide-in-from-right duration-200 ${
                  darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <div className={`flex items-center justify-between border-b pb-3 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div>
                    <h3 className={`font-bold text-sm font-mono truncate w-64 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      {inspectedNode.name}
                    </h3>
                    <p className={`text-[10px] font-mono truncate mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {inspectedNode.path}
                    </p>
                  </div>
                  <button
                    onClick={() => setInspectedNode(null)}
                    className="text-xs font-mono font-bold px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    CLOSE
                  </button>
                </div>

                {inspectedNode.summary && (
                  <div>
                    <div className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Description
                    </div>
                    <p className={`text-xs leading-relaxed p-2.5 rounded-xl border ${
                      darkMode ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                    }`}>
                      {inspectedNode.summary}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`p-2.5 rounded-xl border ${
                    darkMode ? 'bg-slate-950/50 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}>
                    <div className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Layer</div>
                    <div className="font-mono font-bold uppercase mt-0.5 text-sky-600 dark:text-sky-400">{inspectedNode.category}</div>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    darkMode ? 'bg-slate-950/50 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}>
                    <div className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>Size</div>
                    <div className="font-mono font-bold mt-0.5">{inspectedNode.lines || '—'} lines</div>
                  </div>
                </div>

                {inspectedNode.routes && inspectedNode.routes.length > 0 && (
                  <div>
                    <div className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Exposed Endpoints
                    </div>
                    <div className="space-y-1">
                      {inspectedNode.routes.map((r, i) => (
                        <div key={i} className={`text-xs font-mono p-2 rounded-lg border font-semibold ${
                          darkMode ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300' : 'bg-indigo-50 border-indigo-300 text-indigo-900'
                        }`}>
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inspectedNode.classes && inspectedNode.classes.length > 0 && (
                  <div>
                    <div className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Classes & Methods
                    </div>
                    <div className="space-y-1.5">
                      {inspectedNode.classes.map((cls, i) => (
                        <div key={i} className={`p-2 rounded-lg border font-mono text-xs ${
                          darkMode ? 'bg-purple-950/30 border-purple-800/60' : 'bg-purple-50 border-purple-200'
                        }`}>
                          <div className={`font-bold ${darkMode ? 'text-purple-300' : 'text-purple-900'}`}>class {cls.name}</div>
                          {cls.methods && cls.methods.length > 0 && (
                            <div className={`text-[11px] mt-1 pl-2 border-l ${darkMode ? 'text-slate-400 border-slate-700' : 'text-slate-600 border-slate-300'}`}>
                              {cls.methods.map((m) => `${m}()`).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inspectedNode.functions && inspectedNode.functions.length > 0 && (
                  <div>
                    <div className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Functions ({inspectedNode.functions.length})
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-1">
                      {inspectedNode.functions.map((fn, i) => (
                        <span key={i} className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                          darkMode ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        }`}>
                          {fn}()
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {inspectedNode.imports && inspectedNode.imports.length > 0 && (
                  <div>
                    <div className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Dependencies ({inspectedNode.imports.length})
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1">
                      {inspectedNode.imports.map((imp, i) => (
                        <span key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                          darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'
                        }`}>
                          {imp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Execution Forensics View */
        <div className="flex gap-6 flex-1 items-start">
          {/* Execution Vault Sidebar */}
          <aside className={`${sidebarCollapsed ? 'w-12' : 'w-72'} transition-all duration-300 flex-shrink-0`}>
            <div className={`h-full p-4 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
              {!sidebarCollapsed && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className={`text-xs tracking-widest uppercase font-bold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      EXECUTION VAULT
                    </h2>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                      darkMode ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-sky-100 text-sky-900 border-sky-300'
                    }`}>
                      {traces.length} TRACES
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 max-h-[72vh] overflow-y-auto pr-1">
                    {traces.map((traceId) => {
                      const traceSpans = spans.filter((s) => s.trace_id === traceId);
                      const isError = traceSpans.some((s) => s.status_code === 'ERROR');
                      return (
                        <button
                          key={traceId}
                          onClick={() => setSelectedTraceId(traceId)}
                          className={`text-left p-3 rounded-xl border transition-all duration-200 w-full text-xs shadow-sm ${
                            selectedTraceId === traceId
                              ? darkMode
                                ? 'bg-sky-950/60 text-sky-200 border-sky-600 shadow-md'
                                : 'bg-sky-50 text-sky-950 border-sky-400 font-bold shadow-sm'
                              : darkMode
                              ? 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                              : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[11px] truncate w-40">{traceId}</span>
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                isError ? 'bg-red-500 shadow-sm' : 'bg-emerald-500 shadow-sm'
                              }`}
                            />
                          </div>
                          <div className={`text-[10px] mt-1 flex items-center justify-between font-mono ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            <span>{traceSpans.length} SPANS</span>
                            <span className="font-bold">{isError ? 'FAILED' : 'SUCCESS'}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Trace Forensics Main Canvas */}
          <main className="flex-1">
            <div className={`rounded-2xl p-6 shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className={`text-xl font-bold font-mono uppercase ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    EXECUTION FORENSICS
                  </h2>
                  <p className={`text-xs font-mono mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    ACTIVE TRACE: {selectedTraceId || 'NONE'}
                  </p>
                </div>
                <button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-sm"
                >
                  {isSimulating ? 'SIMULATING RUN...' : 'SIMULATE PIPELINE RUN'}
                </button>
              </div>

              {/* Dynamic Pipeline Flow Steps (Chronological) */}
              <div className="mb-6">
                <h3 className={`text-xs uppercase tracking-wider mb-3 font-bold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  STEP SEQUENCE ({stepStatus.length} STEPS)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {stepStatus.map((st, idx) => (
                    <div
                      key={st.id || idx}
                      className={`p-3.5 rounded-xl border flex-1 shadow-sm transition-all ${
                        st.status === 'ERROR'
                          ? darkMode ? 'bg-red-950/30 border-red-800' : 'bg-red-50 border-red-300 text-red-950'
                          : st.status === 'OK'
                          ? darkMode ? 'bg-emerald-950/20 border-emerald-800/80' : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className={`text-xs font-bold capitalize font-mono ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                            {idx + 1}. {st.name}
                          </div>
                          <div className={`text-[10px] font-mono font-bold mt-0.5 ${st.status === 'ERROR' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {st.status}
                          </div>
                        </div>
                        <div className={`text-[10px] font-mono font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          {st.duration ? `${Math.round(st.duration)} ms` : '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Universal Spans Detail List */}
              <div className="flex flex-col gap-4">
                {activeSpans.map((span) => (
                  <div
                    key={span.span_id}
                    className={`p-5 rounded-2xl border shadow-sm transition-all ${
                      span.status_code === 'ERROR'
                        ? darkMode ? 'border-red-900/60 bg-red-950/20' : 'border-red-300 bg-red-50/70'
                        : darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className={`text-base font-bold font-mono ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {span.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleInspectInArchitecture(span.name)}
                          className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-md border transition-colors ${
                            darkMode ? 'bg-sky-950/80 text-sky-300 border-sky-700 hover:bg-sky-900' : 'bg-sky-50 text-sky-900 border-sky-300 hover:bg-sky-100'
                          }`}
                        >
                          LOCATE IN ARCHITECTURE
                        </button>
                        <span
                          className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border ${
                            span.status_code === 'ERROR'
                              ? 'bg-red-500/20 text-red-500 border-red-500/30'
                              : darkMode ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}
                        >
                          {span.status_code}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h4 className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Input Payload
                        </h4>
                        <pre className={`p-3 rounded-xl text-[11px] font-mono overflow-x-auto h-32 border ${
                          darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`}>
                          {JSON.stringify(span.attributes?.input_query || span.attributes?.input || span.attributes || {}, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <h4 className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Output Result
                        </h4>
                        <pre className={`p-3 rounded-xl text-[11px] font-mono overflow-x-auto h-32 border ${
                          darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`}>
                          {JSON.stringify(span.attributes?.output || span.attributes?.['output.context'] || span.attributes?.['output.prompt'] || span.attributes?.['output.final_response'] || {}, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <h4 className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                          Span Telemetry
                        </h4>
                        <div className={`text-xs space-y-1.5 p-3 rounded-xl border ${
                          darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`}>
                          <div>SPAN ID: <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400">{span.span_id}</span></div>
                          <div>PARENT ID: <span className="font-mono text-[11px]">{span.parent_span_id || 'ROOT'}</span></div>
                          <div>LATENCY: <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">{span.start_time && span.end_time ? `${Math.round((span.end_time - span.start_time) / 1e6)} ms` : '—'}</span></div>
                          {span.status_description && (
                            <div className={`mt-2 text-[11px] font-mono p-2 rounded border ${
                              darkMode ? 'bg-red-950/40 text-red-300 border-red-900' : 'bg-red-50 text-red-900 border-red-300'
                            }`}>
                              ERROR: {span.status_description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default TraceDashboard;
