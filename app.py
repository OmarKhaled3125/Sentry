from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import os
import sys

from architecture_scanner import scan_project
from trace_generator import ensure_project_traces, run_pipeline_simulation

app = Flask(__name__)
CORS(app)


@app.route('/api/browse-directory', methods=['POST', 'GET'])
def browse_directory():
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        selected_path = filedialog.askdirectory(title="Select Project Directory")
        root.destroy()

        if selected_path:
            formatted_path = os.path.abspath(selected_path)
            return jsonify({'path': formatted_path, 'success': True})
        return jsonify({'path': '', 'cancelled': True, 'success': False})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/traces', methods=['GET'])
def get_traces():
    requested_path = request.args.get('path') or os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(requested_path)

    if not os.path.exists(project_root):
        return jsonify({'error': f'Project path does not exist: {project_root}', 'spans': []}), 404

    try:
        db_path = ensure_project_traces(project_root)
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT trace_id, span_id, parent_span_id, name,
                   attributes, status_code, status_description, start_time, end_time
            FROM spans ORDER BY start_time ASC
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
    data = request.get_json(silent=True) or {}
    requested_path = data.get('path') or os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(requested_path)

    try:
        new_spans = run_pipeline_simulation(project_root)
        return jsonify({
            'project': os.path.basename(project_root) or 'Project',
            'path': project_root,
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
    app.run(port=5000, debug=True)
