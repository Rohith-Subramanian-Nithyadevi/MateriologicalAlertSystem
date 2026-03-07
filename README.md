# Meteorological Alert System

A real-time weather severity classification system with a **Haskell** backend and a **React** frontend.

## Architecture

- **Backend** — Haskell (Scotty) REST API on port 3000. Accepts weather parameters and returns a severity classification (Low / Moderate / High / Extreme).
- **Frontend** — React + Vite. Fetches live weather data from the Open-Meteo API, displays it, and calls the backend for classification.

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

## Classification Logic

Uses a **point-based** system across five parameters:

| Parameter   | Thresholds                         | Max Points |
| ----------- | ---------------------------------- | ---------- |
| Rainfall    | >50mm → 1, >100mm → 2, >200mm → 3 | 3          |
| Wind Speed  | >50km/h → 1, >80 → 2, >120 → 3    | 3          |
| Temperature | >40°C or <0°C → 1, >45 or <-10 → 2 | 2          |
| Pressure    | <990hPa → 1, <970 → 2              | 2          |
| Humidity    | >90% with temp >35°C → 1           | 1          |

| Total Points | Severity |
| ------------ | -------- |
| 0–1          | Low      |
| 2–3          | Moderate |
| 4–5          | High     |
| 6+           | Extreme  |
