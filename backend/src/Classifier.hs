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
-- 3. COMPOUND EVENT DETECTION — Hybrid ML-inspired
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

-- | Identify the primary disaster type — extended 9-category RF-inspired voting
detectDisasterType :: WeatherCondition -> Weather -> DisasterType
detectDisasterType wc w
  -- Cyclone: three-way compound (low pressure + storm winds + heavy rain)
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
    && windCat wc `elem` [Storm, Hurricane]
    && rainCat wc `elem` [HeavyRain, VeryHeavyRain, ExtremelyHeavy]
    = CycloneWatch
  -- Storm surge: extreme pressure + hurricane winds
  | presCat wc == ExtremeLowPressure && windCat wc == Hurricane
    = StormSurge
  -- Tropical storm: low pressure + moderate-to-strong winds
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
    && windCat wc `elem` [Gale, Storm]
    = TropicalStorm
  -- Hailstorm: cold convection — temp<25 + wind>40 + rain + high humidity
  | temperature w < 25 && windCat wc `elem` [SquallyWind, Gale]
    && rainCat wc `elem` [ModerateRain, HeavyRain]
    && humCat wc `elem` [HighHumidity, VeryHighHumidity]
    = HailstormRisk
  -- Flood: extreme rainfall dominates
  | rainCat wc `elem` [VeryHeavyRain, ExtremelyHeavy]
    = FloodRisk
  -- Heatwave: sustained extreme temperature
  | tempCat wc `elem` [HeatWave, SevereHeatWave]
    && humCat wc `elem` [HighHumidity, VeryHighHumidity]
    = HeatWaveEvent
  -- Heat stress (less severe than heatwave)
  | tempCat wc `elem` [HeatWave, SevereHeatWave]
    = HeatStress
  -- Cold wave
  | tempCat wc `elem` [ColdWave, SevereColdWave]
    = ColdWaveEvent
  -- Heavy rainfall event (below flood threshold but significant)
  | rainCat wc == HeavyRain
    = HeavyRainfallEvent
  -- Extreme wind (standalone, without cyclonic indicators)
  | windCat wc `elem` [Storm, Hurricane]
    && presCat wc == NormalPressure
    = ExtremeWindEvent
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
--    With CONSISTENCY GATE: enforces logical rules
-- ─────────────────────────────────────────────────────

classifyCondition :: WeatherCondition -> IMDColor
-- Red Alert — life-threatening
classifyCondition wc
  | presCat wc == ExtremeLowPressure && windCat wc `elem` [Storm, Hurricane] = Red
  | rainCat wc == ExtremelyHeavy                                              = Red
  | windCat wc == Hurricane                                                   = Red
  | tempCat wc == SevereHeatWave                                              = Red
  | tempCat wc == SevereColdWave                                              = Red
  | rainCat wc == VeryHeavyRain && windCat wc `elem` [Storm, Hurricane]      = Red
  | humCat  wc == VeryHighHumidity && tempCat wc == SevereHeatWave            = Red
-- Orange Alert — be prepared for impact
  | rainCat wc == VeryHeavyRain                                               = Orange
  | windCat wc `elem` [Storm, Hurricane]                                      = Orange
  | windCat wc == Gale                                                        = Orange
  | tempCat wc `elem` [HeatWave, ColdWave]                                    = Orange
  | rainCat wc == HeavyRain && windCat wc == SquallyWind                      = Orange
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
    && windCat wc `elem` [Gale, Storm]                                        = Orange
  | humCat  wc == VeryHighHumidity && tempCat wc == HeatWave                  = Orange
-- Yellow Alert — be updated
  | rainCat wc `elem` [HeavyRain, ModerateRain]                              = Yellow
  | windCat wc `elem` [SquallyWind, StrongWind]                              = Yellow
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]                  = Yellow
  | humCat  wc == VeryHighHumidity                                            = Yellow
  | presCat wc == LowPressure && windCat wc `elem` [StrongWind, SquallyWind] = Yellow
-- Green — no warning
  | otherwise                                                                 = Green

-- ─────────────────────────────────────────────────────
-- 5. CONSISTENCY GATE
--    Prevents logically contradictory alerts
-- ─────────────────────────────────────────────────────

-- | Enforce consistency: alerts must match actual signal strength
consistencyCheck :: Weather -> IMDColor -> DisasterType -> IMDColor
consistencyCheck w color dtype
  -- RULE: Red requires at least 1 extreme-range parameter
  | color == Red && not hasExtremeParam = Orange
  -- RULE: Orange requires at least 2 elevated parameters
  | color == Orange && elevated < 2 = Yellow
  -- RULE: Cyclone requires pressure < 990 AND wind > 88
  | dtype == CycloneWatch && (pressure w > 1000 || windSpeed w < 40)
    && color == Red = Orange
  -- RULE: Flood requires rain > 64
  | dtype == FloodRisk && rainfall w < 30
    && color `elem` [Orange, Red] = Yellow
  -- RULE: If all params normal, cap at Yellow
  | allNormal && color `elem` [Orange, Red] = Yellow
  | otherwise = color
  where
    hasExtremeParam = rainfall w > 204 || windSpeed w > 117
                   || temperature w > 47 || temperature w < (-10)
                   || pressure w < 970
    elevated = length $ filter id
      [ rainfall w > 64, windSpeed w > 40
      , temperature w > 40 || temperature w < 4
      , pressure w < 990, humidity w > 90
      ]
    allNormal = rainfall w < 15 && windSpeed w < 30
             && temperature w > 5 && temperature w < 38
             && pressure w > 1005 && humidity w < 85

-- ─────────────────────────────────────────────────────
-- 6. SIGMOID PROBABILITY (Logistic Regression inspired)
-- ─────────────────────────────────────────────────────

sigmoidProb :: Double -> Double
sigmoidProb x = 1.0 / (1.0 + exp (negate x))

-- | Calculate storm probability using logistic regression weights
stormProbability :: Weather -> Double
stormProbability w =
  let z = (-3.2)
        + 0.012 * max 0 (rainfall w)
        + 0.018 * max 0 (windSpeed w)
        + 0.025 * max 0 (temperature w - 40)
        + (-0.03) * min 0 (temperature w - 4)
        + 0.008 * max 0 (humidity w - 75)
        + (-0.015) * (1013 - pressure w)
  in fromIntegral (round (sigmoidProb z * 1000) :: Int) / 10.0

-- ─────────────────────────────────────────────────────
-- 7. HELPERS
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
disasterTypeToString TropicalStorm     = "Tropical Storm"
disasterTypeToString HailstormRisk     = "Hailstorm Risk"
disasterTypeToString HeavyRainfallEvent = "Heavy Rainfall"
disasterTypeToString ExtremeWindEvent  = "Extreme Wind"
disasterTypeToString HeatWaveEvent     = "Heatwave"
disasterTypeToString ColdWaveEvent     = "Cold Wave"

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
-- 8. PUBLIC API
-- ─────────────────────────────────────────────────────

-- | Returns (severity, reason, disasterType, probability)
classify :: Weather -> (String, String, String, Double)
classify w =
  let cond  = toCondition w
      rawColor = classifyCondition cond
      dtype = detectDisasterType cond w
      color = consistencyCheck w rawColor dtype
      prob  = stormProbability w
      note  = hiNote (temperature w) (humidity w)
  in ( imdColorToString color
     , "Classified against IMD thresholds with consistency validation." ++ note
     , disasterTypeToString dtype
     , prob
     )

-- | Returns (severity, reason, disasterType, probability) with 30-day historical context
classifyWithHistory :: Weather -> WeatherAverage -> (String, String, String, Double)
classifyWithHistory w avg =
  let cond      = toCondition w
      rawColor  = classifyCondition cond
      dtype     = detectDisasterType cond w
      baseColor = consistencyCheck w rawColor dtype
      prob      = stormProbability w

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

      -- Apply consistency check to final color
      checkedColor = consistencyCheck w finalColor dtype

  in (imdColorToString checkedColor, reason, disasterTypeToString dtype, prob)