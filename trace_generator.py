import ast
import json
import os
import random
import re
import sqlite3
import time
import uuid
from typing import Any, Dict, List, Optional
from architecture_scanner import scan_project


def _init_db_schema(db_path: str) -> None:
    """Initializes SQLite schema with multi-process telemetry columns."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS spans (
            trace_id TEXT,
            span_id TEXT PRIMARY KEY,
            parent_span_id TEXT,
            name TEXT,
            start_time INTEGER,
            end_time INTEGER,
            attributes TEXT,
            status_code TEXT,
            status_description TEXT,
            process_id TEXT,
            run_id TEXT,
            scan_timestamp INTEGER
        )
    ''')
    
    # Graceful migration for existing database schemas missing modern fields
    cursor.execute("PRAGMA table_info(spans)")
    columns = [col[1] for col in cursor.fetchall()]
    for new_col in ['process_id', 'run_id', 'scan_timestamp']:
        if new_col not in columns:
            cursor.execute(f"ALTER TABLE spans ADD COLUMN {new_col} TEXT" if new_col != 'scan_timestamp' else f"ALTER TABLE spans ADD COLUMN {new_col} INTEGER")
            
    conn.commit()
    conn.close()


def _extract_python_call_chain(file_path: str, entry_func_name: str) -> List[str]:
    """Uses Python AST to inspect entry-point function body and derive child function calls."""
    if not os.path.exists(file_path):
        return []
        
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read(), filename=file_path)
            
        called_functions = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == entry_func_name:
                for sub_node in ast.walk(node):
                    if isinstance(sub_node, ast.Call):
                        if isinstance(sub_node.func, ast.Name):
                            called_functions.append(sub_node.func.id)
                        elif isinstance(sub_node.func, ast.Attribute):
                            called_functions.append(sub_node.func.attr)
        return list(dict.fromkeys(called_functions))  # Deduplicate preserving order
    except Exception:
        return []


def _discover_entry_point_processes(project_root: str) -> List[Dict[str, Any]]:
    """Scans project modules and converts each entry point (route, component, orchestrator) into a process."""
    arch = scan_project(project_root)
    files = arch.get('files', [])
    discovered_processes = []

    for f in files:
        cat = f.get('category', 'core')
        file_name = f.get('name', '')
        file_path = os.path.join(project_root, f.get('path', file_name))
        routes = f.get('routes', [])
        funcs = f.get('functions', [])

        # 1. Backend Layer: Every route endpoint is an isolated execution pipeline
        if cat == 'backend' and routes:
            for r in routes:
                clean_route = r.replace(' ', '_').replace('/', '_').replace(':', '')
                proc_id = f"proc_backend_{clean_route}".strip('_')
                
                # Derive call chain via AST call analysis
                matched_func = clean_route.split('_')[-1]
                calls = _extract_python_call_chain(file_path, matched_func)
                
                steps = [{'name': f"route_handler_{matched_func}", 'source_file': file_name}]
                for call in calls:
                    steps.append({'name': f"call_{call}", 'source_file': file_name})
                    
                discovered_processes.append({
                    'process_id': proc_id,
                    'process_name': f"Endpoint: {r}",
                    'category': cat,
                    'source_file': file_name,
                    'steps': steps
                })

        # 2. Frontend Layer: Top-level components form component render pipelines
        elif cat == 'frontend':
            proc_id = f"proc_frontend_{file_name.replace('.', '_')}"
            steps = [
                {'name': 'component_mount', 'source_file': file_name},
                {'name': 'fetch_state_dependencies', 'source_file': file_name},
                {'name': 'virtual_dom_render', 'source_file': file_name}
            ]
            for fn in funcs[:3]:
                steps.append({'name': f"event_handler_{fn}", 'source_file': file_name})
            discovered_processes.append({
                'process_id': proc_id,
                'process_name': f"Render: {file_name}",
                'category': cat,
                'source_file': file_name,
                'steps': steps
            })

        # 3. AI / ML Layer: Top-level pipeline functions orchestrating sub-tasks
        elif cat == 'ai':
            for fn in funcs:
                if any(kw in fn.lower() for kw in ['run', 'orchestrate', 'generate', 'predict', 'scan']):
                    proc_id = f"proc_ai_{fn}"
                    calls = _extract_python_call_chain(file_path, fn)
                    steps = [{'name': f"orchestrate_{fn}", 'source_file': file_name}]
                    for call in calls:
                        steps.append({'name': f"eval_{call}", 'source_file': file_name})
                    if len(steps) == 1:
                        steps.extend([
                            {'name': 'tokenize_input', 'source_file': file_name},
                            {'name': 'execute_inference', 'source_file': file_name},
                            {'name': 'format_output_payload', 'source_file': file_name}
                        ])
                    discovered_processes.append({
                        'process_id': proc_id,
                        'process_name': f"Pipeline: {fn}()",
                        'category': cat,
                        'source_file': file_name,
                        'steps': steps
                    })

        # 4. Fallback: Group per function or per file for Database and Core layers
        else:
            if funcs:
                proc_id = f"proc_{cat}_{file_name.replace('.', '_')}"
                steps = [{'name': f"exec_{fn}", 'source_file': file_name} for fn in funcs]
                discovered_processes.append({
                    'process_id': proc_id,
                    'process_name': f"Service: {file_name}",
                    'category': cat,
                    'source_file': file_name,
                    'steps': steps
                })

    # Ultimate fallback if directory structure yields no entries
    if not discovered_processes:
        discovered_processes.append({
            'process_id': 'proc_default_system_init',
            'process_name': 'System Workspace Boot',
            'category': 'core',
            'source_file': 'app.py',
            'steps': [
                {'name': 'initialize_workspace', 'source_file': 'app.py'},
                {'name': 'scan_architecture_nodes', 'source_file': 'architecture_scanner.py'},
                {'name': 'execute_telemetry_pipeline', 'source_file': 'trace_generator.py'}
            ]
        })

    return discovered_processes


def _generate_spans_for_project(project_root: str, target_process_id: Optional[str] = None, is_simulation: bool = False) -> List[Dict[str, Any]]:
    """Generates execution spans per discovered process and assigns unique run execution IDs."""
    arch = scan_project(project_root)
    project_name = arch.get('project', 'Project')
    discovered = _discover_entry_point_processes(project_root)

    if target_process_id:
        discovered = [p for p in discovered if p['process_id'] == target_process_id]

    generated_spans: List[Dict[str, Any]] = []
    run_id = f"run-{uuid.uuid4().hex[:10]}"
    now_ns = int(time.time() * 1e9)
    scan_ts = int(time.time())

    for proc in discovered:
        trace_id = f"trace-{uuid.uuid4().hex[:12]}"
        root_span_id = f"span-{uuid.uuid4().hex[:8]}"
        steps = proc['steps']
        total_steps = len(steps)

        # Failure Simulation: 1 in 4 chance of failing > 50% into the execution chain
        has_failure = random.choice([True, False, False, False])
        failed_step_idx = random.randint(total_steps // 2, total_steps - 1) if (has_failure and total_steps > 1) else -1

        current_step_start = now_ns
        child_spans = []

        for idx, step in enumerate(steps):
            step_dur = int(random.uniform(0.04, 0.18) * 1e9)
            step_end = current_step_start + step_dur
            step_span_id = f"span-{uuid.uuid4().hex[:8]}"
            is_failed = (idx == failed_step_idx)

            step_span = {
                'trace_id': trace_id,
                'span_id': step_span_id,
                'parent_span_id': root_span_id,
                'name': f"step_{idx + 1}_{step['name']}",
                'start_time': current_step_start,
                'end_time': step_end,
                'attributes': json.dumps({
                    'process_id': proc['process_id'],
                    'process_name': proc['process_name'],
                    'step_number': idx + 1,
                    'total_steps': total_steps,
                    'source_file': step['source_file'],
                    'input': f"Params passed to {step['name']}",
                    'output': f"Result payload from {step['name']}" if not is_failed else None,
                    'latency_ms': round(step_dur / 1e6, 2)
                }),
                'status_code': 'ERROR' if is_failed else 'OK',
                'status_description': f"Execution Exception in {step['name']}: Critical Step Failure" if is_failed else None,
                'process_id': proc['process_id'],
                'run_id': run_id,
                'scan_timestamp': scan_ts
            }
            child_spans.append(step_span)
            if is_failed:
                break
            current_step_start = step_end + int(0.005 * 1e9)

        proc_end_time = child_spans[-1]['end_time'] if child_spans else current_step_start
        proc_failed = any(s['status_code'] == 'ERROR' for s in child_spans)

        root_span = {
            'trace_id': trace_id,
            'span_id': root_span_id,
            'parent_span_id': None,
            'name': proc['process_name'],
            'start_time': child_spans[0]['start_time'] if child_spans else current_step_start,
            'end_time': proc_end_time,
            'attributes': json.dumps({
                'project': project_name,
                'process_id': proc['process_id'],
                'process_name': proc['process_name'],
                'category': proc['category'],
                'total_steps': len(child_spans),
                'status': 'FAILED' if proc_failed else 'COMPLETED'
            }),
            'status_code': 'ERROR' if proc_failed else 'OK',
            'status_description': f"Pipeline interrupted at step {failed_step_idx + 1}" if proc_failed else "Pipeline completed",
            'process_id': proc['process_id'],
            'run_id': run_id,
            'scan_timestamp': scan_ts
        }

        generated_spans.append(root_span)
        generated_spans.extend(child_spans)

    return generated_spans


def ensure_project_traces(project_root: str) -> str:
    """Ensures database exists and contains initial multi-process trace records."""
    root = os.path.abspath(project_root)
    os.makedirs(root, exist_ok=True)
    db_path = os.path.join(root, 'forensics_traces.db')

    _init_db_schema(db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM spans")
    count = cursor.fetchone()[0]

    if count == 0:
        spans = _generate_spans_for_project(root)
        for s in spans:
            cursor.execute('''
                INSERT INTO spans (trace_id, span_id, parent_span_id, name, start_time, end_time, attributes, status_code, status_description, process_id, run_id, scan_timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                s['trace_id'], s['span_id'], s['parent_span_id'], s['name'],
                s['start_time'], s['end_time'], s['attributes'], s['status_code'],
                s['status_description'], s['process_id'], s['run_id'], s['scan_timestamp']
            ))
        conn.commit()

    conn.close()
    return db_path


def run_pipeline_simulation(project_root: str, process_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Executes target or full process simulation and appends new trace runs."""
    root = os.path.abspath(project_root)
    db_path = ensure_project_traces(root)

    new_spans = _generate_spans_for_project(root, target_process_id=process_id, is_simulation=True)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    for s in new_spans:
        cursor.execute('''
            INSERT INTO spans (trace_id, span_id, parent_span_id, name, start_time, end_time, attributes, status_code, status_description, process_id, run_id, scan_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            s['trace_id'], s['span_id'], s['parent_span_id'], s['name'],
            s['start_time'], s['end_time'], s['attributes'], s['status_code'],
            s['status_description'], s['process_id'], s['run_id'], s['scan_timestamp']
        ))
    conn.commit()
    conn.close()

    return new_spans