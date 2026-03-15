module Classifier where

import Types

-- ─────────────────────────────────────────────────────
-- 1. CATEGORISATION
-- ─────────────────────────────────────────────────────

categorizeRainfall :: Double -> RainfallCategory
categorizeRainfall r
  | r == 0     = NoRain
  | r <= 15.5  = LightRain
  | r <= 64.4  = ModerateRain
  | r <= 115.5 = HeavyRain
  | r <= 204.4 = VeryHeavyRain
  | otherwise  = ExtremelyHeavy

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

categorizeHumidity :: Double -> HumidityCategory
categorizeHumidity h
  | h >= 90 = VeryHighHumidity
  | h >= 75 = HighHumidity
  | otherwise = NormalHumidity

categorizePressure :: Double -> PressureCategory
categorizePressure p
  | p < 970  = ExtremeLowPressure
  | p < 990  = VeryLowPressure
  | p < 1005 = LowPressure
  | otherwise = NormalPressure

toCondition :: Weather -> WeatherCondition
toCondition w = WeatherCondition
  { rainCat = categorizeRainfall $ rainfall    w
  , windCat = categorizeWind     $ windSpeed   w
  , tempCat = categorizeTemp     $ temperature w
  , humCat  = categorizeHumidity $ humidity    w
  , presCat = categorizePressure $ pressure    w
  }

-- ─────────────────────────────────────────────────────
-- 2. HEAT INDEX  (Steadman formula — °C in, °C out)
--    Meaningful only when temp >= 27°C
-- ─────────────────────────────────────────────────────

heatIndex :: Double -> Double -> Double
heatIndex tempC rh
  | tempC < 27 = tempC
  | otherwise  =
      let tf = tempC * 9 / 5 + 32
          hi =  -42.379
              + 2.04901523    * tf
              + 10.14333127   * rh
              - 0.22475541    * tf * rh
              - 6.83783e-3    * tf * tf
              - 5.481717e-2   * rh * rh
              + 1.22874e-3    * tf * tf * rh
              + 8.5282e-4     * tf * rh  * rh
              - 1.99e-6       * tf * tf  * rh * rh
      in (hi - 32) * 5 / 9

-- ─────────────────────────────────────────────────────
-- 3. COMPOUND EVENT DETECTION
--    Count how many parameters are simultaneously at
--    elevated risk — compound events amplify danger.
-- ─────────────────────────────────────────────────────

countElevatedParams :: WeatherCondition -> Int
countElevatedParams wc = length $ filter id
  [ rainCat wc `elem` [HeavyRain, VeryHeavyRain, ExtremelyHeavy]
  , windCat wc `elem` [Gale, Storm, Hurricane]
  , tempCat wc `elem` [HeatWave, SevereHeatWave, ColdWave, SevereColdWave]
  , humCat  wc == VeryHighHumidity
  , presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
  ]

-- | Identify the primary disaster type
detectDisasterType :: WeatherCondition -> DisasterType
detectDisasterType wc
  -- Cyclone: three-way compound (low pressure + storm winds + heavy rain)
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
    && windCat wc `elem` [Storm, Hurricane]
    && rainCat wc `elem` [HeavyRain, VeryHeavyRain, ExtremelyHeavy]
    = CycloneWatch
  -- Storm surge: extreme pressure + hurricane winds
  | presCat wc == ExtremeLowPressure && windCat wc == Hurricane
    = StormSurge
  -- Flood: extreme rainfall dominates
  | rainCat wc `elem` [VeryHeavyRain, ExtremelyHeavy]
    = FloodRisk
  -- Dangerous heat: heat wave AND high humidity (heat index amplification)
  | tempCat wc `elem` [HeatWave, SevereHeatWave]
    && humCat wc `elem` [HighHumidity, VeryHighHumidity]
    = HeatStress
  -- Cold stress
  | tempCat wc `elem` [ColdWave, SevereColdWave]
    = ColdStress
  -- Thunderstorm: squally winds + moderate rain + falling pressure
  | windCat wc `elem` [SquallyWind, Gale]
    && rainCat wc `elem` [ModerateRain, HeavyRain]
    && presCat wc `elem` [LowPressure, VeryLowPressure]
    = ThunderstormRisk
  -- Generic compound: 3+ parameters simultaneously elevated
  | countElevatedParams wc >= 3
    = CompoundRisk
  | otherwise
    = NoThreat

-- ─────────────────────────────────────────────────────
-- 4. CORE CLASSIFICATION  (all 5 parameters used)
-- ─────────────────────────────────────────────────────

classifyCondition :: WeatherCondition -> IMDColor
-- Red Alert ─ life-threatening
classifyCondition wc
  | presCat wc == ExtremeLowPressure && windCat wc `elem` [Storm, Hurricane] = Red
  | rainCat wc == ExtremelyHeavy                                              = Red
  | windCat wc == Hurricane                                                   = Red
  | tempCat wc == SevereHeatWave                                              = Red
  | tempCat wc == SevereColdWave                                              = Red
  | rainCat wc == VeryHeavyRain && windCat wc `elem` [Storm, Hurricane]      = Red
  | humCat  wc == VeryHighHumidity && tempCat wc == SevereHeatWave            = Red
-- Orange Alert ─ be prepared for impact
  | rainCat wc == VeryHeavyRain                                               = Orange
  | windCat wc `elem` [Storm, Hurricane]                                      = Orange
  | windCat wc == Gale                                                        = Orange
  | tempCat wc `elem` [HeatWave, ColdWave]                                    = Orange
  | rainCat wc == HeavyRain && windCat wc == SquallyWind                      = Orange
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
    && windCat wc `elem` [Gale, Storm]                                        = Orange
  | humCat  wc == VeryHighHumidity && tempCat wc == HeatWave                  = Orange
-- Yellow Alert ─ be updated
  | rainCat wc `elem` [HeavyRain, ModerateRain]                              = Yellow
  | windCat wc `elem` [SquallyWind, StrongWind]                              = Yellow
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]                  = Yellow
  | humCat  wc == VeryHighHumidity                                            = Yellow
  | presCat wc == LowPressure && windCat wc `elem` [StrongWind, SquallyWind] = Yellow
-- Green ─ no warning
  | otherwise                                                                 = Green

-- ─────────────────────────────────────────────────────
-- 5. HELPERS
-- ─────────────────────────────────────────────────────

imdColorToString :: IMDColor -> String
imdColorToString Green  = "Low"
imdColorToString Yellow = "Moderate"
imdColorToString Orange = "High"
imdColorToString Red    = "Extreme"

disasterTypeToString :: DisasterType -> String
disasterTypeToString NoThreat          = "No Threat"
disasterTypeToString HeatStress        = "Heat Stress"
disasterTypeToString ColdStress        = "Cold Stress"
disasterTypeToString FloodRisk         = "Flood Risk"
disasterTypeToString CycloneWatch      = "Cyclone Watch"
disasterTypeToString StormSurge        = "Storm Surge"
disasterTypeToString ThunderstormRisk  = "Thunderstorm Risk"
disasterTypeToString CompoundRisk      = "Compound Risk"

bumpColor :: IMDColor -> IMDColor
bumpColor Green  = Yellow
bumpColor Yellow = Orange
bumpColor Orange = Red
bumpColor Red    = Red

-- Append heat-index note when apparent temp differs significantly
hiNote :: Double -> Double -> String
hiNote tempC rh =
  let hi = heatIndex tempC rh
  in if hi > tempC + 2
       then " Apparent temperature (heat index): "
            ++ show (round hi :: Int) ++ "\176C."
       else ""

showRounded :: Double -> String
showRounded = show . (round :: Double -> Int)

-- ─────────────────────────────────────────────────────
-- 6. PUBLIC API
-- ─────────────────────────────────────────────────────

-- | Returns (severity, reason, disasterType)
classify :: Weather -> (String, String, String)
classify w =
  let cond  = toCondition w
      color = classifyCondition cond
      dtype = detectDisasterType cond
      note  = hiNote (temperature w) (humidity w)
  in ( imdColorToString color
     , "Classified against IMD absolute thresholds." ++ note
     , disasterTypeToString dtype
     )

-- | Returns (severity, reason, disasterType) with 30-day historical context
classifyWithHistory :: Weather -> WeatherAverage -> (String, String, String)
classifyWithHistory w avg =
  let cond      = toCondition w
      baseColor = classifyCondition cond
      dtype     = detectDisasterType cond

      rainDiff  = rainfall    w - avgRainfall    avg
      windDiff  = windSpeed   w - avgWindSpeed   avg
      tempDiff  = temperature w - avgTemperature avg
      humDiff   = humidity    w - avgHumidity    avg
      pressDiff = avgPressure avg - pressure w     -- positive = pressure has dropped

      note = hiNote (temperature w) (humidity w)

      (finalColor, reason)
        | rainDiff  >  50 = ( bumpColor baseColor
            , "Rainfall is " ++ showRounded rainDiff
              ++ " mm above 30-day average — significantly elevated flood risk." )
        | windDiff  >  30 = ( bumpColor baseColor
            , "Wind speed is " ++ showRounded windDiff
              ++ " km/h above 30-day average — heightened storm hazard." )
        | tempDiff  >  10 = ( bumpColor baseColor
            , "Temperature is " ++ showRounded tempDiff
              ++ "\176C above 30-day average." ++ note )
        | tempDiff  < -10 = ( bumpColor baseColor
            , "Temperature is " ++ showRounded (abs tempDiff)
              ++ "\176C below 30-day average — elevated cold risk." )
        | pressDiff >  20 = ( bumpColor baseColor
            , "Pressure has dropped " ++ showRounded pressDiff
              ++ " hPa below historical average — indicates intensifying weather system." )
        | abs rainDiff < 10 && abs windDiff < 10 && abs tempDiff < 5
          && abs humDiff < 10 && pressDiff < 10 && baseColor /= Red =
            ( Green
            , "Conditions are consistent with the 30-day historical average for this location." ++ note )
        | otherwise =
            ( baseColor
            , "Assessed against IMD absolute thresholds and 30-day historical context." ++ note )

  in (imdColorToString finalColor, reason, disasterTypeToString dtype)