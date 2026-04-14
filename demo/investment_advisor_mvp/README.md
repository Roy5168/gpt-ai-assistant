# Investment Advisor Multi-Agent MVP (Python Skeleton)

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn pydantic
uvicorn main:app --reload --port 8090
```

## API

- `POST /analyze`
  - Input: portfolio JSON
  - Output: all agent outputs + synthesized final recommendation

> This skeleton uses deterministic placeholder logic (`DummyLLM`) so you can replace each `run_*_agent` with OpenAI API calls.
