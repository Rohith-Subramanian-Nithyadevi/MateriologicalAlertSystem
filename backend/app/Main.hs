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

    -- ── classify (basic IMD threshold classification) ─────────────────────
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

    -- ── classifyWithHistory (IMD + 30-day historical context) ─────────────
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

    -- ── classifyWithRuleEngine ────────────────────────────────────────────
    -- Receives raw weather params + rule engine scores from JS frontend
    -- Uses rule engine scores to validate and refine Haskell IMD classification
    -- Both must agree for a high alert — neither blindly overrules the other
    get "/classifyWithRuleEngine" $ do
      -- Raw weather params (same as other endpoints)
      temp <- queryParam "temp"
      rain <- queryParam "rain"
      wind <- queryParam "wind"
      hum  <- queryParam "humidity"
      pres <- queryParam "pressure"

      -- Rule engine scores per event type (0-100 each)
      reThunder   <- queryParam "re_thunderstorm"
      reCyc       <- queryParam "re_cyclone"
      reTropical  <- queryParam "re_tropical_storm"
      reHail      <- queryParam "re_hailstorm"
      reFlood     <- queryParam "re_flood_risk"
      reHeat      <- queryParam "re_heatwave"
      reHeavyRain <- queryParam "re_heavy_rainfall"
      reWind      <- queryParam "re_extreme_wind"
      reCold      <- queryParam "re_cold_wave"
      reAll       <- queryParam "re_overall"

      let weather = Weather
            { temperature = temp
            , rainfall    = rain
            , windSpeed   = wind
            , humidity    = hum
            , pressure    = pres
            }

      let reProbs = RuleEngineProbabilities
            { reThunderstorm  = reThunder
            , reCyclone       = reCyc
            , reTropicalStorm = reTropical
            , reHailstorm     = reHail
            , reFloodRisk     = reFlood
            , reHeatwave      = reHeat
            , reHeavyRainfall = reHeavyRain
            , reExtremeWind   = reWind
            , reColdWave      = reCold
            , reOverall       = reAll
            }

      let (sev, reason, disasterType, prob) = classifyWithRuleEngine weather reProbs

      json $ object
        [ "severity"     .= sev
        , "reason"       .= reason
        , "disasterType" .= disasterType
        , "probability"  .= prob
        ]