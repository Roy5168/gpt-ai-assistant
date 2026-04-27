from typing import Literal

from pydantic import BaseModel, Field


class Position(BaseModel):
    ticker: str
    asset_type: str
    quantity: float | None = None
    face_value: float | None = None
    cost_basis: float
    currency: str = "USD"


class Constraints(BaseModel):
    risk_tolerance: Literal["conservative", "moderate", "aggressive"] = "moderate"
    max_single_position_weight: float = Field(default=0.2, ge=0, le=1)
    liquidity_need_months: int = Field(default=6, ge=0)
    no_short_selling: bool = True


class UserProfile(BaseModel):
    investment_horizon_years: int = Field(default=5, ge=1)
    income_stability: Literal["low", "medium", "high"] = "high"
    objective: str = "long_term_growth"


class PortfolioInput(BaseModel):
    as_of_date: str
    positions: list[Position]
    constraints: Constraints = Field(default_factory=Constraints)
    user_profile: UserProfile = Field(default_factory=UserProfile)


class AgentResult(BaseModel):
    agent: str
    results: list[dict] = Field(default_factory=list)
    needs_data: list[str] = Field(default_factory=list)


class FullAnalysisResponse(BaseModel):
    technical: AgentResult
    fundamental: AgentResult
    buffett: AgentResult
    lynch: AgentResult
    cathie_wood: AgentResult
    ackman: AgentResult
    risk_manager: dict
    portfolio_manager: dict
