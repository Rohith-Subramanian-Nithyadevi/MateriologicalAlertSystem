import { SEVERITY_COLORS, probToLevel } from '../lib/HybridMLEngine'

const compass = deg => {
  const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return d[Math.round((deg ?? 0) / 22.5) % 16]
}

function trendArrow(cur, avg, invertBad = false) {
  const d = cur - avg
  if (Math.abs(d) < 0.5) return { sym: '→', label: 'Stable', color: '#3d6275' }
  const up = d > 0
  return { sym: up ? '↑' : '↓', label: `${up ? '+' : ''}${d.toFixed(1)}`, color: (up !== invertBad) ? '#f87171' : '#4ade80' }
}

function heatIndex(tc, rh) {
  if (tc < 27) return null
  const tf = tc * 9/5 + 32
  const h = -42.379 + 2.04901523*tf + 10.14333127*rh - 0.22475541*tf*rh
           - 6.83783e-3*tf*tf - 5.481717e-2*rh*rh + 1.22874e-3*tf*tf*rh
           + 8.5282e-4*tf*rh*rh - 1.99e-6*tf*tf*rh*rh
  const hc = (h - 32) * 5/9
  return hc > tc + 2 ? Math.round(hc*10)/10 : null
}

export default function CurrentConditions({ weather, cityName }) {
  if (!weather) return null
  const hi = heatIndex(weather.temp, weather.humidity)

  const cells = [
    { ico: '🌡️', val: `${weather.temp}°C`,      lbl: 'Temperature',                        t: trendArrow(weather.temp, weather.avgTemp),         avg: `${weather.avgTemp}°C` },
    { ico: '💨', val: `${weather.wind} km/h`,    lbl: `Wind · ${compass(weather.windDir)}`,  t: trendArrow(weather.wind, weather.avgWind),         avg: `${weather.avgWind} km/h` },
    { ico: '💧', val: `${weather.humidity}%`,     lbl: 'Humidity',                            t: trendArrow(weather.humidity, weather.avgHumidity), avg: `${weather.avgHumidity}%` },
    { ico: '🌧️', val: `${weather.rain} mm`,      lbl: 'Rainfall',                            t: trendArrow(weather.rain, weather.avgRain),         avg: `${weather.avgRain} mm` },
  ]

  const pressColor = weather.pressure < 970 ? '#f87171' : weather.pressure < 990 ? '#fb923c' : weather.pressure < 1005 ? '#fbbf24' : '#4ade80'
  const pressLabel = weather.pressure < 970 ? '🔴 Extreme low — cyclonic risk' : weather.pressure < 990 ? '🟠 Very low — active system' : weather.pressure < 1005 ? '🟡 Below normal' : '✅ Normal range'

  return (
    <div className="card" id="current-conditions">
      <div className="cond-titlerow">
        <div>
          <div className="card-title">📍 {cityName}</div>
          <div className="card-sub">Current conditions · MSL pressure · IMD scale</div>
        </div>
      </div>
      <div className="cond-grid">
        {cells.map(s => (
          <div className="cond-cell" key={s.lbl}>
            <span className="cond-ico">{s.ico}</span>
            <div className="cond-val">{s.val}</div>
            <div className="cond-lbl">{s.lbl}</div>
            <div className="cond-trend" style={{ color: s.t.color }}>{s.t.sym} {s.t.label}</div>
            <div className="cond-avg">30d avg: {s.avg}</div>
          </div>
        ))}
      </div>
      <div className="pres-row">
        <div className="pres-left">
          <span style={{ fontSize: '1.2rem' }}>📊</span>
          <div>
            <div className="pres-val">{weather.pressure} hPa</div>
            <div className="cond-lbl">Sea-Level Pressure (MSL)</div>
          </div>
        </div>
        <div>
          {(() => { const t = trendArrow(weather.pressure, weather.avgPressure, true); return <div style={{ color: t.color, fontWeight: 700, fontSize: '0.85rem', textAlign: 'right' }}>{t.sym} {t.label} hPa vs 30d avg</div> })()}
          <div className="pres-note" style={{ color: pressColor, textAlign: 'right' }}>
            {pressLabel}
          </div>
        </div>
      </div>
      {hi && <div className="hi-pill">🌡️ Apparent temperature: <strong>{hi}°C</strong> — {hi - weather.temp >= 5 ? 'dangerously' : 'noticeably'} hotter than ambient</div>}
    </div>
  )
}
