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

    -- Health check
    get "/health" $ do
      json $ object [ "status" .= ("ok" :: String) ]

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