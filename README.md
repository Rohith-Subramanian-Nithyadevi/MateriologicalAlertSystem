# Meteorological Alert System

A real-time weather severity classification system with a **Haskell** backend and a **React** frontend.

> **Important:** This system uses a **rule-based / deterministic** approach inspired by ML concepts. There is **no actual machine learning** — no training, no datasets, no model fitting, and no ML libraries. All decision logic is manually tuned using meteorological thresholds from IMD/WMO standards.

## Architecture

- **Backend** — Haskell (Scotty) REST API on port 3000. Accepts weather parameters and returns a severity classification (Low / Moderate / High / Extreme) using IMD threshold rules and consistency validation.
- **Frontend** — React + Vite. Fetches live weather data from the Open-Meteo API, runs a **Hybrid Rule Engine** (5 deterministic scoring techniques), and calls the backend for cross-validation.

## Hybrid Rule Engine

The frontend implements 5 rule-based techniques (no ML training involved):

| Technique | Description |
|---|---|
| **Sigmoid Scoring** | 9 per-disaster rule sets using sigmoid functions with manually-tuned weights |
| **Decision Tree Voting** | 7 hardcoded decision trees that vote on the most likely event type |
| **Weighted Scoring** | Per-event base scores with boost/penalty corrections based on thresholds |
| **Time-Series Rules** | Trend detection using pressure drop, wind acceleration, and rainfall intensification thresholds |
| **Historical Baseline** | Anomaly detection via z-score comparison against 15-year seasonal normals |

The backend then validates these results against IMD physical range checks using a **rule-engine-aware consistency gate**.

## Quick Start

### Backend

```bash
cd backend
cabal build
cabal run backend
```

The API runs at `http://localhost:3000`. Test it:

```
GET /classify?temp=35&rain=150&wind=90&humidity=80&pressure=990
→ {"severity":"High"}
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /classify` | Basic IMD threshold classification |
| `GET /classifyWithHistory` | IMD + 30-day historical context |
| `GET /classifyWithRuleEngine` | IMD + rule engine cross-validation (recommended) |
| `GET /health` | Health check |
