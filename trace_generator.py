import json
import os
import random
import sqlite3
import time
import uuid
from typing import Any, Dict, List, Optional
from architecture_scanner import scan_project


def _init_db_schema(db_path: str) -> None:
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
            status_description TEXT
        )
    ''')
    conn.commit()
    conn.close()


def _generate_spans_for_project(project_root: str, is_simulation: bool = False) -> List[Dict[str, Any]]:
    # Scan the project to discover real files and functions
    arch = scan_project(project_root)
    files = arch.get('files', [])
    project_name = arch.get('project', 'Project')

    # Extract real functions, routes, and classes
    all_functions = []
    all_routes = []
    all_classes = []

    for f in files:
        for fn in f.get('functions', []):
            all_functions.append((fn, f.get('name', ''), f.get('category', 'backend')))
        for rt in f.get('routes', []):
            all_routes.append((rt, f.get('name', '')))
        for cl in f.get('classes', []):
            all_classes.append((cl.get('name', ''), f.get('name', '')))

    # Determine step names dynamically from discovered functions or categories
    ai_funcs = [fn[0] for fn in all_functions if fn[2] == 'ai']
    be_funcs = [fn[0] for fn in all_functions if fn[2] in ['backend', 'core']]
    db_funcs = [fn[0] for fn in all_functions if fn[2] == 'database']
    fe_files = [f['name'] for f in files if f.get('category') == 'frontend']

    step1_name = db_funcs[0] if db_funcs else (all_functions[0][0] if all_functions else 'fetch_input_context')
    step2_name = be_funcs[0] if be_funcs else (all_functions[1][0] if len(all_functions) > 1 else 'process_and_validate')
    step3_name = ai_funcs[0] if ai_funcs else (all_functions[2][0] if len(all_functions) > 2 else 'execute_core_pipeline')
    step4_name = db_funcs[1] if len(db_funcs) > 1 else (all_functions[3][0] if len(all_functions) > 3 else 'persist_telemetry_results')

    generated_spans = []
    now_ns = int(time.time() * 1e9)

    # 1. Successful Trace Execution
    trace_id_1 = f"trace-{uuid.uuid4().hex[:12]}"
    root_span_id_1 = f"span-{uuid.uuid4().hex[:8]}"

    t1_s1_start = now_ns - int(1.5 * 1e9)
    t1_s1_dur = int(random.uniform(0.12, 0.22) * 1e9)
    t1_s1_end = t1_s1_start + t1_s1_dur

    t1_s2_start = t1_s1_end + int(0.01 * 1e9)
    t1_s2_dur = int(random.uniform(0.08, 0.15) * 1e9)
    t1_s2_end = t1_s2_start + t1_s2_dur

    t1_s3_start = t1_s2_end + int(0.02 * 1e9)
    t1_s3_dur = int(random.uniform(0.35, 0.65) * 1e9)
    t1_s3_end = t1_s3_start + t1_s3_dur

    t1_s4_start = t1_s3_end + int(0.01 * 1e9)
    t1_s4_dur = int(random.uniform(0.05, 0.10) * 1e9)
    t1_s4_end = t1_s4_start + t1_s4_dur

    root_1 = {
        'trace_id': trace_id_1,
        'span_id': root_span_id_1,
        'parent_span_id': None,
        'name': f"{project_name.lower().replace(' ', '_')}_main_pipeline",
        'start_time': t1_s1_start,
        'end_time': t1_s4_end,
        'attributes': json.dumps({
            'project': project_name,
            'execution_mode': 'live_pipeline',
            'client_entry': fe_files[0] if fe_files else 'api_gateway',
            'status': 'COMPLETED',
            'total_steps': 4,
        }),
        'status_code': 'OK',
        'status_description': 'Pipeline executed successfully',
    }

    s1_1 = {
        'trace_id': trace_id_1,
        'span_id': f"span-{uuid.uuid4().hex[:8]}",
        'parent_span_id': root_span_id_1,
        'name': f"step_1_{step1_name}",
        'start_time': t1_s1_start,
        'end_time': t1_s1_end,
        'attributes': json.dumps({
            'input_query': f"Analyze component metrics for {project_name}",
            'query_type': 'vector_and_structured',
            'records_matched': random.randint(3, 15),
            'source_module': step1_name,
        }),
        'status_code': 'OK',
        'status_description': None,
    }

    s1_2 = {
        'trace_id': trace_id_1,
        'span_id': f"span-{uuid.uuid4().hex[:8]}",
        'parent_span_id': root_span_id_1,
        'name': f"step_2_{step2_name}",
        'start_time': t1_s2_start,
        'end_time': t1_s2_end,
        'attributes': json.dumps({
            'input': 'Raw telemetry payload extracted',
            'output.context': f"Structured execution parameters for {project_name}",
            'formatting_latency_ms': round(t1_s2_dur / 1e6, 2),
        }),
        'status_code': 'OK',
        'status_description': None,
    }

    s1_3 = {
        'trace_id': trace_id_1,
        'span_id': f"span-{uuid.uuid4().hex[:8]}",
        'parent_span_id': root_span_id_1,
        'name': f"step_3_{step3_name}",
        'start_time': t1_s3_start,
        'end_time': t1_s3_end,
        'attributes': json.dumps({
            'model_target': 'gemini-1.5-pro / local_engine',
            'prompt_tokens': random.randint(180, 450),
            'completion_tokens': random.randint(90, 220),
            'output.final_response': f"Execution completed without errors for {project_name}. All {len(files)} components operational.",
        }),
        'status_code': 'OK',
        'status_description': None,
    }

    s1_4 = {
        'trace_id': trace_id_1,
        'span_id': f"span-{uuid.uuid4().hex[:8]}",
        'parent_span_id': root_span_id_1,
        'name': f"step_4_{step4_name}",
        'start_time': t1_s4_start,
        'end_time': t1_s4_end,
        'attributes': json.dumps({
            'storage_target': 'forensics_traces.db',
            'persisted_spans': 5,
            'table': 'spans',
        }),
        'status_code': 'OK',
        'status_description': None,
    }

    generated_spans.extend([root_1, s1_1, s1_2, s1_3, s1_4])

    # 2. Failing Trace Execution (Simulated Diagnostic Failure)
    if not is_simulation:
        trace_id_2 = f"trace-{uuid.uuid4().hex[:12]}"
        root_span_id_2 = f"span-{uuid.uuid4().hex[:8]}"

        t2_s1_start = now_ns - int(0.6 * 1e9)
        t2_s1_dur = int(random.uniform(0.14, 0.24) * 1e9)
        t2_s1_end = t2_s1_start + t2_s1_dur

        t2_s2_start = t2_s1_end + int(0.01 * 1e9)
        t2_s2_dur = int(random.uniform(0.09, 0.16) * 1e9)
        t2_s2_end = t2_s2_start + t2_s2_dur

        t2_s3_start = t2_s2_end + int(0.02 * 1e9)
        t2_s3_dur = int(random.uniform(0.85, 1.25) * 1e9) # Long timeout
        t2_s3_end = t2_s3_start + t2_s3_dur

        root_2 = {
            'trace_id': trace_id_2,
            'span_id': root_span_id_2,
            'parent_span_id': None,
            'name': f"{project_name.lower().replace(' ', '_')}_main_pipeline",
            'start_time': t2_s1_start,
            'end_time': t2_s3_end,
            'attributes': json.dumps({
                'project': project_name,
                'status': 'FAILED',
                'failed_step': step3_name,
                'error_type': 'ExecutionTimeoutException',
            }),
            'status_code': 'ERROR',
            'status_description': f"Pipeline failed during {step3_name}: Execution timeout exceeded threshold (1000ms)",
        }

        s2_1 = {
            'trace_id': trace_id_2,
            'span_id': f"span-{uuid.uuid4().hex[:8]}",
            'parent_span_id': root_span_id_2,
            'name': f"step_1_{step1_name}",
            'start_time': t2_s1_start,
            'end_time': t2_s1_end,
            'attributes': json.dumps({
                'input_query': f"Stress test query for {project_name}",
                'records_matched': 1,
            }),
            'status_code': 'OK',
            'status_description': None,
        }

        s2_2 = {
            'trace_id': trace_id_2,
            'span_id': f"span-{uuid.uuid4().hex[:8]}",
            'parent_span_id': root_span_id_2,
            'name': f"step_2_{step2_name}",
            'start_time': t2_s2_start,
            'end_time': t2_s2_end,
            'attributes': json.dumps({
                'input': 'Payload received with oversized context',
                'context_length_bytes': 65536,
            }),
            'status_code': 'OK',
            'status_description': None,
        }

        s2_3 = {
            'trace_id': trace_id_2,
            'span_id': f"span-{uuid.uuid4().hex[:8]}",
            'parent_span_id': root_span_id_2,
            'name': f"step_3_{step3_name}",
            'start_time': t2_s3_start,
            'end_time': t2_s3_end,
            'attributes': json.dumps({
                'error.kind': 'TimeoutError',
                'error.message': f"Request to inference worker {step3_name} timed out after {round(t2_s3_dur/1e6)}ms",
                'stack_trace': f"File '{files[0]['path'] if files else 'pipeline.py'}', line 42 in {step3_name}\n  raise TimeoutError('Backend engine unreachable')",
            }),
            'status_code': 'ERROR',
            'status_description': f"TimeoutError: Request to {step3_name} exceeded threshold",
        }

        generated_spans.extend([root_2, s2_1, s2_2, s2_3])

    return generated_spans


def ensure_project_traces(project_root: str) -> str:
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
                INSERT INTO spans (trace_id, span_id, parent_span_id, name, start_time, end_time, attributes, status_code, status_description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                s['trace_id'], s['span_id'], s['parent_span_id'], s['name'],
                s['start_time'], s['end_time'], s['attributes'], s['status_code'], s['status_description']
            ))
        conn.commit()

    conn.close()
    return db_path


def run_pipeline_simulation(project_root: str) -> List[Dict[str, Any]]:
    root = os.path.abspath(project_root)
    db_path = ensure_project_traces(root)

    new_spans = _generate_spans_for_project(root, is_simulation=True)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    for s in new_spans:
        cursor.execute('''
            INSERT INTO spans (trace_id, span_id, parent_span_id, name, start_time, end_time, attributes, status_code, status_description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            s['trace_id'], s['span_id'], s['parent_span_id'], s['name'],
            s['start_time'], s['end_time'], s['attributes'], s['status_code'], s['status_description']
        ))
    conn.commit()
    conn.close()

    return new_spans
