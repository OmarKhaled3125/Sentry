import React, { useState, useEffect, useMemo, useRef } from 'react';
import ArchitecturePanel from './ArchitecturePanel';

const DEFAULT_LAYER_METADATA = {
  frontend: { label: 'Frontend Layer', description: 'User Interface & Client Components' },
  backend: { label: 'Backend Services', description: 'API Handlers & Server Services' },
  ai: { label: 'AI & Pipeline Core', description: 'LLM, RAG & Orchestration Engine' },
  database: { label: 'Database & Storage', description: 'Database Models & Telemetry Store' },
  core: { label: 'Core & Utilities', description: 'Shared Helpers & System Libraries' },
};

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
  const [discoveredProcesses, setDiscoveredProcesses] = useState([]);
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState('architecture');
  const [darkMode, setDarkMode] = useState(true);
  const [processSearchQuery, setProcessSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState({});

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

    const archUrl = targetPath ? `http://127.0.0.1:5000/api/architecture?path=${encodeURIComponent(targetPath)}` : 'http://127.0.0.1:5000/api/architecture';
    const tracesUrl = targetPath ? `http://127.0.0.1:5000/api/traces?path=${encodeURIComponent(targetPath)}` : 'http://127.0.0.1:5000/api/traces';
    const procsUrl = targetPath ? `http://127.0.0.1:5000/api/processes?path=${encodeURIComponent(targetPath)}` : 'http://127.0.0.1:5000/api/processes';

    Promise.all([
      fetch(archUrl).then((r) => r.json()),
      fetch(tracesUrl).then((r) => r.json()),
      fetch(procsUrl).then((r) => r.json()),
    ])
      .then(([archRes, tracesRes, procsRes]) => {
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

        const procs = procsRes.processes || [];
        setDiscoveredProcesses(procs);

        const projectSpans = tracesRes.spans || [];
        setSpans(projectSpans);

        if (procs.length > 0) {
          setSelectedProcessId(procs[0].process_id);
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

  const handleRunProcessSimulation = (targetProcId = null) => {
    setIsSimulating(true);
    const payload = { path: currentProjectPath };
    if (targetProcId) {
      payload.process_id = targetProcId;
    }

    fetch('http://127.0.0.1:5000/api/traces/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then(() => {
        setIsSimulating(false);
        const tracesUrl = `http://127.0.0.1:5000/api/traces?path=${encodeURIComponent(currentProjectPath)}`;
        fetch(tracesUrl)
          .then((r) => r.json())
          .then((tracesRes) => {
            setSpans(tracesRes.spans || []);
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
        return name.includes(q) || path.includes(q) || summary.includes(q);
      });
    }

    return buildGlobalArchitectureGraph(files, archData.cross_edges || [], archData.layers || []);
  }, [archData, selectedArchCategory, archSearchQuery]);

  // Group spans into structured processes
  const processGroups = useMemo(() => {
    const map = new Map();

    spans.forEach((span) => {
      let attr = {};
      try {
        attr = typeof span.attributes === 'string' ? JSON.parse(span.attributes) : (span.attributes || {});
      } catch (e) {
        attr = {};
      }

      const procId = span.process_id || attr.process_id || 'default_proc';

      if (!map.has(procId)) {
        map.set(procId, {
          processId: procId,
          traceId: span.trace_id,
          rootSpan: null,
          spans: [],
        });
      }

      const group = map.get(procId);
      group.spans.push({ ...span, parsedAttributes: attr });

      if (!span.parent_span_id) {
        group.rootSpan = { ...span, parsedAttributes: attr };
      }
    });

    return Array.from(map.values()).map((group) => {
      const rootAttr = group.rootSpan?.parsedAttributes || {};
      const processName = rootAttr.process_name || group.rootSpan?.name || group.processId;
      const childSpans = group.spans
        .filter((s) => s.parent_span_id !== null)
        .sort((a, b) => (a.start_time || 0) - (b.start_time || 0));

      const steps = childSpans.map((s, idx) => {
        const cleanName = s.name.replace(/^step_\d+_/, '').replace(/_/g, ' ');
        const duration = s.end_time && s.start_time ? Math.max((s.end_time - s.start_time) / 1e6, 0) : 0;
        return {
          id: s.span_id,
          stepNumber: idx + 1,
          name: cleanName,
          fullName: s.name,
          status: s.status_code || 'OK',
          duration,
          description: s.status_description,
          attributes: s.parsedAttributes,
          sourceFile: s.parsedAttributes?.source_file || 'main.py',
          span: s,
        };
      });

      const isError = group.spans.some((s) => s.status_code === 'ERROR');

      return {
        processId: group.processId,
        traceId: group.traceId,
        processName,
        category: rootAttr.category || 'core',
        status: isError ? 'FAILED' : 'COMPLETED',
        totalSteps: steps.length,
        steps,
        spans: group.spans,
      };
    });
  }, [spans]);

  const activeProcess = useMemo(() => {
    return processGroups.find((p) => p.processId === selectedProcessId) || processGroups[0] || null;
  }, [processGroups, selectedProcessId]);

  // Group sidebar process items by category
  const categorizedSidebarProcesses = useMemo(() => {
    let procs = discoveredProcesses.length > 0 ? discoveredProcesses : processGroups.map(p => ({
      process_id: p.processId,
      process_name: p.processName,
      category: p.category,
      total_steps: p.totalSteps
    }));

    if (processSearchQuery.trim()) {
      const q = processSearchQuery.toLowerCase();
      procs = procs.filter(p => p.process_name.toLowerCase().includes(q) || p.process_id.toLowerCase().includes(q));
    }

    const categories = {};
    procs.forEach((p) => {
      const cat = p.category || 'core';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(p);
    });

    return categories;
  }, [discoveredProcesses, processGroups, processSearchQuery]);

  const availableCategories = useMemo(() => {
    const rawCategories = [...new Set((archData.files || []).map((f) => f.category || classifyFileCategory(f)))];
    return rawCategories.map((key) => {
      const meta = (archData.layers || []).find((l) => l.key === key) || DEFAULT_LAYER_METADATA[key] || {
        label: key.toUpperCase(),
      };
      return { key, label: meta.label };
    });
  }, [archData]);

  const handleInspectInArchitecture = (sourceFile) => {
    setViewMode('architecture');
    const matchedFile = archData.files.find((f) => f.name === sourceFile || f.path.includes(sourceFile));
    if (matchedFile) {
      setInspectedNode(matchedFile);
    }
  };

  const toggleCategoryCollapse = (cat) => {
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className={`${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} min-h-screen font-sans p-6 flex flex-col gap-5 transition-colors duration-200`}>
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
              <h1 className={`text-base font-extrabold tracking-tight ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                TRACE FAILURE FORENSICS & PIPELINE ARCHITECTURES
              </h1>
              <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {currentProjectPath || 'Root Workspace'}
              </p>
            </div>
          </div>
        </div>

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

        <button
          onClick={() => setDarkMode((v) => !v)}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold tracking-wider transition-all ${
            darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100 shadow-sm'
          }`}
        >
          {darkMode ? 'LIGHT' : 'DARK'}
        </button>
      </header>

      {viewMode === 'architecture' ? (
        <div className="flex flex-col gap-4 flex-1">
          <div className={`p-4 rounded-2xl border shadow-sm flex flex-wrap items-center justify-between gap-4 ${
            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
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
                placeholder="Enter project folder path..."
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

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-bold font-mono uppercase tracking-wider mr-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                LAYER:
              </span>
              <button
                onClick={() => setSelectedArchCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold uppercase transition-all border ${
                  selectedArchCategory === 'all'
                    ? darkMode ? 'bg-sky-950 text-sky-300 border-sky-600 shadow-sm' : 'bg-sky-100 text-sky-900 border-sky-400 shadow-sm'
                    : darkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900'
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
                      ? darkMode ? 'bg-sky-950 text-sky-300 border-sky-600 shadow-sm' : 'bg-sky-100 text-sky-900 border-sky-400 shadow-sm'
                      : darkMode ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

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
          </div>
        </div>
      ) : (
        /* Execution Forensics View */
        <div className="flex gap-6 flex-1 items-start">
          {/* Multi-Process Collapsible Sidebar */}
          <aside className={`${sidebarCollapsed ? 'w-12' : 'w-80'} transition-all duration-300 flex-shrink-0`}>
            <div className={`h-full p-4 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
              {!sidebarCollapsed && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className={`text-xs tracking-widest uppercase font-bold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      DISCOVERED PROCESSES
                    </h2>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                      darkMode ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-sky-100 text-sky-900 border-sky-300'
                    }`}>
                      {discoveredProcesses.length || processGroups.length} ENTRY POINTS
                    </span>
                  </div>

                  {/* Search Filter Bar */}
                  <input
                    type="text"
                    placeholder="Filter processes..."
                    value={processSearchQuery}
                    onChange={(e) => setProcessSearchQuery(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-xl border font-mono mb-3 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />

                  {/* Grouped Process List */}
                  <div className="flex flex-col gap-3 max-h-[68vh] overflow-y-auto pr-1">
                    {Object.entries(categorizedSidebarProcesses).map(([category, procList]) => (
                      <div key={category} className="rounded-xl border border-slate-800/40 p-2">
                        <button
                          onClick={() => toggleCategoryCollapse(category)}
                          className={`w-full flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider mb-1 px-1 ${
                            darkMode ? 'text-sky-400' : 'text-sky-700'
                          }`}
                        >
                          <span>{category} ({procList.length})</span>
                          <span>{collapsedCategories[category] ? '+' : '−'}</span>
                        </button>

                        {!collapsedCategories[category] && (
                          <div className="space-y-1.5 mt-1">
                            {procList.map((proc) => {
                              const procId = proc.process_id || proc.processId;
                              const isSelected = activeProcess?.processId === procId;
                              const matchedGroup = processGroups.find((g) => g.processId === procId);
                              const isFailed = matchedGroup?.status === 'FAILED';

                              return (
                                <button
                                  key={procId}
                                  onClick={() => setSelectedProcessId(procId)}
                                  className={`text-left p-3 rounded-xl border transition-all duration-200 w-full text-xs shadow-sm ${
                                    isSelected
                                      ? darkMode
                                        ? 'bg-sky-950/80 text-sky-200 border-sky-600 shadow-md'
                                        : 'bg-sky-50 text-sky-950 border-sky-400 font-bold shadow-sm'
                                      : darkMode
                                      ? 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800'
                                      : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-mono text-xs font-bold truncate w-44">{proc.process_name || proc.processName}</span>
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        isFailed ? 'bg-red-500' : 'bg-emerald-500'
                                      }`}
                                    />
                                  </div>

                                  <div className={`text-[10px] flex items-center justify-between font-mono mt-1 ${
                                    darkMode ? 'text-slate-400' : 'text-slate-600'
                                  }`}>
                                    <span>{proc.total_steps || proc.totalSteps || 0} STEPS</span>
                                    <span className="font-semibold">{proc.source_file}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Main Forensics Flow Canvas */}
          <main className="flex-1 min-w-0">
            <div className={`rounded-2xl p-6 shadow-sm border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className={`text-xl font-bold font-mono uppercase ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    EXECUTION FORENSICS & PROCESS DETAILS
                  </h2>
                  <p className={`text-xs font-mono mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    ACTIVE PROCESS: {activeProcess?.processName || 'NONE'} ({activeProcess?.totalSteps || 0} STEPS DISCOVERED)
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRunProcessSimulation(activeProcess?.processId)}
                    disabled={isSimulating || !activeProcess}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-sm"
                  >
                    {isSimulating ? 'SIMULATING...' : 'SIMULATE THIS PROCESS'}
                  </button>
                  <button
                    onClick={() => handleRunProcessSimulation(null)}
                    disabled={isSimulating}
                    className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-sm"
                  >
                    RUN ALL
                  </button>
                </div>
              </div>

              {/* Selected Process Summary */}
              {activeProcess && (
                <div className={`p-4 rounded-xl border mb-6 flex items-center justify-between font-mono text-xs ${
                  darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Process Name</span>
                      <span className="font-bold text-sky-400">{activeProcess.processName}</span>
                    </div>
                    <div className="h-6 w-px bg-slate-700/50" />
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Process ID</span>
                      <span className="font-bold">{activeProcess.processId}</span>
                    </div>
                    <div className="h-6 w-px bg-slate-700/50" />
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Trace Run ID</span>
                      <span className="text-slate-400">{activeProcess.traceId}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-md text-[10px] font-bold border ${
                    activeProcess.status === 'FAILED'
                      ? 'bg-red-950/80 text-red-300 border-red-800'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  }`}>
                    {activeProcess.status}
                  </span>
                </div>
              )}

              {/* Horizontal Step Sequence Flow Diagram */}
              {activeProcess && (
                <div className="mb-6 overflow-x-auto pb-3">
                  <h3 className={`text-xs uppercase tracking-wider mb-3 font-bold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    HORIZONTAL STEP FLOW TIMELINE
                  </h3>
                  <div className="flex items-center gap-2 min-w-max">
                    {activeProcess.steps.map((st, idx) => (
                      <React.Fragment key={st.id}>
                        <div
                          className={`p-3 rounded-xl border shadow-sm w-48 flex-shrink-0 transition-all ${
                            st.status === 'ERROR'
                              ? darkMode ? 'bg-red-950/40 border-red-800' : 'bg-red-50 border-red-300 text-red-950'
                              : darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-mono font-bold text-sky-500">STEP {st.stepNumber}</span>
                            <span className={`text-[10px] font-mono font-bold ${st.status === 'ERROR' ? 'text-red-400' : 'text-emerald-500'}`}>
                              {st.status}
                            </span>
                          </div>
                          <div className="text-xs font-bold font-mono truncate">{st.name}</div>
                          <div className={`text-[10px] font-mono mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            {st.duration ? `${Math.round(st.duration)} ms` : '—'}
                          </div>
                        </div>

                        {idx < activeProcess.steps.length - 1 && (
                          <svg className="w-6 h-6 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              {/* Step Detail Telemetry Cards */}
              {activeProcess && (
                <div className="flex flex-col gap-4">
                  {activeProcess.steps.map((st) => {
                    const span = st.span;
                    return (
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
                            Step {st.stepNumber}: {span.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleInspectInArchitecture(st.sourceFile)}
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
                            <pre className={`p-3 rounded-xl text-[11px] font-mono overflow-x-auto h-28 border ${
                              darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                            }`}>
                              {JSON.stringify(st.attributes?.input || {}, null, 2)}
                            </pre>
                          </div>

                          <div>
                            <h4 className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              Output Result
                            </h4>
                            <pre className={`p-3 rounded-xl text-[11px] font-mono overflow-x-auto h-28 border ${
                              darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                            }`}>
                              {JSON.stringify(st.attributes?.output || {}, null, 2)}
                            </pre>
                          </div>

                          <div>
                            <h4 className={`text-[10px] uppercase font-bold tracking-wider mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              Telemetry Specs
                            </h4>
                            <div className={`text-xs space-y-1 p-3 rounded-xl border ${
                              darkMode ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'
                            }`}>
                              <div>SOURCE: <span className="font-mono text-sky-400">{st.sourceFile}</span></div>
                              <div>LATENCY: <span className="font-mono text-emerald-400">{st.duration ? `${Math.round(st.duration)} ms` : '—'}</span></div>
                              {span.status_description && (
                                <div className="mt-2 text-[10px] font-mono text-red-400 border border-red-900 p-1.5 rounded bg-red-950/30">
                                  {span.status_description}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default TraceDashboard; 
