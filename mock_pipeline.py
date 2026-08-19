from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from sqlite_exporter import SQLiteSpanExporter
import time

provider = TracerProvider()
exporter = SQLiteSpanExporter(db_path="forensics_traces.db")
processor = SimpleSpanProcessor(exporter)
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer(__name__)

def retrieve_context(query: str) -> str:
    with tracer.start_as_current_span("step_1_retrieve_context") as span:
        span.set_attribute("input_query", query)
        time.sleep(0.2)

        context = "Mocked vector database results regarding AI observability."

        span.set_attribute("output.context", context)
        span.set_status(trace.StatusCode.OK)
        return context

def format_prompt(query: str, context: str) -> str:
    with tracer.start_as_current_span("step_2_format_prompt") as span:
        span.set_attribute("input_query", query)
        span.set_attribute("input_context", context)

        prompt = f"Context: {context}\nUser Query: {query}\nProvide a detailed answer."

        span.set_attribute("output.prompt", prompt)
        span.set_status(trace.StatusCode.OK)
        return prompt

def generate_response(prompt: str) -> str:
    with tracer.start_as_current_span("step_3_generate_response") as span:
        span.set_attribute("input.prompt", prompt)
        time.sleep(0.5) 
        
        try:
            if "fail" in prompt.lower():
                raise ValueError("LLM API Timeout: Context window limits exceeded.")
            
            response = "Observability allows you to trace AI pipelines effectively."
            span.set_attribute("output.response", response)
            span.set_status(trace.StatusCode.OK)
            return response
            
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.StatusCode.ERROR, str(e))
            raise    

def run_pipeline(query: str) -> str:
    with tracer.start_as_current_span("orchestrator_main_pipeline") as parent_span:
        parent_span.set_attribute("input.query", query)
        
        try:
            context = retrieve_context(query)
            prompt = format_prompt(query, context)
            response = generate_response(prompt)
            
            parent_span.set_attribute("output.final_response", response)
            parent_span.set_status(trace.StatusCode.OK)
            return response
            
        except Exception as e:
            parent_span.record_exception(e)
            parent_span.set_status(trace.StatusCode.ERROR, "Pipeline failed midway")
            return "Error: Pipeline execution aborted. Check traces."

if __name__ == "__main__":
    print("Running successful pipeline execution...")
    run_pipeline("How to build an AI trace tool?")
    
    print("\nRunning failing pipeline execution...")
    run_pipeline("Make this pipeline fail intentionally.")
    
    print("\nExecution complete. Traces exported to SQLite.")        