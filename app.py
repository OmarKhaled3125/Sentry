from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import os
import sys
from multiprocessing import Process, Queue

from architecture_scanner import scan_project
from trace_generator import ensure_project_traces, run_pipeline_simulation, _discover_entry_point_processes

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)


def _spawn_folder_dialog(result_queue: Queue) -> None:
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        folder = filedialog.askdirectory(title="Select Project Directory")
        root.destroy()
        result_queue.put(folder if folder else '')
    except Exception:
        result_queue.put('')


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'online', 'message': 'Flask server is reachable'}), 200


@app.route('/api/browse-directory', methods=['POST', 'GET'])
def browse_directory():
    try:
        result_queue = Queue()
        dialog_process = Process(target=_spawn_folder_dialog, args=(result_queue,))
        dialog_process.start()
        dialog_process.join(timeout=60)

        selected_path = result_queue.get_nowait() if not result_queue.empty() else ''

        if dialog_process.is_alive():
            dialog_process.terminate()

        if selected_path:
            formatted_path = os.path.abspath(selected_path)
            return jsonify({'path': formatted_path, 'success': True})
        return jsonify({'path': '', 'cancelled': True, 'success': False})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/processes', methods=['GET'])
def get_processes():
    """Returns metadata for all discovered processes within the target project workspace."""
    requested_path = request.args.get('path') or os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(requested_path)

    if not os.path.exists(project_root):
        return jsonify({'error': f'Project path does not exist: {project_root}', 'processes': []}), 404

    try:
        ensure_project_traces(project_root)
        discovered = _discover_entry_point_processes(project_root)
        processes = []
        for p in discovered:
            processes.append({
                'process_id': p['process_id'],
                'process_name': p['process_name'],
                'category': p['category'],
                'total_steps': len(p['steps']),
                'source_file': p['source_file']
            })
        return jsonify({'processes': processes, 'path': project_root})
    except Exception as e:
        return jsonify({'error': str(e), 'processes': []}), 500


@app.route('/api/traces', methods=['GET'])
def get_traces():
    """Queries and returns telemetry spans filtered to show the most recent run per process."""
    requested_path = request.args.get('path') or os.path.dirname(os.path.abspath(__file__))
    process_id_filter = request.args.get('process_id')
    project_root = os.path.abspath(requested_path)

    if not os.path.exists(project_root):
        return jsonify({'error': f'Project path does not exist: {project_root}', 'spans': []}), 404

    try:
        db_path = ensure_project_traces(project_root)
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Query spans associated with the latest run ID per process to eliminate duplicate historical runs
        if process_id_filter:
            cursor.execute('''
                SELECT trace_id, span_id, parent_span_id, name,
                       attributes, status_code, status_description, start_time, end_time, process_id, run_id
                FROM spans 
                WHERE process_id = ? AND run_id = (
                    SELECT run_id FROM spans WHERE process_id = ? ORDER BY scan_timestamp DESC LIMIT 1
                )
                ORDER BY start_time ASC
            ''', (process_id_filter, process_id_filter))
        else:
            cursor.execute('''
                SELECT s.trace_id, s.span_id, s.parent_span_id, s.name,
                       s.attributes, s.status_code, s.status_description, s.start_time, s.end_time, s.process_id, s.run_id
                FROM spans s
                INNER JOIN (
                    SELECT process_id, MAX(scan_timestamp) as max_ts
                    FROM spans GROUP BY process_id
                ) latest ON s.process_id = latest.process_id
                ORDER BY s.start_time ASC
            ''')

        columns = [col[0] for col in cursor.description]
        spans = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()

        for span in spans:
            if span.get('attributes'):
                try:
                    span['attributes'] = json.loads(span['attributes'])
                except Exception:
                    pass

        return jsonify({
            'project': os.path.basename(project_root) or 'Project',
            'path': project_root,
            'db_path': db_path,
            'spans': spans
        })
    except Exception as e:
        return jsonify({'error': str(e), 'spans': []}), 500


@app.route('/api/traces/run', methods=['POST'])
def run_simulation():
    """Triggers targeted process or full workspace pipeline simulation runs."""
    data = request.get_json(silent=True) or {}
    requested_path = data.get('path') or os.path.dirname(os.path.abspath(__file__))
    process_id = data.get('process_id')
    project_root = os.path.abspath(requested_path)

    try:
        new_spans = run_pipeline_simulation(project_root, process_id=process_id)
        return jsonify({
            'project': os.path.basename(project_root) or 'Project',
            'path': project_root,
            'process_id': process_id,
            'spans': new_spans,
            'success': True
        })
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/architecture', methods=['GET'])
def get_architecture():
    requested_path = request.args.get('path') or os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(requested_path)
    if not os.path.exists(project_root):
        return jsonify({'error': f'Path does not exist: {project_root}', 'files': [], 'layers': [], 'cross_edges': []}), 404
    try:
        graph = scan_project(project_root)
        return jsonify(graph)
    except Exception as e:
        return jsonify({'error': str(e), 'files': [], 'layers': [], 'cross_edges': []}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)