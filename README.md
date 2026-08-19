# Trace Failure Forensics & Pipeline Architectures

## 📖 Overview

_Trace Failure Forensics & Pipeline Architectures_ is a visual analytics tool that helps developers and AI‑pipeline engineers **inspect, debug and understand execution traces** of their projects. It couples a **System Architecture view** with an **Execution Forensics view** so you can see both the static code graph and the dynamic runtime spans side‑by‑side.

The frontend is a modern React application powered by **Vite**, while the backend utilities are lightweight Python scripts that scan a project directory, generate synthetic trace data and expose it via a simple API.

---

## ✨ Key Features

- **Dynamic project selection** – The _Scan_ button opens the native OS file‑explorer allowing users to pick a project folder without manually typing a path.
- **Unified UI** – A single header reads **“TRACE FAILURE FORENSICS & PIPELINE ARCHITECTURES”** and a small subtitle shows the currently scanned project.
- **System Architecture panel** – Interactive graph (React Flow) visualising files, functions, imports and their relationships.
- **Execution Forensics panel** – Timeline‑style view of generated spans (sample traces) linked to the architecture nodes.
- **Responsive dark / light mode** – All components respect the chosen theme.
- **Minimalist design** – A clean and professional look.
- **Sample trace generation** – A Python utility creates an SQLite `trace.db` inside the selected project and populates it with synthetic trace data that the UI consumes.

---

## 🛠️ Tech Stack

| Layer       | Technology                              |
| ----------- | --------------------------------------- |
| Frontend    | React, Vite, vanilla CSS, React Flow    |
| Backend     | Python 3.11, FastAPI (optional), SQLite |
| Build & Dev | npm, PowerShell (Windows)               |

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or later) with npm
- **Python** (3.10+) with `pip`
- Windows OS (paths are Windows‑style in this repo)

### 1. Clone the repository (if you haven’t already)

```powershell
git clone <repo‑url> "d:\Featured Projects\Failure Forensics for AI Pipelines"
cd "d:\Featured Projects\Failure Forensics for AI Pipelines"
```

### 2. Install Frontend dependencies

```powershell
cd frontend
npm ci
```

### 3. Run the development server

```powershell
npm run dev
```

The UI will automatically open in your default browser.

### 4. Backend – Trace generation utility

The Python script `architecture_scanner.py` (and its helper `trace_generator.py` if present) scans the selected project folder and creates a local SQLite database `trace.db` containing synthetic spans.

```powershell
cd ..
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python architecture_scanner.py
```

The script will prompt you to select a folder via the OS picker (or you can pass a path). After scanning, it writes `trace.db` into the chosen folder. The frontend reads this database automatically.

---

## 🖥️ UI Workflow

1. **Launch the dev server** (`npm run dev`).
2. Click **Scan** → the OS file‑explorer appears → select the root of the project you want to inspect.
3. The app stores the chosen path, triggers `architecture_scanner.py` (via the backend API) which:
   - Walks the directory,
   - Generates a graph of files/functions,
   - Creates a `trace.db` with sample spans.
4. The _System Architecture_ pane renders the graph; the _Execution Forensics_ pane shows the timeline of spans.
5. Use the view‑mode toggle buttons (**SYSTEM ARCHITECTURE**, **EXECUTION FORENSICS**) to switch between the two panels.

---

## 📄 License

This project is licensed under the **MIT License** – see the `LICENSE` file for details.

---

## 📚 Further Reading

- **React Flow Documentation** – https://reactflow.dev/
- **Vite – Next Generation Frontend Tooling** – https://vitejs.dev/
- **SQLite & SQLAlchemy** – https://www.sqlalchemy.org/

Feel free to explore the code, extend the trace generation logic, or adapt the UI for your own pipeline forensics needs!
