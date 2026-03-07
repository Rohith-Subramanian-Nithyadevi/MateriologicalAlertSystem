{-# LANGUAGE OverloadedStrings #-}
import System.Environment (lookupEnv)
import Text.Read (readMaybe)
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
        [ "severity" .= sev
        ]