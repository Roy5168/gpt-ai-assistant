from __future__ import annotations

from dataclasses import dataclass

from .schemas import AgentResult, PortfolioInput


@dataclass
class DummyLLM:
    """Replace this with a real OpenAI client call in production."""

    def run(self, agent: str, portfolio: PortfolioInput) -> AgentResult:
        rows = []
        for p in portfolio.positions:
            rows.append(
                {
                    "ticker": p.ticker,
                    "signal": "hold",
                    "reason": f"{agent} placeholder analysis for {p.ticker}",
                    "confidence": 0.55,
                }
            )
        return AgentResult(agent=agent, results=rows, needs_data=[])


class InvestmentOrchestrator:
    def __init__(self) -> None:
        self.llm = DummyLLM()

    def run_specialists(self, portfolio: PortfolioInput) -> dict[str, AgentResult]:
        specialist_agents = [
            "technical",
            "fundamental",
            "buffett",
            "lynch",
            "cathie_wood",
            "ackman",
        ]
        return {agent: self.llm.run(agent, portfolio) for agent in specialist_agents}

    def run_risk_manager(self, specialist_outputs: dict[str, AgentResult]) -> dict:
        return {
            "agent": "risk_manager",
            "risk_dashboard": {
                "concentration_risk": "medium",
                "style_bias_risk": "medium",
                "market_beta_risk": "medium",
                "rate_credit_risk": "low",
                "liquidity_risk": "low",
                "fx_risk": "low",
            },
            "top_risks": [
                {
                    "name": "single_sector_exposure",
                    "impact": "medium",
                    "reason": "placeholder summary from aggregated specialist outputs",
                }
            ],
            "risk_limits_breach": [],
            "confidence": 0.58,
        }

    def run_portfolio_manager(
        self,
        portfolio: PortfolioInput,
        specialist_outputs: dict[str, AgentResult],
        risk_output: dict,
    ) -> dict:
        actions = []
        for p in portfolio.positions:
            actions.append(
                {
                    "ticker": p.ticker,
                    "action": "hold",
                    "target_weight": round(1 / max(1, len(portfolio.positions)), 3),
                    "time_horizon": "30d",
                    "rationale": "placeholder action based on specialist consensus and risk constraints",
                }
            )

        return {
            "agent": "portfolio_manager",
            "portfolio_health_summary": {
                "overall_view": "portfolio is acceptable but requires monitoring",
                "confidence": 0.6,
            },
            "top_actions": actions,
            "scenario_analysis": {
                "base_case": "moderate return with manageable volatility",
                "stress_case": "drawdown under broad market selloff",
                "bull_case": "upside from earnings resilience and policy tailwinds",
            },
            "monitoring_plan": [
                {
                    "metric": "max_drawdown_30d",
                    "trigger": ">8%",
                    "check_frequency": "weekly",
                }
            ],
            "compliance_notes": [
                "research_assistance_only",
                "not_investment_advice",
            ],
        }

    def analyze(self, portfolio: PortfolioInput) -> dict:
        specialists = self.run_specialists(portfolio)
        risk_output = self.run_risk_manager(specialists)
        pm_output = self.run_portfolio_manager(portfolio, specialists, risk_output)
        return {
            **specialists,
            "risk_manager": risk_output,
            "portfolio_manager": pm_output,
        }
