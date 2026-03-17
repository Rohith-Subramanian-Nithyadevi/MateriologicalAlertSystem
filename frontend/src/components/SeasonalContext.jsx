import { zScore } from '../lib/HybridMLEngine'

function monthName(m) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]
}

function anomalyLevel(z, higherIsBad = true) {
  const az = Math.abs(z)
  const isBad = higherIsBad ? z > 0 : z < 0
  if (az < 1) return { level: 'normal', label: 'Normal', color: '#4ade80', bad: false }
  if (az < 2) return { level: 'moderate', label: 'Slightly', color: '#fbbf24', bad: isBad }
  if (az < 3) return { level: 'high', label: 'Notably', color: '#fb923c', bad: isBad }
  return { level: 'extreme', label: 'Extremely', color: '#f87171', bad: isBad }
}

export default function SeasonalContext({ normals, current, seasonalResult, loading }) {
  if (loading) {
    return (
      <div className="card">
        <div className="card-title">🗓️ Seasonal Context Analysis</div>
        <div className="card-sub">Querying Open-Meteo archive (15 years · same month)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 0' }}>
          <div className="spinner-sm"></div>
          <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>Fetching 15-year seasonal baseline...</span>
        </div>
      </div>
    )
  }
  if (!normals) return null

  const { season, month } = normals

  const rows = [
    { label: 'Temperature', ico: '🌡️', cur: `${current.temp}°C`, mean: normals.temp.mean != null ? `${normals.temp.mean}°C` : '—', range: normals.temp.min != null ? `${normals.temp.min}–${normals.temp.max}°C` : '—', z: zScore(current.temp, normals.temp.mean, normals.temp.std), get anomaly() { return anomalyLevel(this.z, this.z > 0) } },
    { label: 'Wind Speed', ico: '💨', cur: `${current.wind}km/h`, mean: normals.wind.mean != null ? `${normals.wind.mean}km/h` : '—', range: normals.wind.min != null ? `${normals.wind.min}–${normals.wind.max}km/h` : '—', z: zScore(current.wind, normals.wind.mean, normals.wind.std), get anomaly() { return anomalyLevel(this.z, true) } },
    { label: 'Rainfall', ico: '🌧️', cur: `${current.rain}mm`, mean: normals.rain.mean != null ? `${normals.rain.mean}mm/d` : '—', range: normals.rain.min != null ? `${normals.rain.min}–${normals.rain.max}mm` : '—', z: zScore(current.rain, normals.rain.mean, normals.rain.std), get anomaly() { return anomalyLevel(this.z, true) } },
    { label: 'Humidity', ico: '💧', cur: `${current.humidity}%`, mean: normals.humidity.mean != null ? `${normals.humidity.mean}%` : '—', range: normals.humidity.min != null ? `${normals.humidity.min}–${normals.humidity.max}%` : '—', z: zScore(current.humidity, normals.humidity.mean, normals.humidity.std), get anomaly() { return anomalyLevel(this.z, this.z > 0) } },
  ]

  const lvClr = { extreme: '#f87171', high: '#fb923c', moderate: '#fbbf24', low: '#4ade80', normal: '#4ade80' }

  return (
    <div className="card" style={{ borderColor: season?.color ? `${season.color}30` : 'var(--border)' }} id="seasonal-context">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <div className="card-title">{season?.icon} Seasonal Context — {season?.name ?? monthName(month)}</div>
          <div className="card-sub" style={{ marginBottom: 0 }}>
            15-year baseline (2010–2024) · {monthName(month)} normals
            {normals.temp.count > 0 && ` · ${normals.temp.count} day-samples`}
          </div>
        </div>
        {seasonalResult?.overridden && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.3rem 0.7rem', borderRadius: '999px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            ⚡ Severity adjusted by seasonal analysis
          </span>
        )}
      </div>

      {/* Anomaly alerts */}
      {seasonalResult?.anomalies?.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {seasonalResult.anomalies.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', background: `${a.level.color}10`, border: `1px solid ${a.level.color}30`, borderLeft: `3px solid ${a.level.color}`, borderRadius: 'var(--r-sm)', padding: '0.6rem 0.8rem' }}>
              <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{a.level.level === 'extreme' ? '🚨' : a.level.level === 'high' ? '⚠️' : '📊'}</span>
              <div>
                <span style={{ fontWeight: 700, color: a.level.color, fontSize: '0.8rem' }}>{a.param} anomaly — </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{a.msg}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Normal season */}
      {!seasonalResult?.anomalies?.length && normals.temp.mean != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', borderLeft: '3px solid #4ade80', borderRadius: 'var(--r-sm)', padding: '0.6rem 0.8rem', marginBottom: '1rem' }}>
          <span>✅</span>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            All parameters consistent with expected {season?.name} conditions for this location.
          </span>
        </div>
      )}

      {/* Per-parameter anomaly bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {rows.map(row => {
          const clamped = Math.max(-3, Math.min(3, row.z))
          const barPct = (clamped + 3) / 6 * 100
          const barClr = lvClr[row.anomaly.level] ?? '#4ade80'
          return (
            <div key={row.label} style={{ background: 'rgba(6,18,40,0.5)', borderRadius: 'var(--r-sm)', padding: '0.7rem 0.85rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.95rem' }}>{row.ico}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{row.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--dim)' }}>15yr avg: <strong style={{ color: 'var(--muted)' }}>{row.mean}</strong></span>
                  <span style={{ color: 'var(--dim)' }}>range: {row.range}</span>
                  <span style={{ fontWeight: 700, color: barClr }}>now: {row.cur}</span>
                </div>
              </div>
              <div style={{ position: 'relative', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'visible' }}>
                <div style={{ position: 'absolute', left: '50%', top: '-2px', width: '1.5px', height: '10px', background: 'rgba(127,181,200,0.3)', borderRadius: '1px' }} />
                <div style={{
                  position: 'absolute', height: '100%',
                  left: clamped >= 0 ? '50%' : `${barPct}%`,
                  width: `${Math.abs(barPct - 50)}%`,
                  background: barClr, borderRadius: '999px',
                  transition: 'all 0.7s ease', opacity: Math.abs(row.z) < 0.5 ? 0.3 : 0.9
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', fontSize: '0.68rem', color: 'var(--dim)' }}>
                <span>← below normal</span>
                {Math.abs(row.z) >= 1
                  ? <span style={{ color: barClr, fontWeight: 700 }}>{row.anomaly.label} {row.z > 0 ? 'above' : 'below'} normal ({row.z > 0 ? '+' : ''}{row.z.toFixed(1)}σ)</span>
                  : <span style={{ color: '#4ade80', fontWeight: 600 }}>Within normal range</span>
                }
                <span>above normal →</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
