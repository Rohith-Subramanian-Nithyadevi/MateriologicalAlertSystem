module Types where

data Weather = Weather
  { temperature :: Double
  , rainfall :: Double
  , windSpeed :: Double
  , humidity :: Double
  , pressure :: Double
  }

data Severity
  = Low
  | Moderate
  | High
  | Extreme
  deriving (Show, Eq)