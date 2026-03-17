// ─── Wind Behaviour Chart ───────────────────────────────────────────────────

function smoothPath(vals, W, H, maxV, minV = 0) {
  if (!vals.length) return { line: '', fill: '', xs: [], ys: [] }
  const range = (maxV - minV) || 1, pad = 14
  const xs = vals.map((_, i) => (i / (vals.length - 1)) * W)
  const ys = vals.map(v => H - pad - ((v - minV) / range) * (H - pad * 2))
  let line = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`
  for (let i = 1; i < xs.length; i++) {
    const cx = ((xs[i - 1] + xs[i]) / 2).toFixed(2)
    line += ` C ${cx} ${ys[i - 1].toFixed(2)} ${cx} ${ys[i].toFixed(2)} ${xs[i].toFixed(2)} ${ys[i].toFixed(2)}`
  }
  const fill = `${line} L ${xs[xs.length - 1].toFixed(2)} ${H} L ${xs[0].toFixed(2)} ${H} Z`
  return { line, fill, xs, ys }
}

const compass = deg => {
  const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return d[Math.round((deg ?? 0) / 22.5) % 16]
}

function WindChart({ data }) {
  if (!data?.length) return <div className="chart-empty">No forecast data</div>
  const W = 500, H = 130
  const speeds = data.map(d => d.wind ?? 0)
  const maxS = Math.max(...speeds, 20)
  const { line, fill, xs, ys } = smoothPath(speeds, W, H, maxS)
  const clr = maxS > 88 ? '#f87171' : maxS > 61 ? '#fb923c' : maxS > 40 ? '#fbbf24' : '#22d3ee'
  const step = Math.max(1, Math.floor(data.length / 7))
  const pts = data.map((d, i) => ({ ...d, x: xs[i], y: ys[i], i })).filter((_, i) => i % step === 0)
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H + 26}`} style={{ width: '100%', display: 'block' }}>
        <defs><linearGradient id="wg" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={clr} stopOpacity="0.38" /><stop offset="100%" stopColor={clr} stopOpacity="0.02" /></linearGradient></defs>
        {[0.33, 0.66, 1].map(p => <line key={p} x1="0" y1={(H - 14 - p * (H - 28)).toFixed(1)} x2={W} y2={(H - 14 - p * (H - 28)).toFixed(1)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />)}
        {[{ v: 40, c: 'rgba(251,191,36,0.5)' }, { v: 61, c: 'rgba(251,146,60,0.5)' }, { v: 88, c: 'rgba(248,113,113,0.5)' }].map(({ v, c }) => maxS > v && <line key={v} x1="0" y1={(H - 14 - (v / maxS) * (H - 28)).toFixed(1)} x2={W} y2={(H - 14 - (v / maxS) * (H - 28)).toFixed(1)} stroke={c} strokeWidth="0.8" strokeDasharray="3,4" />)}
        <path d={fill} fill="url(#wg)" />
        <path d={line} fill="none" stroke={clr} strokeWidth="2.5" strokeLinejoin="round" />
        {pts.map((p, i) => <g key={i} transform={`translate(${p.x.toFixed(1)},${(p.y - 15).toFixed(1)})`}><g transform={`rotate(${p.windDir ?? 0})`}><path d="M0,-6 L3.5,5 L0,2.5 L-3.5,5Z" fill={clr} opacity="0.85" /></g></g>)}
        <circle cx={xs[0].toFixed(1)} cy={ys[0].toFixed(1)} r="6" fill={clr} opacity="0.25" />
        <circle cx={xs[0].toFixed(1)} cy={ys[0].toFixed(1)} r="4" fill={clr} />
        {pts.map((p, i) => <text key={`v${i}`} x={p.x.toFixed(1)} y={(p.y - 20).toFixed(1)} textAnchor="middle" fontSize="9" fill={clr} fontWeight="600">{Math.round(p.wind ?? 0)}</text>)}
        {pts.map((p, i) => <text key={`t${i}`} x={p.x.toFixed(1)} y={H + 18} textAnchor="middle" fontSize="9" fill="rgba(127,181,200,0.6)">{new Date(p.time).getHours().toString().padStart(2, '0')}:00</text>)}
      </svg>
      <div className="chart-legend">
        {maxS > 40 && <span className="legend-item" style={{ color: '#fbbf24' }}>── Strong (40)</span>}
        {maxS > 61 && <span className="legend-item" style={{ color: '#fb923c' }}>── Gale (61)</span>}
        {maxS > 88 && <span className="legend-item" style={{ color: '#f87171' }}>── Storm (88)</span>}
        <span className="legend-item" style={{ color: 'rgba(127,181,200,0.5)' }}>▲ Direction (km/h)</span>
      </div>
    </div>
  )
}

function PressureChart({ data }) {
  if (!data?.length) return <div className="chart-empty">No forecast data</div>
  const W = 500, H = 100
  const ps = data.map(d => d.pressure ?? 1013)
  const minP = Math.min(...ps) - 3, maxP = Math.max(...ps) + 3
  const { line, fill, xs, ys } = smoothPath(ps, W, H, maxP, minP)
  const drop = ps[0] - ps[ps.length - 1]
  const clr = drop > 15 ? '#f87171' : drop > 8 ? '#fb923c' : drop > 3 ? '#fbbf24' : '#818cf8'
  const step = Math.max(1, Math.floor(data.length / 7))
  const labels = data.map((d, i) => ({ ...d, x: xs[i], i })).filter((_, i) => i % step === 0)
  const range = (maxP - minP) || 1
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: '100%', display: 'block' }}>
        <defs><linearGradient id="pg" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={clr} stopOpacity="0.32" /><stop offset="100%" stopColor={clr} stopOpacity="0.02" /></linearGradient></defs>
        {minP < 1013 && maxP > 1013 && <><line x1="0" y1={(H - 14 - ((1013 - minP) / range) * (H - 28)).toFixed(1)} x2={W} y2={(H - 14 - ((1013 - minP) / range) * (H - 28)).toFixed(1)} stroke="rgba(127,181,200,0.2)" strokeWidth="1" strokeDasharray="5,4" /><text x={W - 4} y={(H - 18 - ((1013 - minP) / range) * (H - 28)).toFixed(1)} textAnchor="end" fontSize="8" fill="rgba(127,181,200,0.4)">1013hPa</text></>}
        {minP < 990 && maxP > 990 && <line x1="0" y1={(H - 14 - ((990 - minP) / range) * (H - 28)).toFixed(1)} x2={W} y2={(H - 14 - ((990 - minP) / range) * (H - 28)).toFixed(1)} stroke="rgba(251,146,60,0.45)" strokeWidth="0.8" strokeDasharray="3,4" />}
        <path d={fill} fill="url(#pg)" />
        <path d={line} fill="none" stroke={clr} strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx={xs[0].toFixed(1)} cy={ys[0].toFixed(1)} r="4" fill={clr} />
        <circle cx={xs[0].toFixed(1)} cy={ys[0].toFixed(1)} r="8" fill={clr} opacity="0.2" />
        {labels.map((l, i) => <text key={i} x={l.x.toFixed(1)} y={H + 16} textAnchor="middle" fontSize="9" fill="rgba(127,181,200,0.6)">{i === 0 ? 'Now' : `+${l.i}h`}</text>)}
      </svg>
      <div className="chart-legend">
        <span className="legend-item" style={{ color: clr }}>
          {drop > 8 ? '⚠️ Rapid fall' : drop > 3 ? '📉 Falling' : drop < -3 ? '📈 Rising' : '→ Stable'}: {Math.abs(drop).toFixed(1)} hPa over {data.length}h
        </span>
        {minP < 990 && <span className="legend-item" style={{ color: '#fb923c' }}>── 990 hPa danger threshold</span>}
      </div>
    </div>
  )
}

export default function WeatherCharts({ forecastHrs, weather }) {
  if (!forecastHrs?.length || !weather) return null
  const chartData = forecastHrs.filter((_, i) => i % 2 === 0)

  return (
    <div className="charts-row" id="weather-charts">
      <div className="card">
        <div className="chart-hdr">
          <div className="chart-title">💨 Wind Behaviour — Next 48h</div>
          <div className="chart-meta">
            Now <strong>{weather.wind} km/h</strong> · Dir <strong>{compass(weather.windDir)}</strong> · Peak <strong>{Math.max(...forecastHrs.map(h => h.wind || 0)).toFixed(0)} km/h</strong>
          </div>
        </div>
        <WindChart data={chartData} />
      </div>
      <div className="card">
        <div className="chart-hdr">
          <div className="chart-title">📊 Pressure Trend — Next 48h (MSL)</div>
          <div className="chart-meta">
            Now <strong>{weather.pressure} hPa</strong> · Min <strong>{Math.min(...forecastHrs.map(h => h.pressure || 9999)).toFixed(0)} hPa</strong> · {weather.pressure < 990 ? '⚠️ Below danger threshold' : 'Within safe range'}
          </div>
        </div>
        <PressureChart data={chartData} />
      </div>
    </div>
  )
}
