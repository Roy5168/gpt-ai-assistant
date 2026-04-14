# Investment Advisor Multi-Agent MVP (Python Skeleton)

這個範例是一個「可快速替換成真實 LLM 呼叫」的多代理人投資顧問骨架，包含：

- 6 個專家代理人（technical / fundamental / buffett / lynch / cathie_wood / ackman）
- 1 個風險管理代理人（risk_manager）
- 1 個投資組合經理代理人（portfolio_manager）

目前版本已直接串接 OpenAI SDK（也可透過 `OPENAI_BASE_URL` 連 OpenAI 相容 API），回應要求 JSON 格式，方便在多代理人流程中做結構化彙整。

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

# 必填：你的 OpenAI Key
export OPENAI_API_KEY="<YOUR_KEY>"

# 選填：模型與相容端點
export OPENAI_MODEL="gpt-4.1-mini"
# export OPENAI_BASE_URL="https://api.openai.com/v1"
# 例如相容服務可改成你的 base URL

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

## 7) OpenAI（或相容）API 連接方式

目前程式已改為直接使用 OpenAI SDK。

- 必填環境變數：
  - `OPENAI_API_KEY`
- 選填環境變數：
  - `OPENAI_MODEL`（預設 `gpt-4.1-mini`）
  - `OPENAI_BASE_URL`（若使用 OpenAI 相容服務請設定）
  - `OPENAI_TEMPERATURE`（預設 `0.2`）

程式在 `InvestmentOrchestrator()` 初始化時，會讀取上述環境變數建立 client。

若要客製連線，可自行建立 `OpenAIJSONLLM` 後注入：

```python
from openai import OpenAI
from demo.investment_advisor_mvp.orchestrator import InvestmentOrchestrator, OpenAIJSONLLM

llm = OpenAIJSONLLM(
    model="gpt-4.1-mini",
    client=OpenAI(api_key="...", base_url="..."),
    temperature=0.2,
)
orchestrator = InvestmentOrchestrator(llm=llm)
```

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
