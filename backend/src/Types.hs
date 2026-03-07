module Types where

-- | Raw data structure from incoming request
data Weather = Weather
  { temperature :: Double
  , rainfall :: Double
  , windSpeed :: Double
  , humidity :: Double
  , pressure :: Double
  } deriving (Show, Eq)

-- | IMD Alert Colors (Severity) - This is an Algebraic Data Type (ADT)
data IMDColor
  = Green  -- No Warning
  | Yellow -- Be Updated
  | Orange -- Be Prepared
  | Red    -- Take Action
  deriving (Show, Eq)

-- | Categorized Weather Parameters as ADTs
data RainfallCategory
  = NoRain
  | LightRain      -- < 15.5 mm
  | ModerateRain   -- 15.6 - 64.4 mm
  | HeavyRain      -- 64.5 - 115.5 mm
  | VeryHeavyRain  -- 115.6 - 204.4 mm
  | ExtremelyHeavy -- > 204.4 mm
  deriving (Show, Eq)

data WindCategory
  = Calm           -- < 20 km/h
  | StrongWind     -- 20 - 40 km/h
  | SquallyWind    -- 41 - 61 km/h
  | Gale           -- 62 - 88 km/h
  | Storm          -- 89 - 117 km/h
  | Hurricane      -- > 117 km/h
  deriving (Show, Eq)

data TemperatureCategory
  = NormalTemp
  | HeatWave       -- > 40°C
  | SevereHeatWave -- > 47°C
  | ColdWave       -- <= 4°C
  | SevereColdWave -- <= 0°C
  deriving (Show, Eq)

-- | A composite ADT representing the combined condition
data WeatherCondition = WeatherCondition
  { rainCat :: RainfallCategory
  , windCat :: WindCategory
  , tempCat :: TemperatureCategory
  } deriving (Show, Eq)