module Classifier where

import Types

-- | Classify weather conditions into a severity level.
--
-- Uses a point-based system that considers all five parameters:
--   * Rainfall & wind speed (primary indicators)
--   * Temperature extremes, low pressure, high humidity (secondary)
--
-- Points:  0–1 = Low,  2–3 = Moderate,  4–5 = High,  6+ = Extreme
classify :: Weather -> Severity
classify w = pointsToSeverity totalPoints
  where
    totalPoints = rainPoints + windPoints + tempPoints + pressPoints + humPoints

    -- Primary: Rainfall (mm)
    rainPoints
      | rainfall w > 200 = 3
      | rainfall w > 100 = 2
      | rainfall w > 50  = 1
      | otherwise        = 0

    -- Primary: Wind speed (km/h)
    windPoints
      | windSpeed w > 120 = 3
      | windSpeed w > 80  = 2
      | windSpeed w > 50  = 1
      | otherwise         = 0

    -- Secondary: Temperature extremes (°C)
    tempPoints
      | temperature w > 45 || temperature w < (-10) = 2
      | temperature w > 40 || temperature w < 0     = 1
      | otherwise                                   = 0

    -- Secondary: Surface pressure (hPa) — low pressure = storms
    pressPoints
      | pressure w < 970  = 2
      | pressure w < 990  = 1
      | otherwise         = 0

    -- Secondary: Humidity (%) — high humidity amplifies heat
    humPoints
      | humidity w > 90 && temperature w > 35 = 1
      | otherwise                             = 0

pointsToSeverity :: Int -> Severity
pointsToSeverity pts
  | pts >= 6  = Extreme
  | pts >= 4  = High
  | pts >= 2  = Moderate
  | otherwise = Low