import { useState, useEffect, useCallback } from 'react'

const BACKEND_URL = "https://meteorological-backend.onrender.com"

// ─── Severity config ────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  Low:      { emoji: '✅', className: 'low' },
  Moderate: { emoji: '⚠️', className: 'moderate' },
  High:     { emoji: '🔶', className: 'high' },
  Extreme:  { emoji: '🔴', className: 'extreme' },
}

// ─── Disaster type config ────────────────────────────────────────────────────
const DISASTER_CONFIG = {
  'Cyclone Watch':     { emoji: '🌀', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.35)' },
  'Storm Surge':       { emoji: '🌊', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.35)'  },
  'Flood Risk':        { emoji: '💧', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.35)'  },
  'Heat Stress':       { emoji: '🔥', color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)'  },
  'Cold Stress':       { emoji: '❄️', color: '#93c5fd', bg: 'rgba(147,197,253,0.12)', border: 'rgba(147,197,253,0.35)' },
  'Thunderstorm Risk': { emoji: '⛈️', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.35)' },
  'Compound Risk':     { emoji: '⚡', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)'  },
  'No Threat':         { emoji: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)'   },
}

// ─── Global scan cities ──────────────────────────────────────────────────────
const GLOBAL_SCAN_CITIES = [
  { name: 'Mumbai',           country: 'India',       lat: 19.08,  lon: 72.88  },
  { name: 'Delhi',            country: 'India',       lat: 28.61,  lon: 77.21  },
  { name: 'Chennai',          country: 'India',       lat: 13.08,  lon: 80.27  },
  { name: 'Kolkata',          country: 'India',       lat: 22.57,  lon: 88.36  },
  { name: 'Dhaka',            country: 'Bangladesh',  lat: 23.81,  lon: 90.41  },
  { name: 'Tokyo',            country: 'Japan',       lat: 35.68,  lon: 139.69 },
  { name: 'Manila',           country: 'Philippines', lat: 14.60,  lon: 120.98 },
  { name: 'Ho Chi Minh City', country: 'Vietnam',     lat: 10.82,  lon: 106.63 },
  { name: 'Bangkok',          country: 'Thailand',    lat: 13.75,  lon: 100.52 },
  { name: 'Jakarta',          country: 'Indonesia',   lat: -6.21,  lon: 106.85 },
  { name: 'Shanghai',         country: 'China',       lat: 31.23,  lon: 121.47 },
  { name: 'Beijing',          country: 'China',       lat: 39.90,  lon: 116.40 },
  { name: 'Hong Kong',        country: 'China',       lat: 22.32,  lon: 114.17 },
  { name: 'Taipei',           country: 'Taiwan',      lat: 25.03,  lon: 121.57 },
  { name: 'Seoul',            country: 'South Korea', lat: 37.57,  lon: 126.98 },
  { name: 'London',           country: 'UK',          lat: 51.51,  lon: -0.13  },
  { name: 'Miami',            country: 'USA',         lat: 25.76,  lon: -80.19 },
  { name: 'Houston',          country: 'USA',         lat: 29.76,  lon: -95.37 },
  { name: 'New York',         country: 'USA',         lat: 40.71,  lon: -74.01 },
  { name: 'Mexico City',      country: 'Mexico',      lat: 19.43,  lon: -99.13 },
  { name: 'São Paulo',        country: 'Brazil',      lat: -23.55, lon: -46.63 },
  { name: 'Lagos',            country: 'Nigeria',     lat: 6.52,   lon: 3.38   },
  { name: 'Nairobi',          country: 'Kenya',       lat: -1.29,  lon: 36.82  },
  { name: 'Cairo',            country: 'Egypt',       lat: 30.04,  lon: 31.24  },
  { name: 'Sydney',           country: 'Australia',   lat: -33.87, lon: 151.21 },
  { name: 'Dubai',            country: 'UAE',         lat: 25.20,  lon: 55.27  },
  { name: 'Karachi',          country: 'Pakistan',    lat: 24.86,  lon: 67.01  },
  { name: 'Colombo',          country: 'Sri Lanka',   lat: 6.93,   lon: 79.84  },
  { name: 'Yangon',           country: 'Myanmar',     lat: 16.87,  lon: 96.20  },
  { name: 'Havana',           country: 'Cuba',        lat: 23.11,  lon: -82.37 },
]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Steadman Heat Index — returns apparent °C or null if not meaningful */
function calculateHeatIndex(tempC, rh) {
  if (tempC < 27) return null
  const tf = tempC * 9 / 5 + 32
  const hi =
    -42.379 +
    2.04901523   * tf +
    10.14333127  * rh -
    0.22475541   * tf * rh -
    6.83783e-3   * tf * tf -
    5.481717e-2  * rh * rh +
    1.22874e-3   * tf * tf * rh +
    8.5282e-4    * tf * rh  * rh -
    1.99e-6      * tf * tf  * rh * rh
  const hiC = (hi - 32) * 5 / 9
  return hiC > tempC + 2 ? Math.round(hiC * 10) / 10 : null
}

/** Return trend arrow, label, and colour for a parameter vs its 30-day average */
function getTrend(current, average, invertBad = false) {
  const diff = current - average
  if (Math.abs(diff) < 0.5) return { symbol: '→', label: 'Stable', color: '#64748b' }
  const rising = diff > 0
  const badColor  = '#ef4444'
  const goodColor = '#22c55e'
  const color = (rising !== invertBad) ? badColor : goodColor
  return {
    symbol: rising ? '↑' : '↓',
    label: `${rising ? '+' : ''}${diff.toFixed(1)}`,
    color,
  }
}

/**
 * Compound Risk Score — grades each of the 5 parameters 0→max
 * Returns { score, maxScore, pct, bars[] }
 * This is the "Risk Fingerprint" unique feature.
 */
function getCompoundScore(weather) {
  const { temp, wind, rain, humidity, pressure } = weather
  let score = 0
  const bars = []

  // Rainfall  (max 3)
  if      (rain > 204) { score += 3; bars.push({ label: 'Rainfall',    pct: 100, level: 'extreme', value: `${rain}mm` }) }
  else if (rain > 115) { score += 2; bars.push({ label: 'Rainfall',    pct: 70,  level: 'high',    value: `${rain}mm` }) }
  else if (rain > 64)  { score += 1; bars.push({ label: 'Rainfall',    pct: 42,  level: 'moderate',value: `${rain}mm` }) }
  else                               bars.push({ label: 'Rainfall',    pct: Math.min(rain / 64 * 30, 30), level: 'low', value: `${rain}mm` })

  // Wind Speed (max 3)
  if      (wind > 117) { score += 3; bars.push({ label: 'Wind Speed',  pct: 100, level: 'extreme', value: `${wind}km/h` }) }
  else if (wind > 88)  { score += 2; bars.push({ label: 'Wind Speed',  pct: 70,  level: 'high',    value: `${wind}km/h` }) }
  else if (wind > 61)  { score += 1; bars.push({ label: 'Wind Speed',  pct: 44,  level: 'moderate',value: `${wind}km/h` }) }
  else                               bars.push({ label: 'Wind Speed',  pct: Math.min(wind / 61 * 35, 35), level: 'low', value: `${wind}km/h` })

  // Temperature (max 2)
  if      (temp > 47 || temp < -10) { score += 2; bars.push({ label: 'Temperature', pct: 100, level: 'extreme', value: `${temp}°C` }) }
  else if (temp > 40 || temp <   0) { score += 1; bars.push({ label: 'Temperature', pct: 60,  level: 'high',    value: `${temp}°C` }) }
  else                                             bars.push({ label: 'Temperature', pct: 20,  level: 'low',     value: `${temp}°C` })

  // Pressure (max 2) — lower is worse
  if      (pressure < 970)  { score += 2; bars.push({ label: 'Pressure', pct: 100, level: 'extreme', value: `${pressure}hPa` }) }
  else if (pressure < 990)  { score += 1; bars.push({ label: 'Pressure', pct: 60,  level: 'high',    value: `${pressure}hPa` }) }
  else                                    bars.push({ label: 'Pressure', pct: Math.max(0, Math.min((1013 - pressure) / 43 * 40, 40)), level: 'low', value: `${pressure}hPa` })

  // Heat Index / Humidity (max 1)
  const hi = calculateHeatIndex(temp, humidity)
  if (humidity > 90 && temp > 35) {
    score += 1
    bars.push({ label: 'Heat Index', pct: 100, level: 'high', value: hi ? `${hi}°C feels-like` : `${humidity}%` })
  } else {
    bars.push({ label: 'Heat Index', pct: Math.min(humidity / 90 * 45, 45), level: 'low', value: hi ? `${hi}°C feels-like` : `${humidity}%` })
  }

  return { score, maxScore: 11, pct: Math.round(score / 11 * 100), bars }
}

/** Generate a dynamic, value-specific assessment paragraph */
function generateDynamicAssessment(weather, severity, disasterType) {
  const { temp, wind, rain, humidity, pressure } = weather
  const hi = calculateHeatIndex(temp, humidity)

  if (severity === 'Low') {
    return `All monitored parameters are within normal safe ranges — temperature ${temp}°C, wind ${wind} km/h, rainfall ${rain} mm, pressure ${pressure} hPa, humidity ${humidity}%. No weather-related disruptions are anticipated.`
  }

  switch (disasterType) {
    case 'Cyclone Watch':
      return `Three-parameter compound event detected: pressure of ${pressure} hPa (${pressure < 970 ? 'extreme' : 'very'} low), wind speed of ${wind} km/h, and ${rain} mm rainfall occurring simultaneously — classic indicators of a developing tropical cyclonic system. Conditions are likely to deteriorate rapidly.`

    case 'Storm Surge':
      return `Extreme atmospheric pressure (${pressure} hPa) combined with hurricane-force winds (${wind} km/h) present severe coastal storm surge risk. Significant inland flooding and structural damage are probable.`

    case 'Flood Risk':
      return `Rainfall of ${rain} mm ${rain > 204 ? 'exceeds the IMD Extremely Heavy threshold (>204 mm)' : 'exceeds the IMD Very Heavy threshold (>115 mm)'}. Flash flooding, waterlogging, and inundation of low-lying areas are highly probable. River levels may rise rapidly.`

    case 'Heat Stress':
      return `Temperature of ${temp}°C combined with ${humidity}% relative humidity creates dangerous heat stress.${hi ? ` The heat index (apparent temperature) is ${hi}°C — the body experiences conditions ${Math.round(hi - temp)}°C hotter than ambient.` : ''} Risk of heat exhaustion and heat stroke is elevated, particularly for outdoor workers and vulnerable populations.`

    case 'Cold Stress':
      return `Temperature of ${temp}°C ${temp < 0 ? 'is below freezing' : 'represents severe cold wave conditions'}. Wind chill at ${wind} km/h significantly amplifies thermal stress. Risk of hypothermia, frostbite, and cold-related cardiovascular events is elevated.`

    case 'Thunderstorm Risk':
      return `Falling pressure (${pressure} hPa), gusty winds of ${wind} km/h, and ${rain} mm of rainfall indicate active convective storm conditions. Expect lightning, localised heavy downpours, and sudden wind gusts.`

    case 'Compound Risk':
      return `Multiple meteorological parameters are simultaneously above safe thresholds (wind: ${wind} km/h, rain: ${rain} mm, pressure: ${pressure} hPa, temp: ${temp}°C). Compound hazard events carry disproportionately higher risk than any single parameter would indicate in isolation.`

    default:
      return `${severity === 'Moderate' ? 'One or more' : 'Multiple'} weather parameters have exceeded baseline thresholds — temperature: ${temp}°C, wind: ${wind} km/h, rainfall: ${rain} mm, pressure: ${pressure} hPa. Conditions warrant close monitoring.`
  }
}

/** Generate dynamic, value-specific safety advisories */
function generateDynamicAdvisories(weather, severity, disasterType) {
  const { temp, wind, rain, pressure } = weather
  const hi = calculateHeatIndex(temp, weather.humidity)
  const advisories = []

  if (severity === 'Low') {
    return [
      'No special precautions required — all parameters within safe ranges',
      'Continue monitoring periodic IMD / local weather forecast updates',
      'Outdoor activities may proceed normally',
    ]
  }

  if (disasterType === 'Cyclone Watch' || disasterType === 'Storm Surge') {
    advisories.push('Move to designated shelter or higher ground immediately — do not wait for conditions to worsen')
    advisories.push('Comply with all official evacuation orders without delay')
    advisories.push(`Board windows; move vehicles away from coastal and low-lying areas`)
    advisories.push('Avoid rivers, streams, and flooded roads — even shallow water can be dangerous')
  }

  if (disasterType === 'Flood Risk' || rain > 100) {
    advisories.push(`Avoid all low-lying areas, underpasses, and basements — ${rain} mm rainfall can cause flash flooding within minutes`)
    advisories.push('Do not attempt to cross flooded roads, bridges, or waterways by foot or vehicle')
    advisories.push('Move important documents, electronics, and valuables to upper floors')
  }

  if (disasterType === 'Heat Stress' || temp >= 38) {
    advisories.push(`Drink 250 ml of water every 20 minutes — at ${hi ?? temp}°C apparent temperature, dehydration occurs rapidly`)
    advisories.push('Avoid all strenuous outdoor activity between 11 AM – 4 PM')
    advisories.push('Check on elderly neighbours, young children, and pets every 2 hours')
    advisories.push('Use ORS (oral rehydration salts) if experiencing dizziness or cramps')
  }

  if (disasterType === 'Cold Stress' || temp <= 0) {
    advisories.push(`Wear 3+ insulating layers — wind chill at ${wind} km/h with ${temp}°C creates frostbite risk within 30 minutes of exposure`)
    advisories.push('Avoid prolonged outdoor exposure; recognise hypothermia signs: shivering, confusion, slurred speech')
    advisories.push('Ensure heating systems are functional and fuel/gas reserves are adequate')
  }

  if (disasterType === 'Thunderstorm Risk') {
    advisories.push('Stay indoors; avoid open fields, tall trees, and elevated terrain')
    advisories.push('Unplug sensitive electronics — lightning strikes can cause power surges')
    advisories.push('If caught outdoors, crouch low with feet together — do not lie flat')
  }

  if (wind > 60) {
    advisories.push(`Secure all loose outdoor objects — ${wind} km/h winds can propel debris at dangerous velocities`)
    advisories.push('Stay away from construction sites, trees, and power lines')
  }

  if (pressure < 990) {
    advisories.push(`Pressure at ${pressure} hPa and falling — monitor IMD bulletins every 30 minutes for system updates`)
  }

  if (severity === 'High' || severity === 'Extreme') {
    advisories.push('Prepare emergency kit: 3-day water supply (4L/person/day), first-aid, torch, fully charged power bank')
    advisories.push('Keep IMD / NDMA alert channels open: ndma.gov.in or Sachet app')
  }

  if (severity === 'Extreme') {
    advisories.push('Contact emergency services immediately if in danger — NDRF helpline: 9711077372')
    advisories.push('Assist vulnerable individuals: elderly, children, and persons with disabilities')
  }

  if (advisories.length === 0) {
    advisories.push('Monitor official IMD weather forecasts and local emergency notifications')
    advisories.push('Carry weather-appropriate gear if travelling outdoors')
  }

  return advisories
}

/** Keep original getAlertReasons for "Contributing Factors" section */
function getAlertReasons(weather) {
  const reasons = []

  if (weather.rain > 200)      reasons.push({ icon: '🌧️', text: `Rainfall: ${weather.rain} mm — exceeds 204 mm IMD Extremely Heavy threshold` })
  else if (weather.rain > 115) reasons.push({ icon: '🌧️', text: `Rainfall: ${weather.rain} mm — exceeds 115 mm Very Heavy threshold` })
  else if (weather.rain > 64)  reasons.push({ icon: '🌧️', text: `Rainfall: ${weather.rain} mm — exceeds 64 mm Heavy threshold` })

  if (weather.wind > 117)      reasons.push({ icon: '🌪️', text: `Wind: ${weather.wind} km/h — hurricane-force (>117 km/h)` })
  else if (weather.wind > 88)  reasons.push({ icon: '💨', text: `Wind: ${weather.wind} km/h — storm-force (>88 km/h)` })
  else if (weather.wind > 61)  reasons.push({ icon: '💨', text: `Wind: ${weather.wind} km/h — gale-force (>61 km/h)` })

  const hi = calculateHeatIndex(weather.temp, weather.humidity)
  if (weather.temp > 47)       reasons.push({ icon: '🔥', text: `Temperature: ${weather.temp}°C — IMD Severe Heat Wave (>47°C)` })
  else if (weather.temp > 40)  reasons.push({ icon: '☀️', text: `Temperature: ${weather.temp}°C — IMD Heat Wave (>40°C)${hi ? `; feels like ${hi}°C` : ''}` })
  else if (weather.temp < -10) reasons.push({ icon: '🥶', text: `Temperature: ${weather.temp}°C — extreme cold (<−10°C)` })
  else if (weather.temp < 0)   reasons.push({ icon: '❄️', text: `Temperature: ${weather.temp}°C — below freezing` })

  if (weather.pressure < 970)  reasons.push({ icon: '📉', text: `Pressure: ${weather.pressure} hPa — extreme low (<970 hPa); cyclonic system likely` })
  else if (weather.pressure < 990) reasons.push({ icon: '📉', text: `Pressure: ${weather.pressure} hPa — very low (<990 hPa); active weather system` })
  else if (weather.pressure < 1005) reasons.push({ icon: '📉', text: `Pressure: ${weather.pressure} hPa — below normal (<1005 hPa)` })

  if (weather.humidity > 90 && weather.temp > 35)
    reasons.push({ icon: '🥵', text: `Heat stress: ${weather.humidity}% humidity at ${weather.temp}°C — dangerous heat index combination` })

  if (reasons.length === 0)
    reasons.push({ icon: '✅', text: 'All five parameters are within normal operating ranges' })

  return reasons
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function WeatherDashboard() {
  const [city, setCity]             = useState('')
  const [weather, setWeather]       = useState(null)
  const [severity, setSeverity]     = useState('')
  const [reason, setReason]         = useState('')
  const [disasterType, setDisasterType] = useState('')
  const [cityName, setCityName]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const [watchlist, setWatchlist]   = useState([])
  const [monitorData, setMonitorData] = useState({})

  const [globalAlerts, setGlobalAlerts]   = useState([])
  const [scanLoading, setScanLoading]     = useState(false)
  const [lastScanTime, setLastScanTime]   = useState(null)

  // ─── Global Alert Scanner ──────────────────────────────────────────────────
  const runGlobalScan = useCallback(async () => {
    setScanLoading(true)
    const alerts = []

    for (const loc of GLOBAL_SCAN_CITIES) {
      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
          `&current=temperature_2m,wind_speed_10m,relative_humidity_2m,surface_pressure,rain`
        )
        const weatherData = await weatherRes.json()
        const current = weatherData.current
        if (!current) continue

        const temp     = current.temperature_2m       ?? 0
        const wind     = current.wind_speed_10m       ?? 0
        const rain     = current.rain                 ?? 0
        const humidity = current.relative_humidity_2m ?? 50
        const pressure = current.surface_pressure     ?? 1013

        const classifyRes  = await fetch(
          `${BACKEND_URL}/classify?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}`
        )
        const classifyData = await classifyRes.json()
        const sev   = classifyData.severity    || 'Low'
        const dtype = classifyData.disasterType || 'No Threat'

        if (sev !== 'Low') {
          alerts.push({ name: loc.name, country: loc.country, temp, wind, rain, humidity, pressure, severity: sev, disasterType: dtype })
        }
      } catch (e) {
        console.error(`Global scan failed for ${loc.name}:`, e)
      }
    }

    const order = { Extreme: 0, High: 1, Moderate: 2 }
    alerts.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
    setGlobalAlerts(alerts)
    setLastScanTime(new Date())
    setScanLoading(false)
  }, [])

  useEffect(() => {
    runGlobalScan()
    const interval = setInterval(runGlobalScan, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [runGlobalScan])

  // ─── Watchlist ─────────────────────────────────────────────────────────────
  const addToWatchlist = () => {
    if (cityName && !watchlist.includes(cityName)) {
      setWatchlist(prev => [...prev, cityName])
      if (weather && severity) {
        setMonitorData(prev => ({
          ...prev,
          [cityName]: {
            temp: weather.temp, wind: weather.wind,
            rain: weather.rain, humidity: weather.humidity,
            pressure: weather.pressure, severity, disasterType,
            country: cityName.split(', ')[1] || '',
            resolvedName: cityName.split(', ')[0],
          }
        }))
      } else {
        fetchMonitorForCity(cityName)
      }
    }
  }

  const removeFromWatchlist = (e, name) => {
    e.stopPropagation()
    setWatchlist(prev => prev.filter(c => c !== name))
    setMonitorData(prev => { const copy = { ...prev }; delete copy[name]; return copy })
  }

  async function fetchMonitorForCity(name) {
    try {
      const geoRes  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`)
      const geoData = await geoRes.json()
      if (geoData.results?.[0]) {
        const { latitude: lat, longitude: lon, country } = geoData.results[0]
        const wRes  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,surface_pressure,rain`)
        const wData = await wRes.json()
        const c = wData.current
        if (c) {
          const temp = c.temperature_2m ?? 0, wind = c.wind_speed_10m ?? 0
          const rain = c.rain ?? 0, humidity = c.relative_humidity_2m ?? 50, pressure = c.surface_pressure ?? 1013
          const cRes  = await fetch(`${BACKEND_URL}/classify?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}`)
          const cData = await cRes.json()
          setMonitorData(prev => ({
            ...prev,
            [name]: {
              temp, wind, rain, humidity, pressure,
              severity:    cData.severity    || 'Low',
              disasterType: cData.disasterType || 'No Threat',
              country: country || '',
              resolvedName: geoData.results[0].name,
            }
          }))
        }
      }
    } catch (e) { console.error(`Monitor fetch failed for ${name}:`, e) }
  }

  // ─── Search ────────────────────────────────────────────────────────────────
  async function fetchWeather() {
    const trimmed = city.trim()
    if (!trimmed) { setError('Please enter a city name.'); return }

    setLoading(true); setError('')
    setWeather(null); setSeverity(''); setReason(''); setDisasterType('')

    try {
      const geoRes  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1`)
      if (!geoRes.ok) throw new Error('Failed to reach the geocoding service.')
      const geoData = await geoRes.json()
      if (!geoData.results?.length) throw new Error(`City "${trimmed}" not found. Please check the spelling.`)

      const { latitude: lat, longitude: lon, name: resolvedName, country } = geoData.results[0]
      setCityName(`${resolvedName}, ${country || ''}`.trim())

      const wRes  = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,wind_speed_10m,relative_humidity_2m,surface_pressure,rain` +
        `&past_days=30&hourly=temperature_2m,wind_speed_10m,relative_humidity_2m,surface_pressure,rain`
      )
      if (!wRes.ok) throw new Error('Failed to fetch weather data.')
      const wData = await wRes.json()

      const current = wData.current
      if (!current) throw new Error('Weather data unavailable for this location.')

      const temp     = current.temperature_2m       ?? 0
      const wind     = current.wind_speed_10m       ?? 0
      const humidity = current.relative_humidity_2m ?? 50
      const pressure = current.surface_pressure     ?? 1013
      const rain     = current.rain                 ?? 0

      let avgTemp = 0, avgWind = 0, avgHumidity = 50, avgPressure = 1013, avgRain = 0
      if (wData.hourly?.time) {
        const h = wData.hourly
        const n = h.time.length || 1
        const sum = arr => (arr || []).reduce((a, b) => a + (b || 0), 0)
        avgTemp     = parseFloat((sum(h.temperature_2m)        / n).toFixed(1))
        avgWind     = parseFloat((sum(h.wind_speed_10m)        / n).toFixed(1))
        avgHumidity = Math.round(sum(h.relative_humidity_2m)   / n)
        avgPressure = Math.round(sum(h.surface_pressure)       / n)
        avgRain     = parseFloat((sum(h.rain) / (n / 24 || 1)).toFixed(1))
      }

      setWeather({ temp, wind, humidity, pressure, rain, avgTemp, avgWind, avgHumidity, avgPressure, avgRain })

      const cRes  = await fetch(
        `${BACKEND_URL}/classifyWithHistory?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}` +
        `&avg_temp=${avgTemp}&avg_rain=${avgRain}&avg_wind=${avgWind}&avg_humidity=${avgHumidity}&avg_pressure=${avgPressure}`
      )
      if (!cRes.ok) throw new Error('Classification service unavailable. Ensure the backend is running.')
      const cData = await cRes.json()
      setSeverity(cData.severity    || 'Unknown')
      setReason(cData.reason        || '')
      setDisasterType(cData.disasterType || 'No Threat')

    } catch (err) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) { if (e.key === 'Enter') fetchWeather() }

  const sevConfig    = SEVERITY_CONFIG[severity]  || { emoji: '❓', className: '' }
  const dConfig      = DISASTER_CONFIG[disasterType] || DISASTER_CONFIG['No Threat']
  const showDetails  = weather && !loading && severity

  const compound     = weather ? getCompoundScore(weather) : null
  const assessment   = weather ? generateDynamicAssessment(weather, severity, disasterType) : ''
  const advisories   = weather ? generateDynamicAdvisories(weather, severity, disasterType) : []
  const factors      = weather ? getAlertReasons(weather) : []

  const compoundBarColor =
    compound?.pct >= 80 ? '#ef4444' :
    compound?.pct >= 55 ? '#f97316' :
    compound?.pct >= 30 ? '#f59e0b' : '#22c55e'

  const levelColors = { extreme: '#ef4444', high: '#f97316', moderate: '#f59e0b', low: '#22c55e' }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`layout-wrapper ${showDetails ? 'has-details' : ''}`}>

      {/* ── LEFT: Weather Dashboard ─────────────────────────── */}
      <div className="dashboard-card">
        <div className="dashboard-header">
          <span className="dashboard-icon">🌦️</span>
          <h1 className="dashboard-title">Meteorological Alert System</h1>
          <p className="dashboard-subtitle">Real-time severity classification · IMD framework</p>
        </div>

        <div className="input-group">
          <input
            className="city-input"
            type="text"
            placeholder="Enter city name..."
            value={city}
            onChange={e => setCity(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button className="fetch-btn" onClick={fetchWeather} disabled={loading}>
            {loading ? '...' : 'Analyze'}
          </button>
        </div>

        {error && (
          <div className="error-message" role="alert">
            <span className="error-icon">⚠️</span><span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <span className="loading-text">Fetching weather data...</span>
          </div>
        )}

        {weather && !loading && (
          <div className="weather-results">
            {cityName && (
              <div className="city-display">📍 <span className="city-name">{cityName}</span></div>
            )}

            {/* Stat Cards with trend indicators */}
            <div className="weather-stats">
              {[
                { icon: '🌡️', value: `${weather.temp}°C`,      label: 'Temperature', trend: getTrend(weather.temp, weather.avgTemp, false),      avg: `${weather.avgTemp}°C`    },
                { icon: '💨', value: `${weather.wind} km/h`,    label: 'Wind Speed',  trend: getTrend(weather.wind, weather.avgWind, false),      avg: `${weather.avgWind}km/h`  },
                { icon: '💧', value: `${weather.humidity}%`,    label: 'Humidity',    trend: getTrend(weather.humidity, weather.avgHumidity, false), avg: `${weather.avgHumidity}%`  },
                { icon: '🌧️', value: `${weather.rain} mm`,      label: 'Rainfall',    trend: getTrend(weather.rain, weather.avgRain, false),       avg: `${weather.avgRain}mm`    },
              ].map(s => (
                <div className="stat-card" key={s.label}>
                  <span className="stat-icon">{s.icon}</span>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: s.trend.color, fontWeight: 700 }}>
                      {s.trend.symbol} {s.trend.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: '2px' }}>
                    30d avg: {s.avg}
                  </div>
                </div>
              ))}
            </div>

            {/* Pressure stat (full width) */}
            <div className="stat-card" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📊</span>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.1rem' }}>{weather.pressure} hPa</div>
                  <div className="stat-label">Surface Pressure</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {(() => {
                  const t = getTrend(weather.pressure, weather.avgPressure, true) // lower pressure = bad
                  return <span style={{ fontSize: '0.82rem', color: t.color, fontWeight: 700 }}>{t.symbol} {t.label} hPa vs 30d avg</span>
                })()}
                {weather.pressure < 1005 && (
                  <div style={{ fontSize: '0.72rem', color: '#f97316', marginTop: '2px' }}>
                    {weather.pressure < 970 ? '🔴 Extreme low — cyclonic risk' : weather.pressure < 990 ? '🟠 Very low — active system' : '🟡 Below normal'}
                  </div>
                )}
              </div>
            </div>

            {/* Severity + Disaster Type */}
            {severity && (
              <div className="severity-section">
                <div className="severity-header-row">
                  <div className="severity-label">Alert Severity</div>
                  <button
                    className="add-to-watchlist-btn"
                    onClick={addToWatchlist}
                    disabled={watchlist.includes(cityName)}
                  >
                    {watchlist.includes(cityName) ? '📍 Monitored' : '+ Monitor City'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span className={`severity-badge ${sevConfig.className}`}>
                    <span className="severity-emoji">{sevConfig.emoji}</span>
                    {severity}
                  </span>

                  {disasterType && disasterType !== 'No Threat' && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.45rem 0.9rem', borderRadius: '999px',
                      fontSize: '0.82rem', fontWeight: 700,
                      background: dConfig.bg, color: dConfig.color,
                      border: `1px solid ${dConfig.border}`,
                      letterSpacing: '0.02em',
                    }}>
                      {dConfig.emoji} {disasterType}
                    </span>
                  )}
                </div>

                {/* Heat Index pill */}
                {(() => {
                  const hi = calculateHeatIndex(weather.temp, weather.humidity)
                  return hi ? (
                    <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#f97316' }}>
                      🌡️ Apparent temperature (heat index): <strong>{hi}°C</strong>
                      {' '}— {hi - weather.temp >= 5 ? 'dangerously' : 'noticeably'} hotter than ambient
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: Alert Details Panel ─────────────────────── */}
      {showDetails && (
        <div className={`details-panel ${sevConfig.className}`}>
          <div className={`details-header ${sevConfig.className}`}>
            <span className="details-header-emoji">
              {disasterType && disasterType !== 'No Threat' ? dConfig.emoji : sevConfig.emoji}
            </span>
            <div>
              <h2 className="details-headline">
                {disasterType && disasterType !== 'No Threat' ? disasterType : `${severity} Alert`}
              </h2>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                <span className={`details-level-tag ${sevConfig.className}`}>{severity} Severity</span>
                {disasterType && disasterType !== 'No Threat' && (
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0.2rem 0.6rem', borderRadius: '999px', background: dConfig.bg, color: dConfig.color, border: `1px solid ${dConfig.border}` }}>
                    {disasterType}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="details-body">

            {/* ── Assessment (dynamic) ── */}
            <section className="details-section">
              <h3 className="section-title">Situational Assessment</h3>
              <p className="section-text">{assessment}</p>
            </section>

            <div className="section-divider"></div>

            {/* ── Compound Risk Score (unique feature) ── */}
            {compound && (
              <>
                <section className="details-section">
                  <h3 className="section-title">
                    Risk Fingerprint
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', fontWeight: 400, color: 'var(--color-text-dim)', textTransform: 'none', letterSpacing: 0 }}>
                      compound hazard score
                    </span>
                  </h3>

                  {/* Score bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: compoundBarColor, minWidth: '48px' }}>
                      {compound.score}<span style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)', fontWeight: 400 }}>/11</span>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(148,163,184,0.12)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${compound.pct}%`, background: `linear-gradient(90deg, ${compoundBarColor}99, ${compoundBarColor})`, borderRadius: '999px', transition: 'width 0.8s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: compoundBarColor, fontWeight: 700, minWidth: '32px' }}>{compound.pct}%</span>
                  </div>

                  {/* Per-parameter bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {compound.bars.map(b => (
                      <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 72px', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>{b.label}</span>
                        <div style={{ background: 'rgba(148,163,184,0.1)', borderRadius: '999px', height: '5px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${b.pct}%`, background: levelColors[b.level] || '#94a3b8', borderRadius: '999px', transition: 'width 0.6s ease' }}></div>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: levelColors[b.level], fontWeight: 600, textAlign: 'right' }}>{b.value}</span>
                      </div>
                    ))}
                  </div>

                  {compound.score >= 3 && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      ⚠️ {compound.score >= 6 ? 'Critical' : 'Multiple'} parameters elevated simultaneously — compound events carry disproportionately higher risk than any single factor in isolation.
                    </p>
                  )}
                </section>
                <div className="section-divider"></div>
              </>
            )}

            {/* ── Historical Context ── */}
            {reason && (
              <>
                <section className="details-section">
                  <h3 className="section-title">Historical Context (30-day)</h3>
                  <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderLeft: '3px solid var(--color-accent)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.6 }}>{reason}</p>
                  </div>
                </section>
                <div className="section-divider"></div>
              </>
            )}

            {/* ── Contributing Factors ── */}
            <section className="details-section">
              <h3 className="section-title">Contributing Factors</h3>
              <ul className="factor-list">
                {factors.map((r, i) => (
                  <li key={i} className="factor-item">
                    <span className="factor-icon">{r.icon}</span>
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="section-divider"></div>

            {/* ── Advisories (dynamic) ── */}
            <section className="details-section">
              <h3 className="section-title">Safety Advisories</h3>
              <ul className="advisory-list">
                {advisories.map((adv, i) => (
                  <li key={i} className="advisory-item">
                    <span className="advisory-bullet">›</span>
                    <span>{adv}</span>
                  </li>
                ))}
              </ul>
            </section>

          </div>
        </div>
      )}

      {/* ── Global Alerts ────────────────────────────────────── */}
      <div className="global-alerts-container">
        <div className="global-alerts-header">
          <div className="global-alerts-title-group">
            <h2 className="global-alerts-title">
              <span className="global-pulse-dot"></span>
              🌍 Global Alerts
            </h2>
            <p className="global-alerts-subtitle">
              Auto-scanning {GLOBAL_SCAN_CITIES.length} major cities
              {lastScanTime && <> · Updated {lastScanTime.toLocaleTimeString()}</>}
            </p>
          </div>
          {scanLoading && <div className="spinner-sm"></div>}
        </div>

        {scanLoading && globalAlerts.length === 0 && (
          <div className="scan-loading">
            <div className="spinner"></div>
            <span className="loading-text">Scanning global weather conditions...</span>
          </div>
        )}

        {!scanLoading && globalAlerts.length === 0 && (
          <div className="global-empty-state">
            <span className="empty-icon">✅</span>
            <p>No active alerts detected. All {GLOBAL_SCAN_CITIES.length} monitored cities are within safe parameters.</p>
          </div>
        )}

        {globalAlerts.length > 0 && (
          <div className="monitor-grid">
            {globalAlerts.map(alert => {
              const config = SEVERITY_CONFIG[alert.severity] || { emoji: '❓', className: '' }
              const dc     = DISASTER_CONFIG[alert.disasterType] || DISASTER_CONFIG['No Threat']
              return (
                <div
                  key={alert.name}
                  className={`monitor-card ${config.className}`}
                  onClick={() => { setCity(alert.name); fetchWeather() }}
                >
                  <div className="monitor-card-header">
                    <span className="monitor-city">{alert.name}</span>
                    <span className="monitor-country">{alert.country}</span>
                  </div>
                  <div className="monitor-card-body">
                    <div className="monitor-temp">{alert.temp}°C</div>
                    <div className={`monitor-badge ${config.className}`}>{config.emoji} {alert.severity}</div>
                  </div>
                  {alert.disasterType && alert.disasterType !== 'No Threat' && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: dc.bg, color: dc.color, border: `1px solid ${dc.border}` }}>
                        {dc.emoji} {alert.disasterType}
                      </span>
                    </div>
                  )}
                  <div className="monitor-card-footer">
                    <span>🌬️ {alert.wind}km/h</span>
                    <span>🌧️ {alert.rain}mm</span>
                    <span>📉 {alert.pressure}hPa</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── My Watchlist ─────────────────────────────────────── */}
      <div className="monitor-container">
        <div className="monitor-header">
          <div className="monitor-title-group">
            <h2 className="monitor-title">📍 My Watchlist</h2>
            <p className="monitor-subtitle">Your saved locations</p>
          </div>
        </div>

        {watchlist.length === 0 && (
          <div className="watchlist-empty-state">
            <span className="empty-icon">📍</span>
            <p>No cities added yet. Search for a city above and click <strong>"+ Monitor City"</strong> to add it here.</p>
          </div>
        )}

        {watchlist.length > 0 && (
          <div className="monitor-grid">
            {watchlist.map(name => {
              const data = monitorData[name]
              if (!data) return (
                <div key={name} className="monitor-card skeleton">
                  <div className="skeleton-line short"></div>
                  <div className="skeleton-line"></div>
                </div>
              )
              const config = SEVERITY_CONFIG[data.severity] || { emoji: '❓', className: '' }
              const dc     = DISASTER_CONFIG[data.disasterType] || DISASTER_CONFIG['No Threat']
              return (
                <div
                  key={name}
                  className={`monitor-card ${config.className}`}
                  onClick={() => { setCity(data.resolvedName || name); fetchWeather() }}
                >
                  <button className="remove-btn" onClick={e => removeFromWatchlist(e, name)}>×</button>
                  <div className="monitor-card-header">
                    <span className="monitor-city">{data.resolvedName}</span>
                    <span className="monitor-country">{data.country}</span>
                  </div>
                  <div className="monitor-card-body">
                    <div className="monitor-temp">{data.temp}°C</div>
                    <div className={`monitor-badge ${config.className}`}>{config.emoji} {data.severity}</div>
                  </div>
                  {data.disasterType && data.disasterType !== 'No Threat' && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: dc.bg, color: dc.color, border: `1px solid ${dc.border}` }}>
                        {dc.emoji} {data.disasterType}
                      </span>
                    </div>
                  )}
                  <div className="monitor-card-footer">
                    <span>🌬️ {data.wind}km/h</span>
                    <span>🌧️ {data.rain}mm</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}