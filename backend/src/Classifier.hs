module Classifier where

import Types

-- | 1. Categorization
-- Convert continuous Double values into discrete Algebraic Data Types (ADTs)
categorizeRainfall :: Double -> RainfallCategory
categorizeRainfall r
  | r == 0          = NoRain
  | r <= 15.5       = LightRain
  | r <= 64.4       = ModerateRain
  | r <= 115.5      = HeavyRain
  | r <= 204.4      = VeryHeavyRain
  | otherwise       = ExtremelyHeavy

categorizeWind :: Double -> WindCategory
categorizeWind w
  | w <= 20  = Calm
  | w <= 40  = StrongWind
  | w <= 61  = SquallyWind
  | w <= 88  = Gale
  | w <= 117 = Storm
  | otherwise = Hurricane

categorizeTemp :: Double -> TemperatureCategory
categorizeTemp t
  | t >= 47 = SevereHeatWave
  | t >= 40 = HeatWave
  | t <= 0  = SevereColdWave
  | t <= 4  = ColdWave
  | otherwise = NormalTemp

-- | Convert a raw Weather record into a categorized WeatherCondition ADT
toCondition :: Weather -> WeatherCondition
toCondition w = WeatherCondition
  (categorizeRainfall $ rainfall w)
  (categorizeWind $ windSpeed w)
  (categorizeTemp $ temperature w)

-- | 2. Core Logic using Pattern Matching
-- Pattern matches against the WeatherCondition ADT to assign an IMD Color
classifyCondition :: WeatherCondition -> IMDColor
-- Extreme Conditions (Red Alert: Take Action)
classifyCondition (WeatherCondition ExtremelyHeavy _ _) = Red
classifyCondition (WeatherCondition _ Hurricane _) = Red
classifyCondition (WeatherCondition _ _ SevereHeatWave) = Red
classifyCondition (WeatherCondition _ _ SevereColdWave) = Red
classifyCondition (WeatherCondition VeryHeavyRain Storm _) = Red

-- High Conditions (Orange Alert: Be Prepared)
classifyCondition (WeatherCondition VeryHeavyRain _ _) = Orange
classifyCondition (WeatherCondition _ Storm _) = Orange
classifyCondition (WeatherCondition _ Gale _) = Orange
classifyCondition (WeatherCondition _ _ HeatWave) = Orange
classifyCondition (WeatherCondition _ _ ColdWave) = Orange
classifyCondition (WeatherCondition HeavyRain SquallyWind _) = Orange

-- Moderate Conditions (Yellow Alert: Be Updated)
classifyCondition (WeatherCondition HeavyRain _ _) = Yellow
classifyCondition (WeatherCondition ModerateRain _ _) = Yellow
classifyCondition (WeatherCondition _ SquallyWind _) = Yellow
classifyCondition (WeatherCondition _ StrongWind _) = Yellow

-- Safe Conditions (Green Alert: No Warning)
classifyCondition _ = Green

-- | Main exported classification function
-- Maps the strict IMD Color logic back to the simple string formats expected by the React frontend
classify :: Weather -> String
classify w =
  let condition = toCondition w
      imdColor = classifyCondition condition
  in 
    case imdColor of
      Green  -> "Low"
      Yellow -> "Moderate"
      Orange -> "High"
      Red    -> "Extreme"