import { SEVERITY_COLORS } from '../lib/HybridMLEngine'

const SEV = {
  Low:      { emoji: '✅', color: '#4ade80' },
  Moderate: { emoji: '⚠️', color: '#fbbf24' },
  High:     { emoji: '🔶', color: '#fb923c' },
  Extreme:  { emoji: '🔴', color: '#f87171' },
}

const DIS = {
  'Cyclone Watch':     { emoji: '🌀' },
  'Storm Surge':       { emoji: '🌊' },
  'Flood Risk':        { emoji: '💧' },
  'Heat Stress':       { emoji: '🔥' },
  'Heatwave':          { emoji: '☀️' },
  'Cold Stress':       { emoji: '❄️' },
  'Cold Wave':         { emoji: '🥶' },
  'Thunderstorm Risk': { emoji: '⛈️' },
  'Compound Risk':     { emoji: '⚡' },
  'Tropical Storm':    { emoji: '🌀' },
  'Hailstorm Risk':    { emoji: '🧊' },
  'Heavy Rainfall':    { emoji: '🌧️' },
  'Extreme Wind':      { emoji: '🌪️' },
  'No Threat':         { emoji: '✅' },
}

export default function ForecastStrip({ dailyForecast }) {
  if (!dailyForecast?.length) return null

  return (
    <div id="forecast-strip">
      <h2 className="section-heading" style={{ marginBottom: '1rem' }}>
        🗓️ 7-Day Risk Forecast
      </h2>
      <p className="card-sub" style={{ marginBottom: '1rem', marginTop: '-0.5rem' }}>
        Each day analyzed independently using the Hybrid ML Engine · Probabilities based on forecast data
      </p>
      <div className="forecast-strip">
        {dailyForecast.map((d, i) => {
          const s = SEV[d.severity] || SEV['Low']
          const dis = DIS[d.primaryEvent] || DIS['No Threat']
          return (
            <div key={i} className={`fc-card fc-${d.severity}`}>
              <div className="fc-date">{d.date}</div>
              <div className="fc-type">{dis.emoji}</div>
              <div className="fc-temp">{d.maxTemp}°C</div>
              <div className="fc-badge" style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}35` }}>
                {s.emoji} {d.severity}
              </div>

              {/* Probability display */}
              <div style={{ margin: '0.3rem 0' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--dim)', marginBottom: '0.2rem' }}>Risk: {d.probability}%</div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(d.probability, 100)}%`, background: s.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                </div>
              </div>

              {/* Event type if not No Threat */}
              {d.primaryEvent && d.primaryEvent !== 'No Threat' && (
                <div style={{ fontSize: '0.65rem', color: s.color, fontWeight: 600, marginTop: '0.2rem' }}>
                  {d.primaryEvent}
                </div>
              )}

              <div className="fc-stats">
                <span>🌬️{d.maxWind}</span>
                <span>🌧️{d.totalRain}</span>
                <span>📉{d.minPressure}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
