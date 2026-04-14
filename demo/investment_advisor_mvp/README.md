# Investment Advisor Multi-Agent MVP (Python Skeleton)

這個範例是一個「可快速替換成真實 LLM 呼叫」的多代理人投資顧問骨架，包含：

- 6 個專家代理人（technical / fundamental / buffett / lynch / cathie_wood / ackman）
- 1 個風險管理代理人（risk_manager）
- 1 個投資組合經理代理人（portfolio_manager）

目前版本使用 `DummyLLM` 回傳 deterministic placeholder 結果，目的是讓你先把 API、資料流與輸出格式串起來，再替換成 OpenAI API。

---

## 1) 專案結構

```text
demo/investment_advisor_mvp/
├─ __init__.py
├─ main.py            # FastAPI 入口：/health, /analyze
├─ orchestrator.py    # 多代理人流程編排（specialists -> risk -> PM）
├─ prompts.py         # 共用與各代理人任務 prompt
├─ schemas.py         # 請求/回應 Pydantic schema
└─ requirements.txt
```

---

## 2) 環境需求

- Python 3.10+
- 建議使用虛擬環境

---

## 3) 安裝與啟動

在 repo 根目錄執行：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r demo/investment_advisor_mvp/requirements.txt
uvicorn demo.investment_advisor_mvp.main:app --reload --port 8090
```

> 為什麼不是 `uvicorn main:app`？
>
> `main.py` 採用相對匯入（例如 `from .orchestrator import ...`），因此要用 module path 啟動最穩定。

---

## 4) API 端點

### GET `/health`

健康檢查：

```bash
curl http://127.0.0.1:8090/health
```

預期回應：

```json
{"status": "ok"}
```

### POST `/analyze`

送入投資組合，取得多代理人分析結果。

```bash
curl -X POST "http://127.0.0.1:8090/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "as_of_date": "2026-04-14",
    "positions": [
      {
        "ticker": "AAPL",
        "asset_type": "equity",
        "quantity": 100,
        "cost_basis": 165.2,
        "currency": "USD"
      },
      {
        "ticker": "TLT",
        "asset_type": "bond_etf",
        "face_value": 50000,
        "cost_basis": 92.5,
        "currency": "USD"
      }
    ],
    "constraints": {
      "risk_tolerance": "moderate",
      "max_single_position_weight": 0.2,
      "liquidity_need_months": 6,
      "no_short_selling": true
    },
    "user_profile": {
      "investment_horizon_years": 5,
      "income_stability": "high",
      "objective": "long_term_growth"
    }
  }'
```

---

## 5) Request schema 重點

- `as_of_date`: 分析日期（字串）
- `positions`: 持倉陣列
  - 股票：使用 `quantity`
  - 債券/債券 ETF：可用 `face_value`
- `constraints.risk_tolerance`: `conservative | moderate | aggressive`
- `user_profile`: 投資年期、收入穩定度、目標

完整型別請看 `schemas.py`。

---

## 6) Response 結構

`/analyze` 回傳會包含：

- `technical`
- `fundamental`
- `buffett`
- `lynch`
- `cathie_wood`
- `ackman`
- `risk_manager`
- `portfolio_manager`

前 6 個是 specialist 輸出，後 2 個是彙整後決策層輸出。

---

## 7) 如何接上真實 LLM

1. 打開 `orchestrator.py` 的 `DummyLLM.run(...)`。
2. 改成呼叫 OpenAI（或相容）API。
3. 讓每個 agent 輸出符合 `schemas.py` / prompt 規格。
4. 保留 `InvestmentOrchestrator.analyze(...)` 的流程不變，先求可維護性。

---

## 8) 常見問題

### Q1: ImportError / relative import 問題
- 請確認你在 repo 根目錄，並用：
  - `uvicorn demo.investment_advisor_mvp.main:app --reload --port 8090`

### Q2: 安裝套件失敗
- 若在受限網路/代理環境，`pip install` 可能失敗。
- 請改用可連外網路、內部 PyPI mirror，或先把依賴包下載到本地 wheelhouse。

### Q3: 這是可直接下單的投資系統嗎？
- 不是。這是研究輔助 MVP，請自行加入資料驗證、權限控管、風險限制與合規流程。
