import { EVENT_TYPES, SEVERITY_COLORS, probToLevel } from '../lib/HybridMLEngine'

const EVENT_META = {
  'Thunderstorm':    { emoji: '⛈️', color: '#a78bfa', desc: 'Severe convective storm with lightning, wind, and rain' },
  'Cyclone':         { emoji: '🌀', color: '#818cf8', desc: 'Organized tropical system with sustained cyclonic winds' },
  'Tropical Storm':  { emoji: '🌀', color: '#60a5fa', desc: 'Organized system with sustained winds 62–117 km/h' },
  'Hailstorm':       { emoji: '🧊', color: '#93c5fd', desc: 'Cold-air convective storm producing ice precipitation' },
  'Flood Risk':      { emoji: '💧', color: '#22d3ee', desc: 'Excessive rainfall causing potential water accumulation' },
  'Heatwave':        { emoji: '☀️', color: '#fb923c', desc: 'Prolonged period of abnormally high temperature' },
  'Heavy Rainfall':  { emoji: '🌧️', color: '#22d3ee', desc: 'Rainfall exceeding 64mm — IMD Heavy category' },
  'Extreme Wind':    { emoji: '🌪️', color: '#f87171', desc: 'Standalone high-speed winds without cyclonic origin' },
  'Cold Wave':       { emoji: '🥶', color: '#93c5fd', desc: 'Temperature significantly below seasonal normal' },
}

export default function CalamityClassification({ prediction, dailyForecast }) {
  if (!prediction) return null

  const { eventProbabilities, rankedEvents } = prediction
  if (!eventProbabilities) return null

  // Find time windows from daily forecast
  function getTimeWindow(eventType) {
    if (!dailyForecast?.length) return '—'
    const relevantDays = dailyForecast.filter(d => {
      const ep = d.eventProbabilities || {}
      return (ep[eventType] || 0) > 20
    })
    if (!relevantDays.length) return '—'
    if (relevantDays.length === 1) return relevantDays[0].date
    return `${relevantDays[0].date} – ${relevantDays[relevantDays.length - 1].date}`
  }

  return (
    <div className="card" id="calamity-classification">
      <div className="card-title">🔬 Detailed Calamity Classification</div>
      <div className="card-sub">
        9 event types analyzed using Hybrid ML Engine — Logistic Regression + Random Forest + Gradient Boosting
      </div>

      <div className="calamity-grid">
        {rankedEvents.map(event => {
          const meta = EVENT_META[event.type] || { emoji: '❓', color: '#3d6275', desc: '' }
          const level = probToLevel(event.probability)
          const levelColor = SEVERITY_COLORS[level]
          const isActive = event.probability >= 15
          const window = getTimeWindow(event.type)

          return (
            <div
              key={event.type}
              className={`calamity-card ${isActive ? 'active' : ''}`}
              style={{ borderLeftColor: isActive ? meta.color : 'var(--border)' }}
            >
              <div className="calamity-header">
                <span className="calamity-emoji">{meta.emoji}</span>
                <div className="calamity-name">{event.type}</div>
              </div>

              {/* Probability */}
              <div className="calamity-prob-row">
                <span className="calamity-prob-value" style={{ color: levelColor }}>
                  {event.probability}%
                </span>
                <span className="calamity-level-badge" style={{ background: `${levelColor}15`, color: levelColor, border: `1px solid ${levelColor}35` }}>
                  {level}
                </span>
              </div>

              {/* Progress bar */}
              <div className="calamity-bar-track">
                <div
                  className="calamity-bar-fill"
                  style={{ width: `${Math.min(event.probability, 100)}%`, background: meta.color }}
                />
              </div>

              {/* Time window */}
              <div className="calamity-window">
                <span className="calamity-window-label">Window:</span>
                <span className="calamity-window-value">{window}</span>
              </div>

              {/* Description */}
              <div className="calamity-desc">{meta.desc}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
