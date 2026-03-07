{-# LANGUAGE OverloadedStrings #-}

import Web.Scotty
import Data.Aeson (object, (.=))
import Types
import Classifier

import Network.Wai.Middleware.Cors (simpleCors)

main :: IO ()
main = scotty 3000 $ do

  middleware simpleCors

  get "/classify" $ do

    temp <- queryParam "temp"
    rain <- queryParam "rain"
    wind <- queryParam "wind"
    hum  <- queryParam "humidity"
    pres <- queryParam "pressure"

    let weather = Weather
          { temperature = temp
          , rainfall = rain
          , windSpeed = wind
          , humidity = hum
          , pressure = pres
          }

    let sev = classify weather

    json $ object
      [ "severity" .= show sev
      ]