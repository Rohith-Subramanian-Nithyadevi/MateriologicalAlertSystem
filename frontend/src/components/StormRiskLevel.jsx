import { SEVERITY_COLORS, EVENT_TYPES, probToLevel } from '../lib/HybridMLEngine'

const SEV = {
  Low:      { emoji: '✅', cls: 'low',      color: '#4ade80' },
  Moderate: { emoji: '⚠️', cls: 'moderate', color: '#fbbf24' },
  High:     { emoji: '🔶', cls: 'high',     color: '#fb923c' },
  Extreme:  { emoji: '🔴', cls: 'extreme',  color: '#f87171' },
}

const DIS = {
  'Cyclone Watch':     { emoji: '🌀', color: '#818cf8' },
  'Storm Surge':       { emoji: '🌊', color: '#22d3ee' },
  'Flood Risk':        { emoji: '💧', color: '#22d3ee' },
  'Heat Stress':       { emoji: '🔥', color: '#fb923c' },
  'Heatwave':          { emoji: '☀️', color: '#fb923c' },
  'Cold Stress':       { emoji: '❄️', color: '#93c5fd' },
  'Cold Wave':         { emoji: '🥶', color: '#93c5fd' },
  'Thunderstorm Risk': { emoji: '⛈️', color: '#a78bfa' },
  'Compound Risk':     { emoji: '⚡', color: '#fbbf24' },
  'Tropical Storm':    { emoji: '🌀', color: '#818cf8' },
  'Hailstorm Risk':    { emoji: '🧊', color: '#93c5fd' },
  'Heavy Rainfall':    { emoji: '🌧️', color: '#22d3ee' },
  'Extreme Wind':      { emoji: '🌪️', color: '#f87171' },
  'No Threat':         { emoji: '✅', color: '#4ade80' },
}

function alertReasons(w) {
  const { temp, wind, rain, humidity, pressure } = w
  const r = []
  if (rain > 200) r.push({ ico: '🌧️', txt: `Rainfall: ${rain}mm — Extremely Heavy (>204mm)` })
  else if (rain > 115) r.push({ ico: '🌧️', txt: `Rainfall: ${rain}mm — Very Heavy (>115mm)` })
  else if (rain > 64) r.push({ ico: '🌧️', txt: `Rainfall: ${rain}mm — Heavy (>64mm)` })
  if (wind > 117) r.push({ ico: '🌪️', txt: `Wind: ${wind}km/h — hurricane-force` })
  else if (wind > 88) r.push({ ico: '💨', txt: `Wind: ${wind}km/h — storm-force` })
  else if (wind > 61) r.push({ ico: '💨', txt: `Wind: ${wind}km/h — gale-force` })
  if (temp > 47) r.push({ ico: '🔥', txt: `Temperature: ${temp}°C — Severe Heat Wave (>47°C)` })
  else if (temp > 40) r.push({ ico: '☀️', txt: `Temperature: ${temp}°C — Heat Wave (>40°C)` })
  else if (temp < -10) r.push({ ico: '🥶', txt: `Temperature: ${temp}°C — extreme cold` })
  else if (temp < 0) r.push({ ico: '❄️', txt: `Temperature: ${temp}°C — below freezing` })
  if (pressure < 970) r.push({ ico: '📉', txt: `Pressure: ${pressure}hPa — extreme low; cyclonic risk` })
  else if (pressure < 990) r.push({ ico: '📉', txt: `Pressure: ${pressure}hPa — very low; active system` })
  else if (pressure < 1005) r.push({ ico: '📉', txt: `Pressure: ${pressure}hPa — below normal` })
  if (humidity > 90 && temp > 35) r.push({ ico: '🥵', txt: `Heat stress: ${humidity}% humidity at ${temp}°C` })
  if (!r.length) r.push({ ico: '✅', txt: 'All parameters within normal operating ranges' })
  return r
}

export default function StormRiskLevel({ severity, disasterType, prediction, weather, reason }) {
  if (!severity || !weather) return null

  const sc = SEV[severity] || { emoji: '❓', cls: '', color: '#3d6275' }
  const dc = DIS[disasterType] || DIS['No Threat']
  const prob = prediction?.overallProbability ?? 0

  return (
    <div className="card" id="storm-risk-level">
      {/* Header with severity + disaster type badges */}
      <div className="sev-head">
        <div className="sev-big-emoji">{disasterType && disasterType !== 'No Threat' ? dc.emoji : sc.emoji}</div>
        <div style={{ flex: 1 }}>
          <div className="sev-badges">
            <span className="badge badge-anim" style={{ background: `${sc.color}18`, color: sc.color, border: `1px solid ${sc.color}45` }}>
              {sc.emoji} {severity} Alert
            </span>
            {disasterType && disasterType !== 'No Threat' && (
              <span className="badge badge-sm" style={{ background: `${dc.color}15`, color: dc.color, border: `1px solid ${dc.color}35` }}>
                {dc.emoji} {disasterType}
              </span>
            )}
          </div>

          {/* Overall probability bar */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overall Storm Risk</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: sc.color }}>{prob}%</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(prob, 100)}%`, background: `linear-gradient(90deg, ${sc.color}90, ${sc.color})`, borderRadius: '999px', transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.65rem', color: 'var(--dim)' }}>
              <span>Safe</span><span>Moderate</span><span>High</span><span>Extreme</span>
            </div>
          </div>
        </div>
      </div>

      {/* Historical context */}
      {reason && (
        <div className="ctx-box" style={{ marginTop: '0.75rem' }}>
          <div className="ctx-lbl">Classification Context</div>
          <p>{reason}</p>
        </div>
      )}

      {/* Contributing factors */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>🛡️ Contributing Factors</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {alertReasons(weather).map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0 }}>{r.ico}</span>
              <span>{r.txt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ML model contributions */}
      {prediction?.modelContributions && (
        <div style={{ marginTop: '0.75rem', padding: '0.7rem 0.85rem', background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.1)', borderRadius: 'var(--r-sm)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Hybrid ML Model Contributions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.4rem' }}>
            {[
              { label: 'Logistic Reg.', val: `${prediction.modelContributions.logisticRegression}%` },
              { label: 'Random Forest', val: `${prediction.modelContributions.randomForest}%` },
              { label: 'Grad. Boost', val: `${prediction.modelContributions.gradientBoosting.toFixed(1)}%` },
              { label: 'Time-Series', val: `×${prediction.modelContributions.timeSeriesMultiplier.toFixed(2)}` },
              { label: 'Historical Adj.', val: `${prediction.modelContributions.historicalAdjustment > 0 ? '+' : ''}${prediction.modelContributions.historicalAdjustment}` },
            ].map(m => (
              <div key={m.label} style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span>{m.label}</span>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{m.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
