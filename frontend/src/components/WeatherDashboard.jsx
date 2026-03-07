import { useState } from 'react'

const BACKEND_URL = 'http://localhost:3000'

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
  const [cityName, setCityName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        `&current=temperature_2m,wind_speed_10m,relative_humidity_2m,surface_pressure,rain`
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

      setWeather({ temp, wind, humidity, pressure, rain })

      const classifyRes = await fetch(
        `${BACKEND_URL}/classify?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}`
      )
      if (!classifyRes.ok) {
        throw new Error('Classification service unavailable. Ensure the backend is running on port 3000.')
      }
      const classifyData = await classifyRes.json()
      setSeverity(classifyData.severity || 'Unknown')

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
              </div>
              <div className="stat-card">
                <span className="stat-icon">💨</span>
                <div className="stat-value">{weather.wind} km/h</div>
                <div className="stat-label">Wind Speed</div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">💧</span>
                <div className="stat-value">{weather.humidity}%</div>
                <div className="stat-label">Humidity</div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">🌧️</span>
                <div className="stat-value">{weather.rain} mm</div>
                <div className="stat-label">Rainfall</div>
              </div>
            </div>

            {severity && (
              <div className="severity-section">
                <div className="severity-label">Alert Severity</div>
                <span className={`severity-badge ${sevConfig.className}`}>
                  <span className="severity-emoji">{sevConfig.emoji}</span>
                  {severity}
                </span>
              </div>
            )}
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
