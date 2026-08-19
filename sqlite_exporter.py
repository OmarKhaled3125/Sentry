import sqlite3
import json
from typing import Sequence
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

class SQLiteSpanExporter(SpanExporter):
    def __init__(self, db_path: str = "forensics_traces.db"):
        self.db_path = db_path

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        for span in spans:
            trace_id = format(span.context.trace_id, '032x')
            span_id = format(span.context.span_id, '016x')
            parent_span_id = format(span.parent.span_id, '016x') if span.parent else None

            # Convert ReadableSpan attributes (mappingproxy) to a regular dict
            attributes_dict = dict(span.attributes) if span.attributes else {}
            attributes = json.dumps(attributes_dict, default=str)
            status_code = span.status.status_code.name
            status_desc = span.status.description or ""

            cursor.execute('''
                INSERT INTO spans (
                    trace_id, span_id, parent_span_id, name, 
                    start_time, end_time, attributes, status_code, status_description
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                trace_id, span_id, parent_span_id, span.name,
                span.start_time, span.end_time, attributes, status_code, status_desc
            ))

        conn.commit()
        conn.close()
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass