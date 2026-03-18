import { useState, useEffect, useCallback } from 'react'
import { hybridPredict, classifyForecastDays, historicalAnomalyAnalysis } from '../lib/HybridMLEngine'
import CurrentConditions from './CurrentConditions'
import StormRiskLevel from './StormRiskLevel'
import ForecastStrip from './ForecastStrip'
import CalamityClassification from './CalamityClassification'
import WeatherCharts from './WeatherCharts'
import SeasonalContext from './SeasonalContext'

const BACKEND_URL = "https://meteorological-backend.onrender.com"

// ─── Season helpers ───────────────────────────────────────────────────────────

function getSeason(month, lat) {
  const NH = lat >= 0
  const nhMap = {
    1:  { name: 'Winter',       icon: '❄️',  color: '#93c5fd' },
    2:  { name: 'Winter',       icon: '❄️',  color: '#93c5fd' },
    3:  { name: 'Pre-Monsoon',  icon: '🌤️', color: '#fbbf24' },
    4:  { name: 'Pre-Monsoon',  icon: '🌤️', color: '#fbbf24' },
    5:  { name: 'Pre-Monsoon',  icon: '☀️',  color: '#fb923c' },
    6:  { name: 'Monsoon',      icon: '🌧️', color: '#22d3ee' },
    7:  { name: 'Monsoon',      icon: '🌧️', color: '#22d3ee' },
    8:  { name: 'Monsoon',      icon: '🌧️', color: '#22d3ee' },
    9:  { name: 'Monsoon',      icon: '🌦️', color: '#22d3ee' },
    10: { name: 'Post-Monsoon', icon: '🌥️', color: '#a78bfa' },
    11: { name: 'Post-Monsoon', icon: '🌥️', color: '#a78bfa' },
    12: { name: 'Winter',       icon: '❄️',  color: '#93c5fd' },
  }
  const shMonth = ((month - 1 + 6) % 12) + 1
  return NH ? nhMap[month] : nhMap[shMonth]
}

// ─── Seasonal archive fetch ───────────────────────────────────────────────────

function monthName(m) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]
}

async function fetchSeasonalNormals(lat, lon, month, latForSeason) {
  const years = [2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024]
  const allTemp = [], allWind = [], allRain = [], allHum = []

  await Promise.all(years.map(async y => {
    const daysInMonth = new Date(y, month, 0).getDate()
    const start = `${y}-${String(month).padStart(2, '0')}-01`
    const end = `${y}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
    try {
      const res = await fetch(
        `https://archive-api.open-meteo.com/v1/archive` +
        `?latitude=${lat}&longitude=${lon}` +
        `&start_date=${start}&end_date=${end}` +
        `&daily=temperature_2m_mean,wind_speed_10m_max,precipitation_sum,relative_humidity_2m_mean`
      )
      const d = await res.json()
      if (!d.daily) return
      ;(d.daily.temperature_2m_mean || []).forEach(v => v != null && allTemp.push(v))
      ;(d.daily.wind_speed_10m_max || []).forEach(v => v != null && allWind.push(v))
      ;(d.daily.precipitation_sum || []).forEach(v => v != null && allRain.push(v))
      ;(d.daily.relative_humidity_2m_mean || []).forEach(v => v != null && allHum.push(v))
    } catch (_) {}
  }))

  function stats(arr) {
    if (!arr.length) return { mean: null, std: null, min: null, max: null, count: 0 }
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length)
    return {
      mean: Math.round(mean * 10) / 10,
      std: Math.round(std * 10) / 10,
      min: Math.round(Math.min(...arr) * 10) / 10,
      max: Math.round(Math.max(...arr) * 10) / 10,
      count: arr.length,
    }
  }

  return {
    temp: stats(allTemp),
    wind: stats(allWind),
    rain: stats(allRain),
    humidity: stats(allHum),
    month,
    season: getSeason(month, latForSeason),
    years,
  }
}

// ─── Seasonal severity adjustment ─────────────────────────────────────────────

function seasonalSeverity(current, normals, baseSeverity, primaryEvent = '') {
  if (!normals) return { severity: baseSeverity, anomalies: [], overridden: false }

  const order = ['Low', 'Moderate', 'High', 'Extreme']
  const { anomalies, riskAdjustment } = historicalAnomalyAnalysis(current, normals)

  let finalSev = baseSeverity
  let overridden = false

  const hasExtreme = anomalies.some(a => a.level === 'extreme' && a.isBad)
  const hasHigh = anomalies.some(a => a.level === 'high' && a.isBad)

  if (hasExtreme && order.indexOf(baseSeverity) < order.indexOf('High')) {
    finalSev = 'High'; overridden = true
  }
  if (hasHigh && order.indexOf(baseSeverity) < order.indexOf('Moderate')) {
    finalSev = 'Moderate'; overridden = true
  }

  // Downgrade only when conditions are truly seasonal-normal.
  // GUARD: never downgrade when primary event is temperature-driven
  // or when temp is already in a danger zone (cold wave / heatwave range)
  const tempDrivenEvents = ['Cold Wave', 'Heatwave', 'Heat Stress', 'Cold Stress']
  const isTempDriven = tempDrivenEvents.some(e => primaryEvent.includes(e.split(' ')[0]))
  const tempInDangerZone = current.temp > 38 || current.temp < 5

  const shouldDowngrade =
    !anomalies.filter(a => a.isBad).length &&
    baseSeverity !== 'Low' &&
    current.rain < (normals.rain.mean ?? 0) * 1.5 &&
    !isTempDriven &&
    !tempInDangerZone

  if (shouldDowngrade) {
    const idx = order.indexOf(baseSeverity)
    if (idx > 0) { finalSev = order[idx - 1]; overridden = true }
  }

  // Convert anomalies to display format
  const displayAnomalies = anomalies.filter(a => a.isBad).map(a => ({
    param: a.param,
    z: a.z,
    msg: a.msg,
    level: { level: a.level, color: a.color },
  }))

  return { severity: finalSev, anomalies: displayAnomalies, overridden }
}

// ─── Global scan cities ───────────────────────────────────────────────────────

const CITIES = [
  { name: 'Mumbai', country: 'India', lat: 19.08, lon: 72.88 },
  { name: 'Delhi', country: 'India', lat: 28.61, lon: 77.21 },
  { name: 'Chennai', country: 'India', lat: 13.08, lon: 80.27 },
  { name: 'Kolkata', country: 'India', lat: 22.57, lon: 88.36 },
  { name: 'Dhaka', country: 'Bangladesh', lat: 23.81, lon: 90.41 },
  { name: 'Tokyo', country: 'Japan', lat: 35.68, lon: 139.69 },
  { name: 'Manila', country: 'Philippines', lat: 14.60, lon: 120.98 },
  { name: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.82, lon: 106.63 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.75, lon: 100.52 },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.21, lon: 106.85 },
  { name: 'Shanghai', country: 'China', lat: 31.23, lon: 121.47 },
  { name: 'Beijing', country: 'China', lat: 39.90, lon: 116.40 },
  { name: 'Hong Kong', country: 'China', lat: 22.32, lon: 114.17 },
  { name: 'Seoul', country: 'South Korea', lat: 37.57, lon: 126.98 },
  { name: 'London', country: 'UK', lat: 51.51, lon: -0.13 },
  { name: 'Miami', country: 'USA', lat: 25.76, lon: -80.19 },
  { name: 'Houston', country: 'USA', lat: 29.76, lon: -95.37 },
  { name: 'New York', country: 'USA', lat: 40.71, lon: -74.01 },
  { name: 'Mexico City', country: 'Mexico', lat: 19.43, lon: -99.13 },
  { name: 'Sao Paulo', country: 'Brazil', lat: -23.55, lon: -46.63 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.52, lon: 3.38 },
  { name: 'Cairo', country: 'Egypt', lat: 30.04, lon: 31.24 },
  { name: 'Sydney', country: 'Australia', lat: -33.87, lon: 151.21 },
  { name: 'Dubai', country: 'UAE', lat: 25.20, lon: 55.27 },
  { name: 'Karachi', country: 'Pakistan', lat: 24.86, lon: 67.01 },
  { name: 'Colombo', country: 'Sri Lanka', lat: 6.93, lon: 79.84 },
  { name: 'Yangon', country: 'Myanmar', lat: 16.87, lon: 96.20 },
  { name: 'Havana', country: 'Cuba', lat: 23.11, lon: -82.37 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.29, lon: 36.82 },
  { name: 'Taipei', country: 'Taiwan', lat: 25.03, lon: 121.57 },
]

const SEV_STYLE = {
  Low:      { emoji: '✅', cls: 'low',      color: '#4ade80' },
  Moderate: { emoji: '⚠️', cls: 'moderate', color: '#fbbf24' },
  High:     { emoji: '🔶', cls: 'high',     color: '#fb923c' },
  Extreme:  { emoji: '🔴', cls: 'extreme',  color: '#f87171' },
}

const DIS_STYLE = {
  'Cyclone Watch':     { emoji: '🌀', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', bdr: 'rgba(129,140,248,0.3)' },
  'Storm Surge':       { emoji: '🌊', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  bdr: 'rgba(34,211,238,0.3)' },
  'Flood Risk':        { emoji: '💧', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  bdr: 'rgba(34,211,238,0.3)' },
  'Heat Stress':       { emoji: '🔥', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  bdr: 'rgba(251,146,60,0.3)' },
  'Heatwave':          { emoji: '☀️', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  bdr: 'rgba(251,146,60,0.3)' },
  'Cold Stress':       { emoji: '❄️', color: '#93c5fd', bg: 'rgba(147,197,253,0.12)', bdr: 'rgba(147,197,253,0.3)' },
  'Cold Wave':         { emoji: '🥶', color: '#93c5fd', bg: 'rgba(147,197,253,0.12)', bdr: 'rgba(147,197,253,0.3)' },
  'Thunderstorm Risk': { emoji: '⛈️', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', bdr: 'rgba(167,139,250,0.3)' },
  'Compound Risk':     { emoji: '⚡', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  bdr: 'rgba(251,191,36,0.3)' },
  'Tropical Storm':    { emoji: '🌀', color: '#818cf8', bg: 'rgba(129,140,248,0.12)', bdr: 'rgba(129,140,248,0.3)' },
  'Hailstorm Risk':    { emoji: '🧊', color: '#93c5fd', bg: 'rgba(147,197,253,0.12)', bdr: 'rgba(147,197,253,0.3)' },
  'Heavy Rainfall':    { emoji: '🌧️', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  bdr: 'rgba(34,211,238,0.3)' },
  'Extreme Wind':      { emoji: '🌪️', color: '#f87171', bg: 'rgba(248,113,113,0.12)', bdr: 'rgba(248,113,113,0.3)' },
  'No Threat':         { emoji: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  bdr: 'rgba(74,222,128,0.3)' },
}

// ─── Safety advisories generator ──────────────────────────────────────────────

function dynAdvisories(w, sev, dtype) {
  if (sev === 'Low') return ['No special precautions required — conditions within seasonal normal ranges', 'Continue monitoring weather forecast updates', 'Outdoor activities may proceed normally']
  const a = []
  if (dtype === 'Cyclone Watch' || dtype === 'Storm Surge') { a.push('Move to designated shelter or higher ground immediately'); a.push('Comply with all official evacuation orders') }
  if (dtype === 'Flood Risk' || w.rain > 100) { a.push(`Avoid all low-lying areas — ${w.rain}mm can cause flash flooding`); a.push('Do not cross flooded roads or waterways') }
  if (dtype === 'Heatwave' || dtype === 'Heat Stress' || w.temp >= 38) { a.push(`Stay hydrated — drink water every 20 min`); a.push('Avoid outdoor activity between 11 AM – 4 PM') }
  if (dtype === 'Cold Wave' || dtype === 'Cold Stress' || w.temp <= 0) { a.push(`Wear 3+ insulating layers — wind chill at ${w.wind}km/h increases frostbite risk`) }
  if (dtype === 'Thunderstorm Risk' || dtype === 'Hailstorm Risk') { a.push('Stay indoors; avoid open fields, tall trees, and elevated terrain') }
  if (w.wind > 60) a.push(`Secure all loose outdoor objects — ${w.wind}km/h winds can propel debris`)
  if (w.pressure < 990) a.push(`Pressure at ${w.pressure}hPa — monitor weather bulletins frequently`)
  if (sev === 'High' || sev === 'Extreme') a.push('Prepare emergency kit: 3-day water supply, first-aid, torch, power bank')
  if (sev === 'Extreme') a.push('Contact emergency services if in danger')
  return a.length ? a : ['Monitor official weather forecasts and local emergency notifications']
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function WeatherDashboard() {
  const [city, setCity]                     = useState('')
  const [weather, setWeather]               = useState(null)
  const [severity, setSeverity]             = useState('')
  const [reason, setReason]                 = useState('')
  const [disasterType, setDisasterType]     = useState('')
  const [cityName, setCityName]             = useState('')
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')
  const [forecastHrs, setForecastHrs]       = useState([])
  const [dailyForecast, setDailyForecast]   = useState([])
  const [prediction, setPrediction]         = useState(null)
  const [seasonalNormals, setSeasonalNormals] = useState(null)
  const [seasonalResult, setSeasonalResult] = useState(null)
  const [seasonalLoading, setSeasonalLoading] = useState(false)
  const [globalAlerts, setGlobalAlerts]     = useState([])
  const [scanLoading, setScanLoading]       = useState(false)
  const [lastScan, setLastScan]             = useState(null)

  // ─── Global scan ────────────────────────────────────────────────────────────

  const runScan = useCallback(async () => {
    setScanLoading(true)
    const alerts = []
    for (const loc of CITIES) {
      try {
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,pressure_msl,rain`)
        const wd = await wRes.json()
        const c = wd.current
        if (!c) continue
        const w = {
          temp: c.temperature_2m ?? 0,
          wind: c.wind_speed_10m ?? 0,
          rain: c.rain ?? 0,
          humidity: c.relative_humidity_2m ?? 50,
          pressure: c.pressure_msl ?? 1013,
        }
        // Use hybrid ML engine instead of backend for global scan
        const result = hybridPredict(w)
        if (result.severity !== 'Low') {
          alerts.push({ name: loc.name, country: loc.country, ...w, severity: result.severity, disasterType: result.primaryEvent, probability: result.overallProbability })
        }
      } catch (_) {}
    }
    const ord = { Extreme: 0, High: 1, Moderate: 2 }
    alerts.sort((a, b) => (ord[a.severity] ?? 3) - (ord[b.severity] ?? 3))
    setGlobalAlerts(alerts)
    setLastScan(new Date())
    setScanLoading(false)
  }, [])

  useEffect(() => {
    runScan()
    const iv = setInterval(runScan, 10 * 60 * 1000)
    return () => clearInterval(iv)
  }, [runScan])

  // ─── Build URL for /classifyML endpoint ──────────────────────────────────────
  // Sends raw weather params + all ML probabilities to Haskell
  // Haskell validates ML output against IMD physical ranges
  function buildClassifyMLUrl(weather, mlPrediction) {
    const ep = mlPrediction.eventProbabilities || {}
    const params = new URLSearchParams({
      // Raw weather
      temp:     weather.temp,
      rain:     weather.rain,
      wind:     weather.wind,
      humidity: weather.humidity,
      pressure: weather.pressure,
      // ML probabilities per event type
      ml_thunderstorm:   ep['Thunderstorm']   ?? 0,
      ml_cyclone:        ep['Cyclone']        ?? 0,
      ml_tropical_storm: ep['Tropical Storm'] ?? 0,
      ml_hailstorm:      ep['Hailstorm']      ?? 0,
      ml_flood_risk:     ep['Flood Risk']     ?? 0,
      ml_heatwave:       ep['Heatwave']       ?? 0,
      ml_heavy_rainfall: ep['Heavy Rainfall'] ?? 0,
      ml_extreme_wind:   ep['Extreme Wind']   ?? 0,
      ml_cold_wave:      ep['Cold Wave']      ?? 0,
      ml_overall:        mlPrediction.overallProbability ?? 0,
    })
    return `${BACKEND_URL}/classifyML?${params.toString()}`
  }

  // ─── Main fetch ─────────────────────────────────────────────────────────────

  async function fetchWeather() {
    const q = city.trim()
    if (!q) { setError('Please enter a city name.'); return }
    setLoading(true); setError('')
    setWeather(null); setSeverity(''); setReason(''); setDisasterType('')
    setForecastHrs([]); setDailyForecast([]); setPrediction(null)
    setSeasonalNormals(null); setSeasonalResult(null)

    try {
      // Geocode
      const gr = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`)
      if (!gr.ok) throw new Error('Geocoding service unavailable.')
      const gd = await gr.json()
      if (!gd.results?.length) throw new Error(`City "${q}" not found. Please check the spelling.`)

      const { latitude: lat, longitude: lon, name: rn, country } = gd.results[0]
      setCityName(`${rn}, ${country || ''}`.trim())

      // Fetch weather data
      const wr = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m,pressure_msl,rain` +
        `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m,pressure_msl,rain` +
        `&past_days=30&forecast_days=7`
      )
      if (!wr.ok) throw new Error('Weather data unavailable.')
      const wd = await wr.json()
      const cur = wd.current
      if (!cur) throw new Error('Current conditions unavailable.')

      const temp = cur.temperature_2m ?? 0, wind = cur.wind_speed_10m ?? 0, windDir = cur.wind_direction_10m ?? 0
      const humidity = cur.relative_humidity_2m ?? 50, pressure = cur.pressure_msl ?? 1013

      // Extract future forecast hours to calculate 24h accumulated rain
      const now = new Date()
      const future = (wd.hourly?.time || []).map((t, i) => ({
        time: t, wind: wd.hourly.wind_speed_10m[i] ?? 0, windDir: wd.hourly.wind_direction_10m[i] ?? 0,
        pressure: wd.hourly.pressure_msl[i] ?? 1013, rain: wd.hourly.rain[i] ?? 0,
        temp: wd.hourly.temperature_2m[i] ?? 0, humidity: wd.hourly.relative_humidity_2m[i] ?? 50,
      })).filter(h => new Date(h.time) >= now).slice(0, 168) // 7 days

      // Rain for display and ML: use accumulated rainfall over the next 24 hours
      // (as ML thresholds are based on daily accumulation, not instantaneous hourly rates)
      const rain = parseFloat((future.slice(0, 24).reduce((s, h) => s + h.rain, 0)).toFixed(1))

      setForecastHrs(future)

      // Calculate 30-day averages
      let avgTemp = 0, avgWind = 0, avgHumidity = 50, avgPressure = 1013, avgRain = 0
      if (wd.hourly?.time) {
        const h = wd.hourly
        const pastEnd = h.time.findIndex(t => new Date(t) >= now)
        const end = pastEnd > 0 ? pastEnd : h.time.length
        const sl = k => (h[k] || []).slice(0, end), sum = a => a.reduce((x, y) => x + (y || 0), 0)
        if (end > 0) {
          avgTemp = parseFloat((sum(sl('temperature_2m')) / end).toFixed(1))
          avgWind = parseFloat((sum(sl('wind_speed_10m')) / end).toFixed(1))
          avgHumidity = Math.round(sum(sl('relative_humidity_2m')) / end)
          avgPressure = Math.round(sum(sl('pressure_msl')) / end)
          avgRain = parseFloat((sum(sl('rain')) / (end / 24 || 1)).toFixed(1))
        }
      }

      const weatherData = { temp, wind, windDir, humidity, pressure, rain, avgTemp, avgWind, avgHumidity, avgPressure, avgRain }
      setWeather(weatherData)

      // ── Run Hybrid ML Engine ──
      const mlPrediction = hybridPredict(weatherData, future)
      setPrediction(mlPrediction)

      // Classify 7-day forecast using hybrid ML
      const dailyResults = classifyForecastDays(future)
      setDailyForecast(dailyResults)

      // Set primary results
      setSeverity(mlPrediction.severity)
      setDisasterType(mlPrediction.primaryEvent)

      // Call /classifyML — sends ML probabilities TO Haskell for validation
      // Haskell checks ML output against IMD physical ranges and returns
      // a validated final classification. Falls back to old endpoint if unavailable.
      try {
        const mlUrl = buildClassifyMLUrl(weatherData, mlPrediction)
        const cr = await fetch(mlUrl)
        if (cr.ok) {
          const cd = await cr.json()
          setReason(cd.reason || '')
          // Haskell is now the final authority on severity
          // It has already validated against both IMD ranges AND ML probabilities
          if (cd.severity) {
            setSeverity(cd.severity)
          }
          // Update disaster type if Haskell detected something different
          if (cd.disasterType && cd.disasterType !== 'No Threat') {
            setDisasterType(cd.disasterType)
          }
        } else {
          // /classifyML failed — fall back to old classifyWithHistory
          const fallbackUrl = `${BACKEND_URL}/classifyWithHistory?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}&avg_temp=${avgTemp}&avg_rain=${avgRain}&avg_wind=${avgWind}&avg_humidity=${avgHumidity}&avg_pressure=${avgPressure}`
          const fb = await fetch(fallbackUrl)
          if (fb.ok) {
            const fd = await fb.json()
            setReason(fd.reason || '')
            if (fd.probability && fd.probability > mlPrediction.overallProbability) {
              setSeverity(fd.severity || mlPrediction.severity)
            }
          }
        }
      } catch (_) {
        setReason('Backend classification unavailable — using client-side ML engine.')
      }

      // Seasonal context (async, non-blocking)
      const currentMonth = new Date().getMonth() + 1
      setSeasonalLoading(true)
      fetchSeasonalNormals(lat, lon, currentMonth, lat)
        .then(normals => {
          setSeasonalNormals(normals)
          const result = seasonalSeverity(weatherData, normals, mlPrediction.severity, mlPrediction.primaryEvent)
          setSeasonalResult(result)
          if (result.overridden) setSeverity(result.severity)
          // Re-run forecast with seasonal normals
          const updatedDaily = classifyForecastDays(future, normals)
          setDailyForecast(updatedDaily)
        })
        .catch(() => {})
        .finally(() => setSeasonalLoading(false))

    } catch (err) { setError(err.message || 'An unexpected error occurred.') }
    finally { setLoading(false) }
  }

  const onKey = e => { if (e.key === 'Enter') fetchWeather() }
  const hasResults = weather && !loading && severity

  return (
    <div>
      {/* ════ HERO ════════════════════════════════════════════════════════════ */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="eyebrow-dot"></span>
          Hybrid ML Engine · 5 Models · 9 Event Types · Real-Time Analysis
        </div>
        <h1 className="hero-title">
          Storm & Climate<br />
          <span className="hero-title-accent">Risk Prediction</span><br />
          System
        </h1>
        <p className="hero-sub">
          Powered by a hybrid ML engine combining Logistic Regression, Random Forest,
          Gradient Boosting, Time-Series Analysis, and Historical Baseline detection.
        </p>
        <div className="hero-search">
          <div className="search-wrap">
            <span className="search-ico">🔍</span>
            <input className="search-input" type="text" placeholder="Search any city worldwide..." value={city} onChange={e => setCity(e.target.value)} onKeyDown={onKey} disabled={loading} id="city-search" />
            <button className="search-btn" onClick={fetchWeather} disabled={loading} id="analyze-btn">
              {loading ? <span className="btn-spin"></span> : 'Analyze'}
            </button>
          </div>
        </div>
        <div className="hero-stats">
          {[{ n: '5', l: 'ML Models' }, { n: '9', l: 'Event Types' }, { n: '7-Day', l: 'Forecast' }, { n: '30', l: 'Cities Monitored' }].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              {i > 0 && <div className="hstat-div"></div>}
              <div className="hstat"><div className="hstat-n">{s.n}</div><div className="hstat-l">{s.l}</div></div>
            </div>
          ))}
        </div>
        <div className="scroll-hint"><span>▼</span><span>Scroll down</span></div>
      </section>

      {/* ════ MAIN ═══════════════════════════════════════════════════════════ */}
      <div className="main">
        {error && <div className="err-banner"><span>⚠️</span><span>{error}</span></div>}
        {loading && <div className="loading-center"><div className="spinner-lg"></div><span className="loading-lbl">Fetching data & running Hybrid ML classification...</span></div>}

        {hasResults && (
          <>
            {/* Section 1 & 2: Current Conditions + Storm Risk Level */}
            <div className="results-row">
              <CurrentConditions weather={weather} cityName={cityName} />
              <StormRiskLevel severity={severity} disasterType={disasterType} prediction={prediction} weather={weather} reason={reason} />
            </div>

            {/* Section 3: 7-Day Risk Forecast */}
            <ForecastStrip dailyForecast={dailyForecast} />

            {/* Section 4: Detailed Calamity Classification */}
            <CalamityClassification prediction={prediction} dailyForecast={dailyForecast} />

            {/* Storm approach / trend alerts */}
            {prediction?.trends?.alerts?.length > 0 && (
              <div className="storm-section">
                <h2 className="section-heading"><span className="pdot pdot-orange"></span>⚡ Incoming Threat Analysis — Time-Series Detection</h2>
                <div className="storm-grid">
                  {prediction.trends.alerts.map((a, i) => {
                    const s2 = SEV_STYLE[a.severity] || SEV_STYLE['Moderate']
                    return (
                      <div key={i} className="storm-card" style={{ borderLeftColor: s2.color }}>
                        <div className="storm-card-top">
                          <span className="storm-icon">{a.icon}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge badge-sm" style={{ background: `${s2.color}18`, color: s2.color, border: `1px solid ${s2.color}45` }}>{a.severity}</span>
                            {a.timeframe && <span style={{ fontSize: '0.68rem', color: 'var(--dim)' }}>{a.timeframe}</span>}
                          </div>
                        </div>
                        <p className="storm-msg">{a.msg}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Charts */}
            <WeatherCharts forecastHrs={forecastHrs} weather={weather} />

            {/* Seasonal Context */}
            <SeasonalContext normals={seasonalNormals} current={weather} seasonalResult={seasonalResult} loading={seasonalLoading} />

            {/* Safety Advisories */}
            <div className="card" id="safety-advisories">
              <div className="card-title">📋 Safety Advisories</div>
              <div className="card-sub">Automated recommendations based on current conditions and ML prediction</div>
              <ul className="advisory-list">
                {dynAdvisories(weather, severity, disasterType).map((adv, i) => (
                  <li key={i} className="advisory-item">
                    <span className="adv-bullet">›</span>
                    <span>{adv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Global alerts */}
        <div id="global-alerts">
          <div className="section-hdr-row">
            <div>
              <h2 className="section-heading"><span className="pdot pdot-cyan"></span>🌍 Global Alerts</h2>
              <p className="section-sub">Auto-scanning {CITIES.length} cities via Hybrid ML Engine{lastScan && <> · Updated {lastScan.toLocaleTimeString()}</>}</p>
            </div>
            {scanLoading && <div className="spinner-sm"></div>}
          </div>
          {scanLoading && !globalAlerts.length && <div className="scan-center"><div className="spinner-lg"></div><span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>Scanning...</span></div>}
          {!scanLoading && !globalAlerts.length && <div className="empty-box"><span className="empty-ico">✅</span><p>All {CITIES.length} monitored cities within safe parameters.</p></div>}
          {globalAlerts.length > 0 && (
            <div className="monitor-grid">
              {globalAlerts.map(a => {
                const s2 = SEV_STYLE[a.severity] || { emoji: '❓', cls: '' }
                const d2 = DIS_STYLE[a.disasterType] || DIS_STYLE['No Threat']
                return (
                  <div key={a.name} className={`monitor-card ${s2.cls}`} onClick={() => { setCity(a.name); }}>
                    <div className="monitor-card-header"><span className="monitor-city">{a.name}</span><span className="monitor-country">{a.country}</span></div>
                    <div className="monitor-card-body">
                      <div className="monitor-temp">{a.temp}°C</div>
                      <div className={`monitor-badge ${s2.cls}`}>{s2.emoji} {a.severity}</div>
                    </div>
                    {a.disasterType && a.disasterType !== 'No Threat' && (
                      <div style={{ marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.67rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: d2.bg, color: d2.color, border: `1px solid ${d2.bdr}` }}>
                          {d2.emoji} {a.disasterType}
                        </span>
                      </div>
                    )}
                    <div className="monitor-card-footer">
                      <span>🌬️{a.wind}km/h</span><span>🌧️{a.rain}mm</span><span>📉{a.pressure}hPa</span>
                      {a.probability > 0 && <span style={{ color: s2.color, fontWeight: 700 }}>{a.probability}%</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
