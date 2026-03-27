import { SEVERITY_COLORS, EVENT_TYPES, probToLevel } from '../lib/HybridRuleEngine'

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
  const mc = prediction?.modelContributions

  // ── Build model contribution rows with correct data ──
  const modelRows = mc ? [
    {
      label: 'Weighted Sigmoid Scoring',
      val: `${mc.lrTopScore ?? mc.logisticRegression}%`,
      note: mc.lrTopEvent ? `→ ${mc.lrTopEvent}` : 'per-disaster weighted sigmoid',
      barPct: Math.min(mc.lrTopScore ?? mc.logisticRegression, 100),
      color: '#22d3ee',
    },
    {
      label: 'Ensemble Decision Trees',
      val: (mc.randomForestActivity ?? 0) > 0 ? `${mc.randomForest}%` : '—',
      note: (mc.randomForestActivity ?? 0) > 0
        ? (mc.rfPrimary && mc.rfPrimary !== 'No Threat'
            ? `→ ${mc.rfPrimary} (${mc.randomForestActivity}% active branches)`
            : `${mc.randomForestActivity}% active branches`)
        : 'no threshold crossed — conditions mild',
      barPct: Math.min(mc.randomForestActivity ?? 0, 100),
      color: '#818cf8',
    },
    {
      label: 'Gradient Thresholds',
      // show highest GB score found (most informative signal)
      val: `${mc.gradientBoostingTop ?? mc.gradientBoosting}%`,
      note: `primary: ${mc.gradientBoosting}%`,
      barPct: Math.min(mc.gradientBoostingTop ?? mc.gradientBoosting, 100),
      color: '#a78bfa',
    },
    {
      label: 'Time-Series',
      // multiplier: 1.00 = no trend data, >1 = risk amplified
      val: `×${mc.timeSeriesMultiplier?.toFixed(2) ?? '1.00'}`,
      note: mc.timeSeriesPressureDrop
        ? `Δp ${mc.timeSeriesPressureDrop > 0 ? '-' : '+'}${Math.abs(mc.timeSeriesPressureDrop)}hPa/24h`
        : 'no trend data',
      // bar shows deviation from 1.0 baseline (max useful range ×1.0–×2.0)
      barPct: Math.min(Math.max(0, (mc.timeSeriesMultiplier - 1.0) / 1.0 * 100), 100),
      color: '#fbbf24',
      // always show at least a thin indicator bar
      minBar: 4,
    },
    {
      label: 'Historical Adj.',
      val: mc.historicalAdjustment != null
        ? `${mc.historicalAdjustment > 0 ? '+' : ''}${mc.historicalAdjustment}`
        : '—',
      note: mc.historicalAnomalyCount != null
        ? mc.historicalAnomalyCount === 0
          ? 'seasonal normal'
          : `${mc.historicalAnomalyCount} anomaly${mc.historicalAnomalyCount > 1 ? 's' : ''} detected`
        : 'awaiting baseline',
      // bar: 0 adjustment = center; positive = risk up; range -30 to +45
      barPct: mc.historicalAdjustment != null
        ? Math.min(Math.max(0, (mc.historicalAdjustment + 30) / 75 * 100), 100)
        : 0,
      color: mc.historicalAdjustment > 0 ? '#fb923c' : mc.historicalAdjustment < 0 ? '#4ade80' : '#52525b',
    },
  ] : []

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

      {/* Rule engine contributions — FIXED display */}
      {modelRows.length > 0 && (
        <div style={{ marginTop: '0.75rem', padding: '0.7rem 0.85rem', background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.1)', borderRadius: 'var(--r-sm)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
            Hybrid Rule Engine Contributions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {modelRows.map(m => (
              <div key={m.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{m.label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{m.val}</span>
                    {m.note && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--dim)', marginLeft: '0.4rem' }}>
                        {m.note}
                      </span>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(m.minBar ?? 0, m.barPct)}%`,
                    background: m.color,
                    borderRadius: '999px',
                    transition: 'width 0.7s ease',
                    opacity: m.barPct === 0 ? 0.3 : 0.85,
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Footnote: explain time-series and historical when data is absent */}
          {(mc.timeSeriesMultiplier === 1.0 || mc.historicalAdjustment === 0) && (
            <div style={{ marginTop: '0.6rem', fontSize: '0.65rem', color: 'var(--dim)', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.4rem' }}>
              {mc.timeSeriesMultiplier === 1.0 && '⏱ Time-Series: ×1.00 = no significant pressure/wind trend detected in forecast. '}
              {mc.historicalAdjustment === 0 && '📊 Historical: 0 = seasonal normals loading or within range.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}