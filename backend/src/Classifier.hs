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

-- | Helper to map IMD Color to string
imdColorToString :: IMDColor -> String
imdColorToString Green  = "Low"
imdColorToString Yellow = "Moderate"
imdColorToString Orange = "High"
imdColorToString Red    = "Extreme"

-- | Helper to increase severity
bumpColor :: IMDColor -> IMDColor
bumpColor Green  = Yellow
bumpColor Yellow = Orange
bumpColor Orange = Red
bumpColor Red    = Red

-- | Main exported classification function without historical context
classify :: Weather -> (String, String)
classify w =
  let condition = toCondition w
      imdColor = classifyCondition condition
  in (imdColorToString imdColor, "Classification based on absolute thresholds.")

-- | Classification taking historical baseline into account
classifyWithHistory :: Weather -> WeatherAverage -> (String, String)
classifyWithHistory w avg =
  let condition = toCondition w
      baseColor = classifyCondition condition
      
      -- Calculate deviations
      rainDiff = rainfall w - avgRainfall avg
      windDiff = windSpeed w - avgWindSpeed avg
      tempDiff = temperature w - avgTemperature avg
      humDiff  = humidity w - avgHumidity avg
      pressDiff = avgPressure avg - pressure w -- lower pressure is worse
      
      (finalColor, reason)
        -- Significant deviation leading to increased severity
        | rainDiff > 50 = (bumpColor baseColor, "Rainfall is significantly higher than historical average.")
        | windDiff > 30 = (bumpColor baseColor, "Wind speed is significantly higher than historical average.")
        | tempDiff > 10 = (bumpColor baseColor, "Temperature is significantly higher than historical average.")
        | tempDiff < -10 = (bumpColor baseColor, "Temperature is significantly lower than historical average.")
        | pressDiff > 20 = (bumpColor baseColor, "Pressure has dropped significantly compared to historical average.")
        -- Similar to historical average, reducing perceived threat (unless it's an absolute Red extreme)
        | abs rainDiff < 10 && abs windDiff < 10 && abs tempDiff < 5 && abs humDiff < 10 && pressDiff < 10 && baseColor /= Red = 
            (Green, "Current weather is very similar to the historical average for this region.")
        -- Fallback to absolute thresholds
        | otherwise = (baseColor, "Weather conditions assessed against standard thresholds and historical context.")
        
  in (imdColorToString finalColor, reason)