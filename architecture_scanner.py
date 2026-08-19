import ast
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

IGNORED_DIRS = {
    '.git',
    '.venv',
    'venv',
    'env',
    '__pycache__',
    'node_modules',
    '.pytest_cache',
    '.mypy_cache',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.idea',
    '.vscode',
    '.agents',
    '.system_generated',
    'coverage',
    'target',
}

SOURCE_EXTENSIONS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.sql', '.html', '.css', '.vue', '.svelte', '.go', '.rs', '.java', '.rb', '.php', '.cs'
}


def _rel_path(root: str, path: str) -> str:
    return os.path.relpath(path, root).replace('\\', '/')


def _classify_category(rel_path: str, content: str, imports: List[str], routes: List[str]) -> str:
    path_lower = rel_path.lower()
    content_lower = content.lower()
    imports_lower = [imp.lower() for imp in imports]

    # 1. Frontend / UI
    if any(path_lower.endswith(ext) for ext in ['.jsx', '.tsx', '.vue', '.svelte', '.html', '.css', '.scss', '.less']):
        return 'frontend'
    if any(k in path_lower.split('/') for k in ['frontend', 'ui', 'client', 'web', 'views', 'pages', 'components', 'styles', 'public']):
        return 'frontend'
    if any(k in imports_lower for k in ['react', 'react-dom', 'vue', 'svelte', 'reactflow', 'next', 'tailwind']):
        return 'frontend'

    # 2. AI / ML / Pipeline
    ai_keywords = ['ai', 'ml', 'pipeline', 'llm', 'rag', 'model', 'agent', 'prompt', 'embedding', 'orchestrat', 'chains', 'nlp', 'inference', 'training', 'retriev']
    ai_imports = ['openai', 'anthropic', 'langchain', 'llamaindex', 'transformers', 'torch', 'tensorflow', 'keras', 'sklearn', 'huggingface', 'opentelemetry', 'chromadb', 'pinecone', 'weaviate', 'qdrant', 'faiss']
    if any(k in path_lower for k in ai_keywords):
        return 'ai'
    if any(any(ai_lib in imp for ai_lib in ai_imports) for imp in imports_lower):
        return 'ai'
    if any(k in content_lower for k in ['start_as_current_span', 'vector_store', 'retrieve_context', 'generate_response', 'llm', 'embed']):
        return 'ai'

    # 3. Database / Storage
    db_keywords = ['db', 'database', 'sql', 'models', 'schema', 'migration', 'repository', 'store', 'storage', 'orm', 'sqlite', 'postgres', 'mysql', 'mongo', 'redis']
    db_imports = ['sqlite3', 'sqlalchemy', 'prisma', 'mongoose', 'psycopg2', 'psycopg', 'pymongo', 'redis', 'alembic', 'typeorm', 'peewee', 'tortoise']
    if any(k in path_lower for k in db_keywords):
        return 'database'
    if any(any(db_lib in imp for db_lib in db_imports) for imp in imports_lower):
        return 'database'
    if any(k in content_lower for k in ['create table', 'insert into', 'select * from', 'sqlite3.connect', 'cursor.execute', 'spanexporter']):
        if not routes and 'app.py' not in path_lower and 'server' not in path_lower:
            return 'database'

    # 4. Backend / API Services
    backend_keywords = ['backend', 'server', 'api', 'service', 'controller', 'route', 'handler', 'endpoint', 'middleware']
    backend_imports = ['flask', 'flask_cors', 'fastapi', 'express', 'django', 'koa', 'nest', 'gin', 'fiber', 'actix', 'tornado', 'bottle', 'starlette']
    if routes or any(k in path_lower for k in backend_keywords):
        return 'backend'
    if any(any(be_lib in imp for be_lib in backend_imports) for imp in imports_lower):
        return 'backend'

    # 5. Core / Utilities
    if any(k in path_lower for k in ['util', 'helper', 'common', 'core', 'lib', 'config', 'tool', 'scanner']):
        return 'core'

    return 'backend'


def _extract_docstring_or_comment(content: str) -> Optional[str]:
    # Check for python module docstring
    py_doc = re.search(r'^(?:"""|\'\'\')(.*?)(?:"""|\'\'\')', content.strip(), re.DOTALL)
    if py_doc:
        doc = py_doc.group(1).strip()
        lines = [line.strip() for line in doc.splitlines() if line.strip()]
        if lines:
            return lines[0]

    # Check for JS/TS leading JSDoc comment
    js_doc = re.search(r'^\s*/\*\*(.*?)\*/', content.strip(), re.DOTALL)
    if js_doc:
        cleaned = re.sub(r'^\s*\*+\s?', '', js_doc.group(1), flags=re.MULTILINE).strip()
        lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
        if lines:
            return lines[0]

    # Check for leading single-line comment
    single_doc = re.search(r'^(?:#|//)\s*(.+)$', content.strip(), re.MULTILINE)
    if single_doc:
        comment = single_doc.group(1).strip()
        if len(comment) > 10 and not comment.startswith(('!', '-', '=')):
            return comment

    return None


def _generate_dynamic_file_summary(
    name: str,
    category: str,
    docstring: Optional[str],
    routes: List[str],
    classes: List[Dict[str, Any]],
    functions: List[str],
    imports: List[str],
    rendered_components: List[str]
) -> str:
    if docstring and len(docstring) > 15:
        return docstring

    parts: List[str] = []

    if routes:
        parts.append(f'Exposes {len(routes)} REST endpoint(s) ({", ".join(routes[:2])})')
    if classes:
        class_names = [c['name'] for c in classes[:2]]
        total_methods = sum(len(c.get('methods', [])) for c in classes)
        if total_methods > 0:
            parts.append(f'Defines class {", ".join(class_names)} with {total_methods} method(s)')
        else:
            parts.append(f'Defines class {", ".join(class_names)}')
    if functions and not classes and not routes:
        parts.append(f'Provides {len(functions)} function(s) ({", ".join(functions[:3])})')
    if rendered_components:
        parts.append(f'Renders UI components: {", ".join(rendered_components[:3])}')

    if parts:
        return '. '.join(parts) + '.'

    key_libs = [imp for imp in imports if not imp.startswith('.')][:3]
    if key_libs:
        return f'{category.capitalize()} module integrating with {", ".join(key_libs)}.'

    return f'{category.capitalize()} component ({name}).'


def _scan_python_file(file_path: str, rel_path: str) -> Dict[str, Any]:
    file_name = os.path.basename(file_path)
    try:
        source = Path(file_path).read_text(encoding='utf-8', errors='ignore')
        tree = ast.parse(source)
    except Exception:
        source = ''
        tree = ast.Module(body=[], type_ignores=[])

    imports: List[str] = []
    classes: List[Dict[str, Any]] = []
    functions: List[str] = []
    routes: List[str] = []
    http_calls: List[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.append(node.module)

    for item in tree.body:
        if isinstance(item, ast.ClassDef):
            methods = [m.name for m in item.body if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))]
            classes.append({'name': item.name, 'methods': methods})
        elif isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append(item.name)
            # Universal route extraction (Flask, FastAPI, Django)
            for decorator in item.decorator_list:
                if isinstance(decorator, ast.Call):
                    func = decorator.func
                    func_name = getattr(func, 'attr', '') or getattr(func, 'id', '')
                    if func_name in ['route', 'get', 'post', 'put', 'delete', 'patch', 'api_route']:
                        route_path = ''
                        method_str = func_name.upper() if func_name in ['get', 'post', 'put', 'delete', 'patch'] else 'GET'
                        if decorator.args and isinstance(decorator.args[0], ast.Constant):
                            route_path = str(decorator.args[0].value)
                        for kw in decorator.keywords:
                            if kw.arg == 'methods' and isinstance(kw.value, (ast.List, ast.Tuple)):
                                methods_list = [elt.value for elt in kw.value.elts if isinstance(elt, ast.Constant)]
                                method_str = '/'.join(methods_list)
                        if route_path:
                            routes.append(f'{method_str} {route_path}')

    # Detect outgoing HTTP client calls (requests.get('/...'), httpx.get, urllib)
    for match in re.finditer(r"""(?:requests|httpx|urllib\.request|client)\.(?:get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]""", source):
        http_calls.append(match.group(1))

    docstring = _extract_docstring_or_comment(source)
    category = _classify_category(rel_path, source, imports, routes)
    summary = _generate_dynamic_file_summary(file_name, category, docstring, routes, classes, functions, imports, [])

    return {
        'id': f'file:{rel_path}',
        'name': file_name,
        'label': file_name,
        'path': rel_path,
        'category': category,
        'classes': classes,
        'functions': functions,
        'routes': routes,
        'http_calls': list(dict.fromkeys(http_calls)),
        'rendered_components': [],
        'imports': list(dict.fromkeys(imports)),
        'summary': summary,
        'lines': len(source.splitlines()) if source else 0,
    }


def _scan_js_like_file(file_path: str, rel_path: str) -> Dict[str, Any]:
    file_name = os.path.basename(file_path)
    try:
        source = Path(file_path).read_text(encoding='utf-8', errors='ignore')
    except Exception:
        source = ''

    imports: List[str] = []
    import_matches = re.findall(r"(?:import\s+(?:.*?from\s+)?|require\s*\(\s*)['\"]([^'\"]+)['\"]", source)
    for dep in import_matches:
        base = dep.split('/')[-1]
        imports.append(base if not base.startswith('.') else dep)

    classes: List[Dict[str, Any]] = []
    for match in re.finditer(r"class\s+([A-Za-z0-9_]+)", source):
        classes.append({'name': match.group(1), 'methods': []})

    functions: List[str] = []
    for match in re.finditer(r"(?:function|const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>|function\s+([A-Za-z0-9_]+)\s*\(", source):
        fn_name = match.group(1) or match.group(2)
        if fn_name and fn_name not in ['default', 'styles', 'style', 'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext']:
            functions.append(fn_name)

    # Universal Express / Next.js / Node route detection
    routes: List[str] = []
    for match in re.finditer(r"(?:app|router)\.(get|post|put|delete|patch|use)\s*\(\s*['\"]([^'\"]+)['\"]", source):
        routes.append(f"{match.group(1).upper()} {match.group(2)}")

    # Detect JSX rendered components (<Header />, <TraceDashboard />)
    rendered_components: List[str] = []
    for match in re.finditer(r"<([A-Z][A-Za-z0-9_]+)[\s/>]", source):
        comp = match.group(1)
        if comp not in ['React', 'Fragment', 'Background', 'Controls', 'MiniMap', 'Handle']:
            rendered_components.append(comp)

    # Detect client-side HTTP calls: fetch('/api/...'), axios.get('/api/...'), etc.
    http_calls: List[str] = []
    for match in re.finditer(r"(?:fetch|axios(?:\.get|\.post|\.put|\.delete)?|apiClient)\s*\(\s*['\"`]?([^'\"`?#\s]+)", source):
        url = match.group(1)
        if '/api/' in url or url.startswith('/'):
            http_calls.append(url)

    docstring = _extract_docstring_or_comment(source)
    category = _classify_category(rel_path, source, imports, routes)
    summary = _generate_dynamic_file_summary(file_name, category, docstring, routes, classes, functions, imports, rendered_components)

    return {
        'id': f'file:{rel_path}',
        'name': file_name,
        'label': file_name,
        'path': rel_path,
        'category': category,
        'classes': classes,
        'functions': list(dict.fromkeys(functions)),
        'routes': routes,
        'http_calls': list(dict.fromkeys(http_calls)),
        'rendered_components': list(dict.fromkeys(rendered_components)),
        'imports': list(dict.fromkeys(imports)),
        'summary': summary,
        'lines': len(source.splitlines()) if source else 0,
    }


def scan_project(root_path: str) -> Dict[str, Any]:
    root = os.path.abspath(root_path)
    if not os.path.exists(root):
        root = os.path.dirname(os.path.abspath(__file__))

    repo_name = os.path.basename(root) or 'Project'
    files: List[Dict[str, Any]] = []

    for current_root, dirs, filenames in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith('.')]
        for file_name in filenames:
            file_path = os.path.join(current_root, file_name)
            ext = Path(file_name).suffix.lower()
            if ext not in SOURCE_EXTENSIONS:
                continue

            rel = _rel_path(root, file_path)
            if rel.startswith('.'):
                continue
            if any(ign in rel for ign in ['node_modules', '.venv', 'dist', 'build', '.git']):
                continue

            if ext == '.py':
                file_info = _scan_python_file(file_path, rel)
                files.append(file_info)
            elif ext in {'.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'}:
                file_info = _scan_js_like_file(file_path, rel)
                files.append(file_info)

    # 1. Dynamically discover all active layers
    layer_definitions = [
        {'key': 'frontend', 'label': 'Frontend Layer', 'description': 'User Interface & Client Components'},
        {'key': 'backend', 'label': 'Backend Services', 'description': 'API Handlers & Server Services'},
        {'key': 'ai', 'label': 'AI & Pipeline Core', 'description': 'LLM, RAG & Orchestration Engine'},
        {'key': 'database', 'label': 'Database & Storage', 'description': 'Database Models & Telemetry Store'},
        {'key': 'core', 'label': 'Core & Utilities', 'description': 'Shared Helpers & System Libraries'},
    ]

    active_categories = {f['category'] for f in files}
    active_layers = [l for l in layer_definitions if l['key'] in active_categories]

    # 2. Dynamically build Cross-Component Connections (0 hardcoded rules)
    cross_edges: List[Dict[str, Any]] = []
    file_map_by_name = {f['name']: f for f in files}
    file_map_by_stem = {Path(f['name']).stem: f for f in files}

    # A. Dynamic HTTP Client -> Server Route Matching
    for caller in files:
        for call_url in caller.get('http_calls', []):
            # match endpoint pattern: e.g. /api/traces or http://.../api/traces
            clean_endpoint = '/' + call_url.split('/api/')[-1].split('?')[0].strip('/') if '/api/' in call_url else call_url.split('?')[0]
            for server_file in files:
                if server_file['id'] == caller['id']:
                    continue
                for route in server_file.get('routes', []):
                    route_path = route.split(' ')[-1].strip()
                    if clean_endpoint in route_path or route_path.endswith(clean_endpoint):
                        edge_id = f"e-http-{caller['id']}->{server_file['id']}:{clean_endpoint}"
                        if not any(e['id'] == edge_id for e in cross_edges):
                            cross_edges.append({
                                'id': edge_id,
                                'source': caller['id'],
                                'target': server_file['id'],
                                'label': f"HTTP {clean_endpoint}",
                                'kind': 'http',
                                'animated': True,
                            })

    # B. Dynamic UI Component Hierarchy Matching
    for parent in files:
        for comp_name in parent.get('rendered_components', []):
            target = file_map_by_stem.get(comp_name) or file_map_by_name.get(f"{comp_name}.jsx") or file_map_by_name.get(f"{comp_name}.tsx")
            if target and target['id'] != parent['id']:
                edge_id = f"e-ui-{parent['id']}->{target['id']}"
                if not any(e['id'] == edge_id for e in cross_edges):
                    cross_edges.append({
                        'id': edge_id,
                        'source': parent['id'],
                        'target': target['id'],
                        'label': f"Renders <{comp_name}/>",
                        'kind': 'ui',
                        'animated': False,
                    })

    # C. Dynamic Import & Dependency Resolution
    for src in files:
        for imp in src.get('imports', []):
            imp_clean = imp.replace('\\', '/').split('/')[-1]
            imp_stem = Path(imp_clean).stem

            # Try matching by full name or stem
            target = file_map_by_stem.get(imp_stem) or file_map_by_name.get(imp_clean)
            if target and target['id'] != src['id']:
                edge_id = f"e-dep-{src['id']}->{target['id']}"
                if not any(e['id'] == edge_id for e in cross_edges):
                    # Determine semantic kind
                    if target['category'] == 'database':
                        kind = 'sql'
                        label = 'DB Query'
                    elif target['category'] == 'ai':
                        kind = 'telemetry'
                        label = 'AI Pipeline'
                    else:
                        kind = 'import'
                        label = 'Imports'

                    cross_edges.append({
                        'id': edge_id,
                        'source': src['id'],
                        'target': target['id'],
                        'label': label,
                        'kind': kind,
                        'animated': kind in ['http', 'telemetry', 'sql'],
                    })

    return {
        'project': repo_name,
        'root_path': root,
        'layers': active_layers,
        'files': files,
        'cross_edges': cross_edges,
        'nodes': files,
        'edges': cross_edges,
    }
