module Types where

-- | Raw data structure from incoming request
data Weather = Weather
  { temperature :: Double
  , rainfall    :: Double
  , windSpeed   :: Double
  , humidity    :: Double
  , pressure    :: Double
  } deriving (Show, Eq)

-- | Historical average baseline for context
data WeatherAverage = WeatherAverage
  { avgTemperature :: Double
  , avgRainfall    :: Double
  , avgWindSpeed   :: Double
  , avgHumidity    :: Double
  , avgPressure    :: Double
  } deriving (Show, Eq)

-- | ML engine probabilities for each event type (0-100)
-- These come from the JS Hybrid ML Engine and represent
-- the combined LR + RF + GB ensemble probabilities
data MLProbabilities = MLProbabilities
  { mlThunderstorm   :: Double
  , mlCyclone        :: Double
  , mlTropicalStorm  :: Double
  , mlHailstorm      :: Double
  , mlFloodRisk      :: Double
  , mlHeatwave       :: Double
  , mlHeavyRainfall  :: Double
  , mlExtremeWind    :: Double
  , mlColdWave       :: Double
  , mlOverall        :: Double   -- highest probability across all events
  } deriving (Show, Eq)

-- | Combined input for /classifyML endpoint
data MLClassifyRequest = MLClassifyRequest
  { mlWeather       :: Weather
  , mlProbabilities :: MLProbabilities
  } deriving (Show, Eq)

-- | IMD Alert Colors (Severity)
data IMDColor
  = Green   -- No Warning
  | Yellow  -- Be Updated
  | Orange  -- Be Prepared
  | Red     -- Take Action
  deriving (Show, Eq, Ord)

-- | Rainfall categories (IMD scale, mm/day)
data RainfallCategory
  = NoRain
  | LightRain        -- <= 15.5 mm
  | ModerateRain     -- 15.6 - 64.4 mm
  | HeavyRain        -- 64.5 - 115.5 mm
  | VeryHeavyRain    -- 115.6 - 204.4 mm
  | ExtremelyHeavy   -- > 204.4 mm
  deriving (Show, Eq, Ord)

-- | Wind categories (km/h)
data WindCategory
  = Calm             -- <= 20
  | StrongWind       -- 21 - 40
  | SquallyWind      -- 41 - 61
  | Gale             -- 62 - 88
  | Storm            -- 89 - 117
  | Hurricane        -- > 117
  deriving (Show, Eq, Ord)

-- | Temperature categories (C)
data TemperatureCategory
  = NormalTemp
  | HeatWave         -- >= 40C
  | SevereHeatWave   -- >= 47C
  | ColdWave         -- <= 4C
  | SevereColdWave   -- <= 0C
  deriving (Show, Eq, Ord)

-- | Humidity categories (%)
data HumidityCategory
  = NormalHumidity
  | HighHumidity      -- >= 75%
  | VeryHighHumidity  -- >= 90%
  deriving (Show, Eq, Ord)

-- | Pressure categories (hPa)
data PressureCategory
  = NormalPressure
  | LowPressure          -- < 1005 hPa
  | VeryLowPressure      -- < 990 hPa
  | ExtremeLowPressure   -- < 970 hPa
  deriving (Show, Eq, Ord)

-- | ML probability thresholds for event confirmation
data MLConfidence
  = NoSignal       -- < 15%
  | WeakSignal     -- 15-30%
  | ModerateSignal -- 30-50%
  | StrongSignal   -- 50-75%
  | HighSignal     -- > 75%
  deriving (Show, Eq, Ord)

-- | Extended disaster type classification
data DisasterType
  = NoThreat
  | HeatStress
  | ColdStress
  | FloodRisk
  | CycloneWatch
  | StormSurge
  | ThunderstormRisk
  | CompoundRisk
  | TropicalStorm
  | HailstormRisk
  | HeavyRainfallEvent
  | ExtremeWindEvent
  | HeatWaveEvent
  | ColdWaveEvent
  deriving (Show, Eq)

-- | Composite ADT - all 5 parameters categorised
data WeatherCondition = WeatherCondition
  { rainCat :: RainfallCategory
  , windCat :: WindCategory
  , tempCat :: TemperatureCategory
  , humCat  :: HumidityCategory
  , presCat :: PressureCategory
  } deriving (Show, Eq)