import { useState, useEffect, useCallback } from 'react'

const BACKEND_URL = "https://meteorological-backend.onrender.com"

const SEVERITY_CONFIG = {
  Low:      { emoji: '✅', className: 'low' },
  Moderate: { emoji: '⚠️', className: 'moderate' },
  High:     { emoji: '🔶', className: 'high' },
  Extreme:  { emoji: '🔴', className: 'extreme' },
}

const SEVERITY_DETAILS = {
  Low: {
    headline: 'No active threats detected',
    summary: 'Current atmospheric conditions are within safe and comfortable ranges across all monitored parameters. No weather-related disruptions are anticipated.',
    advisories: [
      'No special precautions required',
      'Outdoor activities may proceed as planned',
      'Continue monitoring periodic forecast updates',
    ],
  },
  Moderate: {
    headline: 'Elevated conditions — stay informed',
    summary: 'One or more weather parameters have exceeded baseline thresholds. While not immediately hazardous, conditions may deteriorate and should be monitored closely.',
    advisories: [
      'Monitor official weather advisories at regular intervals',
      'Limit prolonged exposure to extreme temperatures',
      'Secure loose outdoor items and equipment',
      'Carry appropriate weather gear when travelling',
    ],
  },
  High: {
    headline: 'Severe weather — exercise caution',
    summary: 'Multiple weather parameters are at hazardous levels. Significant risk of property damage, travel disruption, and personal injury exists.',
    advisories: [
      'Restrict outdoor activities to essential travel only',
      'Secure property — close all windows, move vehicles to sheltered areas',
      'Prepare emergency supplies: water, flashlight, first-aid kit, charged phone',
      'Monitor local emergency broadcast channels',
      'Postpone non-essential travel until conditions improve',
    ],
  },
  Extreme: {
    headline: 'Critical threat — take immediate action',
    summary: 'Life-threatening weather conditions are present or imminent. Multiple parameters are at dangerous extremes. Immediate protective measures are essential.',
    advisories: [
      'Seek shelter immediately — do not venture outdoors',
      'Comply with all official evacuation orders',
      'Contact emergency services if in immediate danger',
      'Avoid windows, low-lying areas, and flood-prone zones',
      'Maintain charged communication devices at all times',
      'Assist vulnerable individuals: elderly, children, persons with disabilities',
    ],
  },
}

// ~30 major global cities with pre-set coordinates (avoids geocoding calls)
const GLOBAL_SCAN_CITIES = [
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
  { name: 'Taipei', country: 'Taiwan', lat: 25.03, lon: 121.57 },
  { name: 'Seoul', country: 'South Korea', lat: 37.57, lon: 126.98 },
  { name: 'London', country: 'UK', lat: 51.51, lon: -0.13 },
  { name: 'Miami', country: 'USA', lat: 25.76, lon: -80.19 },
  { name: 'Houston', country: 'USA', lat: 29.76, lon: -95.37 },
  { name: 'New York', country: 'USA', lat: 40.71, lon: -74.01 },
  { name: 'Mexico City', country: 'Mexico', lat: 19.43, lon: -99.13 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.55, lon: -46.63 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.52, lon: 3.38 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.29, lon: 36.82 },
  { name: 'Cairo', country: 'Egypt', lat: 30.04, lon: 31.24 },
  { name: 'Sydney', country: 'Australia', lat: -33.87, lon: 151.21 },
  { name: 'Dubai', country: 'UAE', lat: 25.20, lon: 55.27 },
  { name: 'Karachi', country: 'Pakistan', lat: 24.86, lon: 67.01 },
  { name: 'Colombo', country: 'Sri Lanka', lat: 6.93, lon: 79.84 },
  { name: 'Yangon', country: 'Myanmar', lat: 16.87, lon: 96.20 },
  { name: 'Havana', country: 'Cuba', lat: 23.11, lon: -82.37 },
]

function getAlertReasons(weather) {
  const reasons = []

  if (weather.rain > 200)
    reasons.push({ icon: '🌧️', text: `Rainfall: ${weather.rain} mm — exceeds 200 mm severe threshold` })
  else if (weather.rain > 100)
    reasons.push({ icon: '🌧️', text: `Rainfall: ${weather.rain} mm — exceeds 100 mm heavy threshold` })
  else if (weather.rain > 50)
    reasons.push({ icon: '🌧️', text: `Rainfall: ${weather.rain} mm — exceeds 50 mm elevated threshold` })

  if (weather.wind > 120)
    reasons.push({ icon: '🌪️', text: `Wind: ${weather.wind} km/h — hurricane-force (>120 km/h)` })
  else if (weather.wind > 80)
    reasons.push({ icon: '💨', text: `Wind: ${weather.wind} km/h — storm-force (>80 km/h)` })
  else if (weather.wind > 50)
    reasons.push({ icon: '💨', text: `Wind: ${weather.wind} km/h — elevated (>50 km/h)` })

  if (weather.temp > 45)
    reasons.push({ icon: '🔥', text: `Temperature: ${weather.temp}°C — extreme heat (>45°C)` })
  else if (weather.temp > 40)
    reasons.push({ icon: '☀️', text: `Temperature: ${weather.temp}°C — severe heat (>40°C)` })
  else if (weather.temp < -10)
    reasons.push({ icon: '🥶', text: `Temperature: ${weather.temp}°C — extreme cold (<-10°C)` })
  else if (weather.temp < 0)
    reasons.push({ icon: '❄️', text: `Temperature: ${weather.temp}°C — below freezing (<0°C)` })

  if (weather.pressure < 970)
    reasons.push({ icon: '📉', text: `Pressure: ${weather.pressure} hPa — severe low (<970 hPa)` })
  else if (weather.pressure < 990)
    reasons.push({ icon: '📉', text: `Pressure: ${weather.pressure} hPa — low (<990 hPa)` })

  if (weather.humidity > 90 && weather.temp > 35)
    reasons.push({ icon: '🥵', text: `Heat index: ${weather.humidity}% humidity at ${weather.temp}°C — dangerous combination` })

  if (reasons.length === 0)
    reasons.push({ icon: '✅', text: 'All parameters within normal operating ranges' })

  return reasons
}

export default function WeatherDashboard() {
  const [city, setCity] = useState('')
  const [weather, setWeather] = useState(null)
  const [severity, setSeverity] = useState('')
  const [reason, setReason] = useState('')
  const [cityName, setCityName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // User watchlist — starts empty
  const [watchlist, setWatchlist] = useState([])
  const [monitorData, setMonitorData] = useState({})

  // Global alert scanner
  const [globalAlerts, setGlobalAlerts] = useState([])
  const [scanLoading, setScanLoading] = useState(false)
  const [lastScanTime, setLastScanTime] = useState(null)

  // ─── Global Alert Scanner ───
  const runGlobalScan = useCallback(async () => {
    setScanLoading(true)
    const alerts = []

    for (const loc of GLOBAL_SCAN_CITIES) {
      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,surface_pressure,rain`
        )
        const weatherData = await weatherRes.json()
        const current = weatherData.current
        if (!current) continue

        const temp = current.temperature_2m ?? 0
        const wind = current.wind_speed_10m ?? 0
        const rain = current.rain ?? 0
        const humidity = current.relative_humidity_2m ?? 50
        const pressure = current.surface_pressure ?? 1013

        const classifyRes = await fetch(
          `${BACKEND_URL}/classify?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}`
        )
        const classifyData = await classifyRes.json()
        const sev = classifyData.severity || 'Low'

        // Only keep Moderate, High, or Extreme
        if (sev !== 'Low') {
          alerts.push({
            name: loc.name,
            country: loc.country,
            temp, wind, rain, humidity, pressure,
            severity: sev,
          })
        }
      } catch (e) {
        console.error(`Global scan failed for ${loc.name}:`, e)
      }
    }

    // Sort: Extreme first, then High, then Moderate
    const order = { Extreme: 0, High: 1, Moderate: 2 }
    alerts.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))

    setGlobalAlerts(alerts)
    setLastScanTime(new Date())
    setScanLoading(false)
  }, [])

  // Run on mount + every 10 minutes
  useEffect(() => {
    runGlobalScan()
    const interval = setInterval(runGlobalScan, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [runGlobalScan])

  // ─── User Watchlist ───
  const addToWatchlist = () => {
    if (cityName && !watchlist.includes(cityName)) {
      setWatchlist(prev => [...prev, cityName])
      if (weather && severity) {
        setMonitorData(prev => ({
          ...prev,
          [cityName]: {
            temp: weather.temp,
            wind: weather.wind,
            rain: weather.rain,
            humidity: weather.humidity,
            pressure: weather.pressure,
            severity,
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
    setMonitorData(prev => {
      const copy = { ...prev }
      delete copy[name]
      return copy
    })
  }

  async function fetchMonitorForCity(name) {
    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`)
      const geoData = await geoRes.json()
      if (geoData.results?.[0]) {
        const { latitude: lat, longitude: lon, country } = geoData.results[0]
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,surface_pressure,rain`)
        const weatherData = await weatherRes.json()
        const current = weatherData.current
        if (current) {
          const temp = current.temperature_2m ?? 0
          const wind = current.wind_speed_10m ?? 0
          const rain = current.rain ?? 0
          const humidity = current.relative_humidity_2m ?? 50
          const pressure = current.surface_pressure ?? 1013
          const classifyRes = await fetch(`${BACKEND_URL}/classify?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}`)
          const classifyData = await classifyRes.json()

          setMonitorData(prev => ({
            ...prev,
            [name]: {
              temp, wind, rain, humidity, pressure,
              severity: classifyData.severity || 'Low',
              country: country || '',
              resolvedName: geoData.results[0].name
            }
          }))
        }
      }
    } catch (e) {
      console.error(`Failed to fetch monitor data for ${name}:`, e)
    }
  }

  // ─── Search ───
  async function fetchWeather() {
    const trimmed = city.trim()
    if (!trimmed) {
      setError('Please enter a city name.')
      return
    }

    setLoading(true)
    setError('')
    setWeather(null)
    setSeverity('')
    setReason('')

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1`
      )
      if (!geoRes.ok) throw new Error('Failed to reach the geocoding service.')
      const geoData = await geoRes.json()

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`City "${trimmed}" not found. Please check the spelling.`)
      }

      const { latitude: lat, longitude: lon, name: resolvedName, country } = geoData.results[0]
      setCityName(`${resolvedName}, ${country || ''}`.trim())

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,wind_speed_10m,relative_humidity_2m,surface_pressure,rain` +
        `&past_days=30&hourly=temperature_2m,wind_speed_10m,relative_humidity_2m,surface_pressure,rain`
      )
      if (!weatherRes.ok) throw new Error('Failed to fetch weather data.')
      const weatherData = await weatherRes.json()

      const current = weatherData.current
      if (!current) throw new Error('Weather data is unavailable for this location.')

      const temp = current.temperature_2m ?? 0
      const wind = current.wind_speed_10m ?? 0
      const humidity = current.relative_humidity_2m ?? 50
      const pressure = current.surface_pressure ?? 1013
      const rain = current.rain ?? 0

      // Compute 30-day averages
      let avgTemp = 0, avgWind = 0, avgHumidity = 50, avgPressure = 1013, avgRain = 0;
      if (weatherData.hourly && weatherData.hourly.time) {
        const hourly = weatherData.hourly;
        const totalHours = hourly.time.length || 1;
        const sum = arr => arr.reduce((a, b) => a + (b || 0), 0);
        
        avgTemp = parseFloat((sum(hourly.temperature_2m || []) / totalHours).toFixed(1));
        avgWind = parseFloat((sum(hourly.wind_speed_10m || []) / totalHours).toFixed(1));
        avgHumidity = Math.round(sum(hourly.relative_humidity_2m || []) / totalHours);
        avgPressure = Math.round(sum(hourly.surface_pressure || []) / totalHours);
        
        const totalRain = sum(hourly.rain || []);
        const totalDays = totalHours / 24; 
        avgRain = parseFloat((totalRain / (totalDays || 1)).toFixed(1));
      }

      setWeather({ temp, wind, humidity, pressure, rain, avgTemp, avgWind, avgHumidity, avgPressure, avgRain })

      const classifyRes = await fetch(
        `${BACKEND_URL}/classifyWithHistory?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}&avg_temp=${avgTemp}&avg_rain=${avgRain}&avg_wind=${avgWind}&avg_humidity=${avgHumidity}&avg_pressure=${avgPressure}`
      )
      if (!classifyRes.ok) {
        throw new Error('Classification service unavailable. Ensure the backend is running.')
      }
      const classifyData = await classifyRes.json()
      setSeverity(classifyData.severity || 'Unknown')
      setReason(classifyData.reason || '')

    } catch (err) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') fetchWeather()
  }

  const sevConfig = SEVERITY_CONFIG[severity] || { emoji: '❓', className: '' }
  const sevDetails = SEVERITY_DETAILS[severity]
  const showDetailsPanel = weather && !loading && severity && sevDetails

  return (
    <div className={`layout-wrapper ${showDetailsPanel ? 'has-details' : ''}`}>

      {/* ====== LEFT: Weather Dashboard ====== */}
      <div className="dashboard-card">

        <div className="dashboard-header">
          <span className="dashboard-icon">🌦️</span>
          <h1 className="dashboard-title">Meteorological Alert System</h1>
          <p className="dashboard-subtitle">Real-time weather severity classification</p>
        </div>

        <div className="input-group">
          <input
            id="city-input"
            className="city-input"
            type="text"
            placeholder="Enter city name..."
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            id="fetch-weather-btn"
            className="fetch-btn"
            onClick={fetchWeather}
            disabled={loading}
          >
            {loading ? '...' : 'Analyze'}
          </button>
        </div>

        {error && (
          <div className="error-message" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
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
              <div className="city-display">
                📍 <span className="city-name">{cityName}</span>
              </div>
            )}

            <div className="weather-stats">
              <div className="stat-card">
                <span className="stat-icon">🌡️</span>
                <div className="stat-value">{weather.temp}°C</div>
                <div className="stat-label">Temperature</div>
                {weather.avgTemp !== undefined && (
                  <div className="stat-avg" style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    30d Avg: {weather.avgTemp}°C
                  </div>
                )}
              </div>
              <div className="stat-card">
                <span className="stat-icon">💨</span>
                <div className="stat-value">{weather.wind} km/h</div>
                <div className="stat-label">Wind Speed</div>
                {weather.avgWind !== undefined && (
                  <div className="stat-avg" style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    30d Avg: {weather.avgWind} km/h
                  </div>
                )}
              </div>
              <div className="stat-card">
                <span className="stat-icon">💧</span>
                <div className="stat-value">{weather.humidity}%</div>
                <div className="stat-label">Humidity</div>
                {weather.avgHumidity !== undefined && (
                  <div className="stat-avg" style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    30d Avg: {weather.avgHumidity}%
                  </div>
                )}
              </div>
              <div className="stat-card">
                <span className="stat-icon">🌧️</span>
                <div className="stat-value">{weather.rain} mm</div>
                <div className="stat-label">Rainfall</div>
                {weather.avgRain !== undefined && (
                  <div className="stat-avg" style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    30d Avg: {weather.avgRain} mm
                  </div>
                )}
              </div>
            </div>

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
                <span className={`severity-badge ${sevConfig.className}`}>
                  <span className="severity-emoji">{sevConfig.emoji}</span>
                  {severity}
                </span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ====== GLOBAL ALERTS (auto-scanned) ====== */}
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
            <p>No active alerts detected worldwide. All {GLOBAL_SCAN_CITIES.length} monitored cities are within safe parameters.</p>
          </div>
        )}

        {globalAlerts.length > 0 && (
          <div className="monitor-grid">
            {globalAlerts.map(alert => {
              const config = SEVERITY_CONFIG[alert.severity] || { emoji: '❓', className: '' }
              return (
                <div
                  key={alert.name}
                  className={`monitor-card ${config.className}`}
                  onClick={() => {
                    setCity(alert.name)
                    fetchWeather()
                  }}
                >
                  <div className="monitor-card-header">
                    <span className="monitor-city">{alert.name}</span>
                    <span className="monitor-country">{alert.country}</span>
                  </div>
                  <div className="monitor-card-body">
                    <div className="monitor-temp">{alert.temp}°C</div>
                    <div className={`monitor-badge ${config.className}`}>
                      {config.emoji} {alert.severity}
                    </div>
                  </div>
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

      {/* ====== MY WATCHLIST (user-added) ====== */}
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

              return (
                <div
                  key={name}
                  className={`monitor-card ${config.className}`}
                  onClick={() => {
                    setCity(data.resolvedName || name)
                    fetchWeather()
                  }}
                >
                  <button className="remove-btn" onClick={(e) => removeFromWatchlist(e, name)}>×</button>
                  <div className="monitor-card-header">
                    <span className="monitor-city">{data.resolvedName}</span>
                    <span className="monitor-country">{data.country}</span>
                  </div>
                  <div className="monitor-card-body">
                    <div className="monitor-temp">{data.temp}°C</div>
                    <div className={`monitor-badge ${config.className}`}>
                      {config.emoji} {data.severity}
                    </div>
                  </div>
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

      {/* ====== RIGHT: Alert Details Panel ====== */}
      {showDetailsPanel && (
        <div className={`details-panel ${sevConfig.className}`}>

          <div className={`details-header ${sevConfig.className}`}>
            <span className="details-header-emoji">{sevConfig.emoji}</span>
            <div>
              <h2 className="details-headline">{sevDetails.headline}</h2>
              <span className={`details-level-tag ${sevConfig.className}`}>{severity} Alert</span>
            </div>
          </div>

          <div className="details-body">

            <section className="details-section">
              <h3 className="section-title">Assessment</h3>
              <p className="section-text">{sevDetails.summary}</p>
            </section>

            {reason && (
              <>
                <div className="section-divider"></div>
                <section className="details-section">
                  <h3 className="section-title">Historical Context Analysis</h3>
                  <div className="stat-card" style={{ background: 'var(--bg-card-hover)', padding: '15px', color: 'var(--text-primary)', borderLeft: '4px solid var(--accent)', borderRadius: '4px', textAlign: 'left' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>{reason}</p>
                  </div>
                </section>
              </>
            )}

            <div className="section-divider"></div>

            <section className="details-section">
              <h3 className="section-title">Contributing Factors</h3>
              <ul className="factor-list">
                {getAlertReasons(weather).map((r, i) => (
                  <li key={i} className="factor-item">
                    <span className="factor-icon">{r.icon}</span>
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="section-divider"></div>

            <section className="details-section">
              <h3 className="section-title">Safety Advisories</h3>
              <ul className="advisory-list">
                {sevDetails.advisories.map((adv, i) => (
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

    </div>
  )
}
