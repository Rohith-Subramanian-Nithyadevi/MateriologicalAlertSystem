{-# LANGUAGE OverloadedStrings #-}
import System.Environment (lookupEnv)
import Web.Scotty
import Data.Aeson (object, (.=))
import Types
import Classifier
import Network.Wai.Middleware.Cors (simpleCors)

main :: IO ()
main = do
  portEnv <- lookupEnv "PORT"
  let port = maybe 3000 read portEnv
  scotty port $ do

    middleware simpleCors

    -- ── Health check ────────────────────────────────────────────────────────
    get "/health" $ do
      json $ object [ "status" .= ("ok" :: String) ]

    -- ── EXISTING: classify (unchanged) ──────────────────────────────────────
    get "/classify" $ do
      temp <- queryParam "temp"
      rain <- queryParam "rain"
      wind <- queryParam "wind"
      hum  <- queryParam "humidity"
      pres <- queryParam "pressure"

      let weather = Weather
            { temperature = temp
            , rainfall    = rain
            , windSpeed   = wind
            , humidity    = hum
            , pressure    = pres
            }

      let (sev, reason, disasterType, prob) = classify weather

      json $ object
        [ "severity"     .= sev
        , "reason"       .= reason
        , "disasterType" .= disasterType
        , "probability"  .= prob
        ]

    -- ── EXISTING: classifyWithHistory (unchanged) ────────────────────────────
    get "/classifyWithHistory" $ do
      temp    <- queryParam "temp"
      rain    <- queryParam "rain"
      wind    <- queryParam "wind"
      hum     <- queryParam "humidity"
      pres    <- queryParam "pressure"
      avgTemp <- queryParam "avg_temp"
      avgRain <- queryParam "avg_rain"
      avgWind <- queryParam "avg_wind"
      avgHum  <- queryParam "avg_humidity"
      avgPres <- queryParam "avg_pressure"

      let weather = Weather
            { temperature = temp
            , rainfall    = rain
            , windSpeed   = wind
            , humidity    = hum
            , pressure    = pres
            }
      let avg = WeatherAverage
            { avgTemperature = avgTemp
            , avgRainfall    = avgRain
            , avgWindSpeed   = avgWind
            , avgHumidity    = avgHum
            , avgPressure    = avgPres
            }

      let (sev, reason, disasterType, prob) = classifyWithHistory weather avg

      json $ object
        [ "severity"     .= sev
        , "reason"       .= reason
        , "disasterType" .= disasterType
        , "probability"  .= prob
        ]

    -- ── NEW: classifyML ──────────────────────────────────────────────────────
    -- Receives raw weather params + ML engine probabilities from JS frontend
    -- Uses ML probabilities to validate and refine Haskell IMD classification
    -- Both must agree for a high alert — neither blindly overrules the other
    get "/classifyML" $ do
      -- Raw weather params (same as other endpoints)
      temp <- queryParam "temp"
      rain <- queryParam "rain"
      wind <- queryParam "wind"
      hum  <- queryParam "humidity"
      pres <- queryParam "pressure"

      -- ML engine probabilities per event type (0-100 each)
      mlThunder   <- queryParam "ml_thunderstorm"
      mlCyc       <- queryParam "ml_cyclone"
      mlTropical  <- queryParam "ml_tropical_storm"
      mlHail      <- queryParam "ml_hailstorm"
      mlFlood     <- queryParam "ml_flood_risk"
      mlHeat      <- queryParam "ml_heatwave"
      mlHeavyRain <- queryParam "ml_heavy_rainfall"
      mlWind      <- queryParam "ml_extreme_wind"
      mlCold      <- queryParam "ml_cold_wave"
      mlAll       <- queryParam "ml_overall"

      let weather = Weather
            { temperature = temp
            , rainfall    = rain
            , windSpeed   = wind
            , humidity    = hum
            , pressure    = pres
            }

      let mlProbs = MLProbabilities
            { mlThunderstorm  = mlThunder
            , mlCyclone       = mlCyc
            , mlTropicalStorm = mlTropical
            , mlHailstorm     = mlHail
            , mlFloodRisk     = mlFlood
            , mlHeatwave      = mlHeat
            , mlHeavyRainfall = mlHeavyRain
            , mlExtremeWind   = mlWind
            , mlColdWave      = mlCold
            , mlOverall       = mlAll
            }

      let (sev, reason, disasterType, prob) = classifyWithML weather mlProbs

      json $ object
        [ "severity"     .= sev
        , "reason"       .= reason
        , "disasterType" .= disasterType
        , "probability"  .= prob
        ]