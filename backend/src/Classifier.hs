module Classifier where

import Types

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CATEGORISATION
-- ─────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ML CONFIDENCE CATEGORISATION
--    Converts a raw ML probability (0-100) into a confidence level
-- ─────────────────────────────────────────────────────────────────────────────

toMLConfidence :: Double -> MLConfidence
toMLConfidence p
  | p >= 75 = HighSignal
  | p >= 50 = StrongSignal
  | p >= 30 = ModerateSignal
  | p >= 15 = WeakSignal
  | otherwise = NoSignal

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HEAT INDEX  (Steadman formula - C in, C out)
-- ─────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. COMPOUND EVENT DETECTION
-- ─────────────────────────────────────────────────────────────────────────────

countElevatedParams :: WeatherCondition -> Int
countElevatedParams wc = length $ filter id
  [ rainCat wc `elem` [HeavyRain, VeryHeavyRain, ExtremelyHeavy]
  , windCat wc `elem` [Gale, Storm, Hurricane]
  , tempCat wc `elem` [HeatWave, SevereHeatWave, ColdWave, SevereColdWave]
  , humCat  wc == VeryHighHumidity
  , presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
  ]

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DISASTER TYPE DETECTION
-- ─────────────────────────────────────────────────────────────────────────────

detectDisasterType :: WeatherCondition -> Weather -> DisasterType
detectDisasterType wc w
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
    && windCat wc `elem` [Storm, Hurricane]
    && rainCat wc `elem` [HeavyRain, VeryHeavyRain, ExtremelyHeavy]
    = CycloneWatch
  | presCat wc == ExtremeLowPressure && windCat wc == Hurricane
    = StormSurge
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
    && windCat wc `elem` [Gale, Storm]
    = TropicalStorm
  | temperature w < 25 && windCat wc `elem` [SquallyWind, Gale]
    && rainCat wc `elem` [ModerateRain, HeavyRain]
    && humCat wc `elem` [HighHumidity, VeryHighHumidity]
    = HailstormRisk
  | rainCat wc `elem` [VeryHeavyRain, ExtremelyHeavy]
    = FloodRisk
  | tempCat wc `elem` [HeatWave, SevereHeatWave]
    && humCat wc `elem` [HighHumidity, VeryHighHumidity]
    = HeatWaveEvent
  | tempCat wc `elem` [HeatWave, SevereHeatWave]
    = HeatStress
  | tempCat wc `elem` [ColdWave, SevereColdWave]
    = ColdWaveEvent
  | rainCat wc == HeavyRain
    = HeavyRainfallEvent
  | windCat wc `elem` [Storm, Hurricane]
    && presCat wc == NormalPressure
    = ExtremeWindEvent
  | windCat wc `elem` [SquallyWind, Gale]
    && rainCat wc `elem` [ModerateRain, HeavyRain]
    && presCat wc `elem` [LowPressure, VeryLowPressure]
    = ThunderstormRisk
  | countElevatedParams wc >= 3
    = CompoundRisk
  | otherwise
    = NoThreat

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CORE IMD CLASSIFICATION
-- ─────────────────────────────────────────────────────────────────────────────

classifyCondition :: WeatherCondition -> IMDColor
classifyCondition wc
  | presCat wc == ExtremeLowPressure && windCat wc `elem` [Storm, Hurricane] = Red
  | rainCat wc == ExtremelyHeavy                                              = Red
  | windCat wc == Hurricane                                                   = Red
  | tempCat wc == SevereHeatWave                                              = Red
  | tempCat wc == SevereColdWave                                              = Red
  | rainCat wc == VeryHeavyRain && windCat wc `elem` [Storm, Hurricane]      = Red
  | humCat  wc == VeryHighHumidity && tempCat wc == SevereHeatWave            = Red
  | rainCat wc == VeryHeavyRain                                               = Orange
  | windCat wc `elem` [Storm, Hurricane]                                      = Orange
  | windCat wc == Gale                                                        = Orange
  | tempCat wc `elem` [HeatWave, ColdWave]                                    = Orange
  | rainCat wc == HeavyRain && windCat wc == SquallyWind                      = Orange
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]
    && windCat wc `elem` [Gale, Storm]                                        = Orange
  | humCat  wc == VeryHighHumidity && tempCat wc == HeatWave                  = Orange
  | rainCat wc `elem` [HeavyRain, ModerateRain]                              = Yellow
  | windCat wc `elem` [SquallyWind, StrongWind]                              = Yellow
  | presCat wc `elem` [VeryLowPressure, ExtremeLowPressure]                  = Yellow
  | humCat  wc == VeryHighHumidity                                            = Yellow
  | presCat wc == LowPressure && windCat wc `elem` [StrongWind, SquallyWind] = Yellow
  | otherwise                                                                  = Green

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CONSISTENCY GATE (existing logic - unchanged)
-- ─────────────────────────────────────────────────────────────────────────────

consistencyCheck :: Weather -> IMDColor -> DisasterType -> IMDColor
consistencyCheck w color dtype
  | color == Red && not hasExtremeParam = Orange
  | color == Orange && elevated < 2 = Yellow
  | dtype == CycloneWatch && (pressure w > 1000 || windSpeed w < 40)
    && color == Red = Orange
  | dtype == FloodRisk && rainfall w < 30
    && color `elem` [Orange, Red] = Yellow
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ML-AWARE CONSISTENCY GATE
--    NEW: Uses ML probabilities to validate and refine the IMD classification
--    Logic: ML provides signal strength, IMD provides physical range checks
--    Neither overrules the other — both must agree for a high alert
-- ─────────────────────────────────────────────────────────────────────────────

mlConsistencyCheck :: Weather -> IMDColor -> DisasterType -> MLProbabilities -> IMDColor
mlConsistencyCheck w imdColor dtype ml =
  let
    -- First apply the standard IMD consistency check
    baseColor = consistencyCheck w imdColor dtype

    -- Get ML confidence for the relevant event
    eventConf = case dtype of
      CycloneWatch      -> toMLConfidence (mlCyclone       ml)
      TropicalStorm     -> toMLConfidence (mlTropicalStorm  ml)
      FloodRisk         -> toMLConfidence (mlFloodRisk      ml)
      HeatWaveEvent     -> toMLConfidence (mlHeatwave       ml)
      HeatStress        -> toMLConfidence (mlHeatwave       ml)
      ColdWaveEvent     -> toMLConfidence (mlColdWave       ml)
      ColdStress        -> toMLConfidence (mlColdWave       ml)
      ThunderstormRisk  -> toMLConfidence (mlThunderstorm   ml)
      HailstormRisk     -> toMLConfidence (mlHailstorm      ml)
      HeavyRainfallEvent-> toMLConfidence (mlHeavyRainfall  ml)
      ExtremeWindEvent  -> toMLConfidence (mlExtremeWind    ml)
      _                 -> toMLConfidence (mlOverall        ml)

    overallConf = toMLConfidence (mlOverall ml)

  in case (baseColor, eventConf) of
    -- UPGRADE: IMD says Yellow but ML is strongly confident → promote to Orange
    -- Rationale: ML detected compound signals IMD point-scoring may have missed
    (Yellow, StrongSignal) -> Orange
    (Yellow, HighSignal)   -> Orange

    -- UPGRADE: IMD says Green but ML is highly confident → promote to Yellow
    -- Rationale: ML sees early signal before IMD thresholds are crossed
    (Green, StrongSignal)  -> Yellow
    (Green, HighSignal)    -> Orange

    -- DOWNGRADE: IMD says Orange but ML has no/weak signal → demote to Yellow
    -- Rationale: IMD threshold crossed but ML sees no compound risk pattern
    (Orange, NoSignal)     -> Yellow
    (Orange, WeakSignal)   -> Yellow

    -- DOWNGRADE: IMD says Red but ML confidence is below Strong → demote to Orange
    -- Rationale: extreme IMD category requires ML confirmation
    (Red, NoSignal)        -> Orange
    (Red, WeakSignal)      -> Orange
    (Red, ModerateSignal)  -> Orange

    -- SPECIAL: If overall ML risk is High/Extreme regardless of event type
    -- and IMD is only Green, at least show Yellow
    _ | baseColor == Green && overallConf `elem` [StrongSignal, HighSignal] -> Yellow

    -- Default: trust the IMD consistency check result
    _ -> baseColor

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SIGMOID PROBABILITY
-- ─────────────────────────────────────────────────────────────────────────────

sigmoidProb :: Double -> Double
sigmoidProb x = 1.0 / (1.0 + exp (negate x))

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. HELPERS
-- ─────────────────────────────────────────────────────────────────────────────

imdColorToString :: IMDColor -> String
imdColorToString Green  = "Low"
imdColorToString Yellow = "Moderate"
imdColorToString Orange = "High"
imdColorToString Red    = "Extreme"

disasterTypeToString :: DisasterType -> String
disasterTypeToString NoThreat           = "No Threat"
disasterTypeToString HeatStress         = "Heat Stress"
disasterTypeToString ColdStress         = "Cold Stress"
disasterTypeToString FloodRisk          = "Flood Risk"
disasterTypeToString CycloneWatch       = "Cyclone Watch"
disasterTypeToString StormSurge         = "Storm Surge"
disasterTypeToString ThunderstormRisk   = "Thunderstorm Risk"
disasterTypeToString CompoundRisk       = "Compound Risk"
disasterTypeToString TropicalStorm      = "Tropical Storm"
disasterTypeToString HailstormRisk      = "Hailstorm Risk"
disasterTypeToString HeavyRainfallEvent = "Heavy Rainfall"
disasterTypeToString ExtremeWindEvent   = "Extreme Wind"
disasterTypeToString HeatWaveEvent      = "Heatwave"
disasterTypeToString ColdWaveEvent      = "Cold Wave"

bumpColor :: IMDColor -> IMDColor
bumpColor Green  = Yellow
bumpColor Yellow = Orange
bumpColor Orange = Red
bumpColor Red    = Red

hiNote :: Double -> Double -> String
hiNote tempC rh =
  let hi = heatIndex tempC rh
  in if hi > tempC + 2
       then " Apparent temperature (heat index): "
            ++ show (round hi :: Int) ++ "\176C."
       else ""

showRounded :: Double -> String
showRounded = show . (round :: Double -> Int)

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. PUBLIC API — EXISTING ENDPOINTS (unchanged)
-- ─────────────────────────────────────────────────────────────────────────────

classify :: Weather -> (String, String, String, Double)
classify w =
  let cond     = toCondition w
      rawColor = classifyCondition cond
      dtype    = detectDisasterType cond w
      color    = consistencyCheck w rawColor dtype
      prob     = stormProbability w
      note     = hiNote (temperature w) (humidity w)
  in ( imdColorToString color
     , "Classified against IMD thresholds with consistency validation." ++ note
     , disasterTypeToString dtype
     , prob
     )

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
      pressDiff = avgPressure avg - pressure w

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

      checkedColor = consistencyCheck w finalColor dtype

  in (imdColorToString checkedColor, reason, disasterTypeToString dtype, prob)

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. NEW: classifyWithML
--     Receives raw weather + ML engine probabilities
--     Uses ML probabilities to validate and refine IMD classification
--     Returns same shape as existing classify functions for easy integration
-- ─────────────────────────────────────────────────────────────────────────────

classifyWithML :: Weather -> MLProbabilities -> (String, String, String, Double)
classifyWithML w ml =
  let
    -- Step 1: Categorise raw weather params (existing Haskell logic)
    cond = toCondition w

    -- Step 2: Detect disaster type from IMD ranges (existing logic)
    dtype = detectDisasterType cond w

    -- Step 3: Get raw IMD color from thresholds (existing logic)
    rawColor = classifyCondition cond

    -- Step 4: Apply ML-aware consistency check (NEW)
    --         This is where ML probabilities validate the IMD result
    finalColor = mlConsistencyCheck w rawColor dtype ml

    -- Step 5: Compute final probability
    --         Blend Haskell sigmoid with ML overall probability
    --         Haskell sigmoid: physical range based
    --         ML overall:      pattern-based ensemble
    haskellProb = stormProbability w
    blendedProb = (haskellProb * 0.4) + (mlOverall ml * 0.6)
    finalProb   = fromIntegral (round (blendedProb * 10) :: Int) / 10.0

    -- Step 6: Build reason string explaining what happened
    eventConf   = toMLConfidence (mlOverall ml)
    note        = hiNote (temperature w) (humidity w)

    reason = buildMLReason w cond dtype rawColor finalColor eventConf note

  in ( imdColorToString finalColor
     , reason
     , disasterTypeToString dtype
     , finalProb
     )

-- | Build a human-readable reason string for the ML classification
buildMLReason :: Weather -> WeatherCondition -> DisasterType
              -> IMDColor -> IMDColor -> MLConfidence -> String -> String
buildMLReason w wc dtype imdColor finalColor mlConf note =
  let
    imdStr   = imdColorToString imdColor
    finalStr = imdColorToString finalColor
    confStr  = case mlConf of
      HighSignal     -> "high ML confidence"
      StrongSignal   -> "strong ML signal"
      ModerateSignal -> "moderate ML signal"
      WeakSignal     -> "weak ML signal"
      NoSignal       -> "no ML signal"

    -- Was the result upgraded, downgraded or unchanged?
    adjustment
      | finalColor > imdColor =
          "ML engine upgraded from " ++ imdStr ++ " to " ++ finalStr
          ++ " based on " ++ confStr ++ "."
      | finalColor < imdColor =
          "ML engine downgraded from " ++ imdStr ++ " to " ++ finalStr
          ++ " — " ++ confStr ++ " did not confirm IMD threshold breach."
      | otherwise =
          "IMD classification confirmed by ML engine (" ++ confStr ++ ")."

    -- Add physical context
    physContext = case dtype of
      CycloneWatch  -> " Pressure at " ++ show (pressure w) ++ " hPa with " ++ show (windSpeed w) ++ " km/h winds."
      FloodRisk     -> " Rainfall: " ++ show (rainfall w) ++ " mm."
      HeatWaveEvent -> " Temperature: " ++ show (temperature w) ++ "\176C." ++ note
      ColdWaveEvent -> " Temperature: " ++ show (temperature w) ++ "\176C."
      _             -> note

  in adjustment ++ physContext