from fastapi import FastAPI

from .orchestrator import InvestmentOrchestrator
from .schemas import FullAnalysisResponse, PortfolioInput

app = FastAPI(title="Investment Advisor Multi-Agent MVP")
orchestrator = InvestmentOrchestrator()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze", response_model=FullAnalysisResponse)
def analyze_portfolio(payload: PortfolioInput) -> dict:
    return orchestrator.analyze(payload)
