from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from openai import OpenAI

from .prompts import AGENT_TASK_PROMPTS, COMMON_SYSTEM_PROMPT
from .schemas import AgentResult, PortfolioInput


@dataclass
class OpenAIJSONLLM:
    """OpenAI / OpenAI-compatible JSON caller."""

    model: str
    client: OpenAI
    temperature: float = 0.2

    @classmethod
    def from_env(cls) -> "OpenAIJSONLLM":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required.")

        base_url = os.getenv("OPENAI_BASE_URL")
        model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.2"))

        client = OpenAI(api_key=api_key, base_url=base_url)
        return cls(model=model, client=client, temperature=temperature)

    def run_json(self, *, agent: str, input_payload: dict[str, Any]) -> dict[str, Any]:
        task = AGENT_TASK_PROMPTS[agent]
        user_prompt = {
            "agent": agent,
            "task": task,
            "input": input_payload,
            "output_format": "json_only",
        }

        response = self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": COMMON_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)},
            ],
        )

        content = response.choices[0].message.content or "{}"
        return json.loads(content)


class InvestmentOrchestrator:
    def __init__(self, llm: OpenAIJSONLLM | None = None) -> None:
        self.llm = llm or OpenAIJSONLLM.from_env()

    def _normalize_specialist_result(self, agent: str, raw: dict[str, Any]) -> AgentResult:
        return AgentResult(
            agent=raw.get("agent", agent),
            results=raw.get("results", []),
            needs_data=raw.get("needs_data", []),
        )

    def run_specialists(self, portfolio: PortfolioInput) -> dict[str, AgentResult]:
        specialist_agents = [
            "technical",
            "fundamental",
            "buffett",
            "lynch",
            "cathie_wood",
            "ackman",
        ]
        payload = portfolio.model_dump(mode="json")
        outputs: dict[str, AgentResult] = {}
        for agent in specialist_agents:
            raw = self.llm.run_json(agent=agent, input_payload=payload)
            outputs[agent] = self._normalize_specialist_result(agent, raw)
        return outputs

    def run_risk_manager(self, specialist_outputs: dict[str, AgentResult]) -> dict[str, Any]:
        payload = {
            "specialist_outputs": {k: v.model_dump(mode="json") for k, v in specialist_outputs.items()}
        }
        return self.llm.run_json(agent="risk_manager", input_payload=payload)

    def run_portfolio_manager(
        self,
        portfolio: PortfolioInput,
        specialist_outputs: dict[str, AgentResult],
        risk_output: dict[str, Any],
    ) -> dict[str, Any]:
        payload = {
            "portfolio": portfolio.model_dump(mode="json"),
            "specialist_outputs": {k: v.model_dump(mode="json") for k, v in specialist_outputs.items()},
            "risk_output": risk_output,
        }
        return self.llm.run_json(agent="portfolio_manager", input_payload=payload)

    def analyze(self, portfolio: PortfolioInput) -> dict[str, Any]:
        specialists = self.run_specialists(portfolio)
        risk_output = self.run_risk_manager(specialists)
        pm_output = self.run_portfolio_manager(portfolio, specialists, risk_output)
        return {
            **specialists,
            "risk_manager": risk_output,
            "portfolio_manager": pm_output,
        }
