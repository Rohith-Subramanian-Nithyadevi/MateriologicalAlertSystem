/**
 * HybridRuleEngine.js
 *
 * A hybrid rule-based prediction engine combining 5 deterministic techniques
 * inspired by statistical and ML concepts (but using NO actual machine learning,
 * NO training, NO datasets, and NO ML libraries):
 *
 *   1. Sigmoid Scoring       — 9 per-disaster rule sets (one sigmoid per event type)
 *   2. Decision Tree Voting  — event type voting (7 independent hardcoded decision trees)
 *   3. Weighted Scoring      — risk probability refinement (sequential score corrections)
 *   4. Time-Series Rules     — trend detection (pressure/wind acceleration thresholds)
 *   5. Historical Baseline   — anomaly detection (z-score vs seasonal normals)
 *
 * All functions are pure — no side effects, no API calls.
 * All thresholds are manually tuned based on IMD/WMO meteorological standards.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & THRESHOLDS  (IMD / WMO standards)
// ─────────────────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  rain:     { light: 15.5, moderate: 64.4, heavy: 115.5, veryHeavy: 204.4 },
  wind:     { strong: 40, squally: 61, gale: 88, storm: 117 },
  temp:     { coldWave: 4, severeCold: 0, heatWave: 40, severeHeat: 47 },
  humidity: { high: 75, veryHigh: 90 },
  pressure: { low: 1005, veryLow: 990, extreme: 970 },
}

const EVENT_TYPES = [
  'Thunderstorm', 'Cyclone', 'Tropical Storm', 'Hailstorm',
  'Flood Risk', 'Heatwave', 'Heavy Rainfall', 'Extreme Wind', 'Cold Wave',
]

const SEVERITY_ORDER = ['Low', 'Moderate', 'High', 'Extreme']
const SEVERITY_COLORS = { Low: '#4ade80', Moderate: '#fbbf24', High: '#fb923c', Extreme: '#f87171' }

// ─────────────────────────────────────────────────────────────────────────────
// 1. SIGMOID SCORING — One rule set per disaster type
//
//    Each rule set has its own manually-tuned weights for the signals that
//    matter for THAT specific hazard. sigmoid(z) -> score 0-100%.
//    Math.max(0, x - threshold) = "how far above threshold am I?" (relu-like)
// ─────────────────────────────────────────────────────────────────────────────

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x))
}

function lr(z) {
  return Math.round(sigmoid(z) * 1000) / 10
}

// Thunderstorm: wind + rain together + falling pressure
function lr_thunderstorm(w) {
  const z = -3.5
    + 0.020 * Math.max(0, w.wind - 20)
    + 0.015 * Math.max(0, w.rain - 10)
    + 0.020 * Math.max(0, 1013 - w.pressure)
    + 0.006 * Math.max(0, w.humidity - 70)
  return lr(z)
}

// Cyclone: extreme pressure drop + strong wind + heavy rain
function lr_cyclone(w) {
  const z = -5.0
    + 0.060 * Math.max(0, 1013 - w.pressure)
    + 0.025 * Math.max(0, w.wind - 60)
    + 0.012 * Math.max(0, w.rain - 50)
    + 0.008 * Math.max(0, w.humidity - 80)
  return lr(z)
}

// Tropical Storm: like cyclone but lower thresholds
function lr_tropicalStorm(w) {
  const z = -4.0
    + 0.040 * Math.max(0, 1013 - w.pressure)
    + 0.018 * Math.max(0, w.wind - 40)
    + 0.010 * Math.max(0, w.rain - 30)
    + 0.007 * Math.max(0, w.humidity - 75)
  return lr(z)
}

// Hailstorm: cold air + wind shear + moderate rain + high humidity
function lr_hailstorm(w) {
  const z = -4.5
    + 0.050 * Math.max(0, 25 - w.temp)
    + 0.020 * Math.max(0, w.wind - 30)
    + 0.015 * Math.max(0, w.rain - 10)
    + 0.012 * Math.max(0, w.humidity - 70)
    + 0.010 * Math.max(0, 1013 - w.pressure)
  return lr(z)
}

// Flood Risk: rainfall accumulation is the overwhelming signal
function lr_floodRisk(w) {
  const z = -3.8
    + 0.025 * Math.max(0, w.rain - 20)
    + 0.015 * Math.max(0, w.rain - 64)
    + 0.010 * Math.max(0, w.humidity - 80)
    + 0.008 * Math.max(0, 1013 - w.pressure)
  return lr(z)
}

// Heatwave: temperature + humidity; wind provides slight relief
function lr_heatwave(w) {
  const z = -4.2
    + 0.080 * Math.max(0, w.temp - 35)
    + 0.020 * Math.max(0, w.temp - 40)
    + 0.015 * Math.max(0, w.humidity - 60)
    - 0.010 * Math.max(0, w.wind - 10)
  return lr(z)
}

// Heavy Rainfall: lower rain threshold than flood, no pressure needed
function lr_heavyRainfall(w) {
  const z = -3.2
    + 0.022 * Math.max(0, w.rain - 15)
    + 0.010 * Math.max(0, w.humidity - 75)
    + 0.006 * Math.max(0, 1013 - w.pressure)
  return lr(z)
}

// Extreme Wind: wind dominates entirely
function lr_extremeWind(w) {
  const z = -4.0
    + 0.035 * Math.max(0, w.wind - 50)
    + 0.020 * Math.max(0, w.wind - 88)
    + 0.015 * Math.max(0, 1013 - w.pressure)
  return lr(z)
}

// Cold Wave: cold temp is the signal; wind chill amplifies it
function lr_coldWave(w) {
  const z = -3.5
    + 0.080 * Math.max(0, 10 - w.temp)
    + 0.020 * Math.max(0, 0 - w.temp)
    + 0.010 * Math.max(0, w.wind - 15)
  return lr(z)
}

/**
 * Run ALL 9 sigmoid scoring rule sets — returns per-disaster score + overall max.
 */
export function logisticRegressionAll(w) {
  const perEvent = {
    'Thunderstorm':   lr_thunderstorm(w),
    'Cyclone':        lr_cyclone(w),
    'Tropical Storm': lr_tropicalStorm(w),
    'Hailstorm':      lr_hailstorm(w),
    'Flood Risk':     lr_floodRisk(w),
    'Heatwave':       lr_heatwave(w),
    'Heavy Rainfall': lr_heavyRainfall(w),
    'Extreme Wind':   lr_extremeWind(w),
    'Cold Wave':      lr_coldWave(w),
  }
  const overall = Math.round(Math.max(...Object.values(perEvent)) * 10) / 10
  return { perEvent, overall }
}

// Backward-compatible export — returns highest sigmoid score across all rule sets
export function logisticStormProb(w) {
  return logisticRegressionAll(w).overall
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DECISION TREE VOTING — Event type voting via hardcoded decision trees
// ─────────────────────────────────────────────────────────────────────────────

function tree1_pressureWind(w) {
  if (w.pressure < 970 && w.wind > 88 && w.rain > 64) return 'Cyclone'
  if (w.pressure < 990 && w.wind > 62) return 'Tropical Storm'
  if (w.wind > 117) return 'Extreme Wind'
  if (w.wind > 40 && w.rain > 15 && w.pressure < 1005) return 'Thunderstorm'
  return null
}

function tree2_rainfall(w) {
  if (w.rain > 204) return 'Flood Risk'
  if (w.rain > 115) return 'Heavy Rainfall'
  if (w.rain > 64 && w.pressure < 1005) return 'Flood Risk'
  if (w.rain > 15 && w.wind > 40) return 'Thunderstorm'
  if (w.rain > 30) return 'Heavy Rainfall'
  return null
}

function tree3_temperature(w) {
  if (w.temp >= 47) return 'Heatwave'
  if (w.temp >= 40 && w.humidity >= 75) return 'Heatwave'
  if (w.temp >= 38) return 'Heatwave'
  if (w.temp <= 0) return 'Cold Wave'
  if (w.temp <= 4 && w.wind > 30) return 'Cold Wave'
  if (w.temp <= 8) return 'Cold Wave'
  return null
}

function tree4_compound(w) {
  if (w.pressure < 970 && w.wind > 117) return 'Cyclone'
  if (w.rain > 115 && w.wind > 88) return 'Cyclone'
  if (w.temp < 25 && w.wind > 40 && w.rain > 15 && w.humidity > 75) return 'Hailstorm'
  if (w.rain > 64 && w.humidity > 90) return 'Flood Risk'
  if (w.rain > 30 && w.humidity > 85) return 'Heavy Rainfall'
  if (w.temp > 35 && w.humidity > 70) return 'Heatwave'
  return null
}

function tree5_convective(w) {
  if (w.wind > 61 && w.pressure < 1000 && w.rain > 30) return 'Thunderstorm'
  if (w.wind > 88 && w.rain < 15) return 'Extreme Wind'
  if (w.temp < 20 && w.humidity > 80 && w.wind > 50 && w.rain > 10) return 'Hailstorm'
  if (w.wind > 35 && w.rain > 15) return 'Thunderstorm'
  return null
}

function tree6_tropical(w) {
  if (w.pressure < 980 && w.wind > 62 && w.rain > 50 && w.humidity > 80) return 'Cyclone'
  if (w.pressure < 1000 && w.wind > 40 && w.rain > 30) return 'Tropical Storm'
  if (w.temp > 42 && w.humidity > 60) return 'Heatwave'
  if (w.temp < 2 && w.humidity < 40) return 'Cold Wave'
  if (w.humidity > 88 && w.rain > 15) return 'Heavy Rainfall'
  if (w.temp > 36 && w.humidity > 65) return 'Heatwave'
  return null
}

function tree7_severity(w) {
  if (w.rain > 150 && w.pressure < 990) return 'Cyclone'
  if (w.rain > 100) return 'Flood Risk'
  if (w.wind > 100) return 'Extreme Wind'
  if (w.temp > 45) return 'Heatwave'
  if (w.temp < -5) return 'Cold Wave'
  if (w.wind > 50 && w.rain > 20) return 'Thunderstorm'
  if (w.rain > 40) return 'Heavy Rainfall'
  if (w.temp > 37) return 'Heatwave'
  return null
}

const RF_TREES = [tree1_pressureWind, tree2_rainfall, tree3_temperature, tree4_compound, tree5_convective, tree6_tropical, tree7_severity]

export function randomForestVote(w) {
  const votes = {}
  EVENT_TYPES.forEach(t => { votes[t] = 0 })

  RF_TREES.forEach(tree => {
    const result = tree(w)
    if (result && votes[result] !== undefined) votes[result]++
  })

  let primary = 'No Threat'
  let maxVotes = 0
  Object.entries(votes).forEach(([type, count]) => {
    if (count > maxVotes) { maxVotes = count; primary = type }
  })

  // FIX: confidence = total votes cast (not just winner's share), so it reflects
  // how many trees fired at all. Show as percentage of trees that voted for anything.
  const totalVotes = Object.values(votes).reduce((s, v) => s + v, 0)
  const confidence = totalVotes > 0 ? Math.round((maxVotes / RF_TREES.length) * 100) : 0

  return { votes, primary, confidence, totalVotes, maxVotes }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. WEIGHTED SCORING — Risk score per event type with boost corrections
// ─────────────────────────────────────────────────────────────────────────────

function baseScore(w, eventType) {
  const { rain, wind, temp, humidity, pressure } = w
  switch (eventType) {
    case 'Thunderstorm':
      return (Math.min(wind, 100) / 100 * 30) + (Math.min(rain, 80) / 80 * 25) + (Math.max(0, 1013 - pressure) / 30 * 25) + (humidity > 70 ? 10 : 0)
    case 'Cyclone':
      return (Math.max(0, 1013 - pressure) / 50 * 35) + (Math.min(wind, 150) / 150 * 30) + (Math.min(rain, 250) / 250 * 25) + (humidity > 80 ? 10 : 0)
    case 'Tropical Storm':
      return (Math.max(0, 1013 - pressure) / 40 * 30) + (Math.min(wind, 120) / 120 * 30) + (Math.min(rain, 150) / 150 * 25) + (humidity > 75 ? 15 : 0)
    case 'Hailstorm':
      return (temp < 25 ? (25 - temp) / 20 * 25 : 0) + (Math.min(wind, 80) / 80 * 25) + (Math.min(rain, 50) / 50 * 20) + (humidity > 75 ? 20 : 0) + (pressure < 1005 ? 10 : 0)
    case 'Flood Risk':
      return (Math.min(rain, 250) / 250 * 50) + (humidity > 80 ? 15 : 0) + (Math.max(0, 1013 - pressure) / 40 * 15) + (wind > 40 ? 10 : 0)
    case 'Heatwave':
      return (temp > 35 ? Math.min((temp - 35) / 15 * 50, 50) : 0) + (humidity > 60 ? Math.min((humidity - 60) / 35 * 30, 30) : 0) + (wind < 15 ? 10 : 0)
    case 'Heavy Rainfall':
      return (Math.min(rain, 200) / 200 * 55) + (humidity > 80 ? 20 : 0) + (Math.max(0, 1013 - pressure) / 30 * 15) + (wind > 30 ? 10 : 0)
    case 'Extreme Wind':
      return (Math.min(wind, 150) / 150 * 55) + (Math.max(0, 1013 - pressure) / 40 * 25) + (rain > 30 ? 10 : 0)
    case 'Cold Wave':
      return (temp < 10 ? Math.min((10 - temp) / 20 * 50, 50) : 0) + (wind > 20 ? Math.min(wind / 60 * 20, 20) : 0) + (humidity < 40 ? 15 : 0)
    default:
      return 0
  }
}

function boostCorrection(w, eventType, base) {
  const { rain, wind, temp, humidity, pressure } = w
  let correction = 0

  let elevated = 0
  if (rain > THRESHOLDS.rain.moderate) elevated++
  if (wind > THRESHOLDS.wind.squally) elevated++
  if (temp > THRESHOLDS.temp.heatWave || temp < THRESHOLDS.temp.coldWave) elevated++
  if (pressure < THRESHOLDS.pressure.veryLow) elevated++
  if (humidity > THRESHOLDS.humidity.veryHigh) elevated++
  if (elevated >= 3) correction += 12
  else if (elevated >= 2) correction += 6

  if (eventType === 'Cyclone' && pressure < 960) correction += 15
  if (eventType === 'Flood Risk' && rain > 200) correction += 15
  if (eventType === 'Heatwave' && temp > 45 && humidity > 70) correction += 15
  if (eventType === 'Extreme Wind' && wind > 130) correction += 15

  if (eventType === 'Cyclone' && (pressure > 1000 || wind < 40)) correction -= Math.max(0, base - 15)
  if (eventType === 'Flood Risk' && rain < 30) correction -= Math.max(0, base - 10)
  if (eventType === 'Heatwave' && temp < 35) correction -= Math.max(0, base - 5)
  if (eventType === 'Cold Wave' && temp > 10) correction -= Math.max(0, base - 5)
  if (eventType === 'Hailstorm' && temp > 30) correction -= Math.max(0, base - 5)

  return correction
}

export function gradientBoostProbabilities(w) {
  const probs = {}
  EVENT_TYPES.forEach(eventType => {
    const base = baseScore(w, eventType)
    const correction = boostCorrection(w, eventType, base)
    probs[eventType] = Math.round(Math.max(0, Math.min(100, base + correction)) * 10) / 10
  })
  return probs
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TIME-SERIES RULES — Trend detection from hourly forecast
// ─────────────────────────────────────────────────────────────────────────────

export function timeSeriesAnalysis(hours) {
  if (!hours || hours.length < 6) {
    return { pressureTrend: 'stable', windTrend: 'stable', rainTrend: 'stable', alerts: [], riskMultiplier: 1.0 }
  }

  const h = hours.slice(0, Math.min(48, hours.length))

  const p0 = h[0]?.pressure ?? 1013
  const pEnd = h[Math.min(23, h.length - 1)]?.pressure ?? 1013
  const pressureDrop = p0 - pEnd

  const currentWind = h[0]?.wind ?? 0
  const peakWind = Math.max(...h.slice(0, 24).map(x => x.wind ?? 0))
  const windAccel = peakWind - currentWind

  const first6hRain = h.slice(0, 6).reduce((s, x) => s + (x.rain ?? 0), 0)
  const next6hRain = h.slice(6, 12).reduce((s, x) => s + (x.rain ?? 0), 0)
  const rainAccel = next6hRain - first6hRain

  const total48hRain = h.reduce((s, x) => s + (x.rain ?? 0), 0)

  const alerts = []
  let riskMultiplier = 1.0

  let pressureTrend = 'stable'
  if (pressureDrop > 20) {
    pressureTrend = 'explosive_drop'
    alerts.push({ icon: '🌀', severity: 'Extreme', msg: `Explosive cyclogenesis — pressure falling ${pressureDrop.toFixed(1)} hPa/24h`, timeframe: '0–24h' })
    riskMultiplier *= 1.5
  } else if (pressureDrop > 10) {
    pressureTrend = 'rapid_drop'
    alerts.push({ icon: '📉', severity: 'High', msg: `Rapid pressure drop ${pressureDrop.toFixed(1)} hPa/24h — active storm system`, timeframe: '0–24h' })
    riskMultiplier *= 1.3
  } else if (pressureDrop > 5) {
    pressureTrend = 'falling'
    alerts.push({ icon: '⬇️', severity: 'Moderate', msg: `Pressure falling ${pressureDrop.toFixed(1)} hPa/24h — conditions deteriorating`, timeframe: '0–24h' })
    riskMultiplier *= 1.15
  } else if (pressureDrop < -5) {
    pressureTrend = 'rising'
  }

  let windTrend = 'stable'
  if (windAccel > 40) {
    windTrend = 'surging'
    const peakIdx = h.findIndex(x => x.wind === peakWind)
    alerts.push({ icon: '🌪️', severity: 'High', msg: `Storm-force winds (~${peakWind.toFixed(0)} km/h) expected in ~${peakIdx}h`, timeframe: `${peakIdx}h` })
    riskMultiplier *= 1.25
  } else if (windAccel > 20) {
    windTrend = 'increasing'
    alerts.push({ icon: '💨', severity: 'Moderate', msg: `Wind increasing by ${windAccel.toFixed(0)} km/h — peak ${peakWind.toFixed(0)} km/h`, timeframe: '0–24h' })
    riskMultiplier *= 1.1
  } else if (windAccel < -20) {
    windTrend = 'decreasing'
  }

  let rainTrend = 'stable'
  if (total48hRain > 200) {
    rainTrend = 'extreme'
    alerts.push({ icon: '🌧️', severity: 'High', msg: `Cumulative ${total48hRain.toFixed(0)}mm over 48h — flash flood risk`, timeframe: '0–48h' })
    riskMultiplier *= 1.3
  } else if (total48hRain > 100) {
    rainTrend = 'heavy'
    alerts.push({ icon: '🌦️', severity: 'Moderate', msg: `Heavy rainfall (~${total48hRain.toFixed(0)}mm) expected over 48h`, timeframe: '0–48h' })
    riskMultiplier *= 1.1
  }
  if (rainAccel > 10) {
    rainTrend = rainTrend === 'stable' ? 'intensifying' : rainTrend
    alerts.push({ icon: '⬆️', severity: 'Moderate', msg: `Rainfall intensifying — next 6h has ${next6hRain.toFixed(1)}mm vs current ${first6hRain.toFixed(1)}mm`, timeframe: '6–12h' })
  }

  const sevOrder = { Extreme: 0, High: 1, Moderate: 2, Low: 3 }
  alerts.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))

  return { pressureTrend, windTrend, rainTrend, alerts, riskMultiplier, pressureDrop, peakWind, total48hRain }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. HISTORICAL BASELINE — Anomaly detection via z-score
// ─────────────────────────────────────────────────────────────────────────────

export function zScore(val, mean, std) {
  if (mean == null || std == null || std === 0) return 0
  return (val - mean) / std
}

export function historicalAnomalyAnalysis(current, normals) {
  if (!normals) return { anomalies: [], riskAdjustment: 0, isNormalSeason: true }

  const anomalies = []
  const checks = [
    // Temperature: only flag as BAD if it also crosses an absolute danger threshold
    // Statistical anomaly alone is not enough — 31°C in Chennai being 3σ above
    // March average is NOT dangerous, it's just a warm day
    { param: 'Temperature', val: current.temp, stats: normals.temp, icon: '🌡️', higherIsBad: 'both' },
    // Wind: higher is worse
    { param: 'Wind Speed', val: current.wind, stats: normals.wind, icon: '💨', higherIsBad: true },
    // Rainfall: higher is worse
    { param: 'Rainfall', val: current.rain, stats: normals.rain, icon: '🌧️', higherIsBad: true },
    // Humidity: ONLY high humidity is bad (low humidity is comfortable, not a hazard)
    { param: 'Humidity', val: current.humidity, stats: normals.humidity, icon: '💧', higherIsBad: true },
  ]

  let riskAdjustment = 0

  checks.forEach(({ param, val, stats, icon, higherIsBad }) => {
    if (!stats || stats.mean == null) return
    const z = zScore(val, stats.mean, stats.std)
    const az = Math.abs(z)
    if (az < 1.5) return

    const direction = z > 0 ? 'above' : 'below'

    // isBad logic with ABSOLUTE SAFETY CHECKS
    // Statistical anomaly only counts as "bad" if absolute value is also dangerous
    let isBad = false
    if (param === 'Temperature') {
      // Temperature anomaly is bad ONLY if it also crosses absolute danger zone
      // Hot: statistically high AND actually hot (>38°C)
      // Cold: statistically low AND actually cold (<5°C)
      const absolutelyHot  = current.temp > 38
      const absolutelyCold = current.temp < 5
      isBad = (z > 0 && absolutelyHot) || (z < 0 && absolutelyCold)
    } else if (param === 'Humidity') {
      // Humidity only dangerous when HIGH (causes heat stress)
      // Low humidity is NOT a weather hazard on its own
      isBad = z > 0 && current.humidity > 85
    } else {
      // Wind and Rain: higher than normal is always worse
      isBad = higherIsBad ? z > 0 : z < 0
    }

    let level, label, color
    if (az >= 3) { level = 'extreme'; label = 'Extremely'; color = '#f87171' }
    else if (az >= 2) { level = 'high'; label = 'Notably'; color = '#fb923c' }
    else { level = 'moderate'; label = 'Slightly'; color = '#fbbf24' }

    anomalies.push({
      param, z: Math.round(z * 10) / 10, direction, level, label, color, icon, isBad,
      msg: `${Math.abs(z).toFixed(1)}σ ${direction} seasonal mean (${stats.mean})`,
    })

    if (isBad) {
      if (az >= 3) riskAdjustment += 15
      else if (az >= 2) riskAdjustment += 8
      else riskAdjustment += 3
    }
    // No downgrade adjustment — leave that to seasonalSeverity
  })

  const isNormalSeason = anomalies.filter(a => a.isBad).length === 0
  return { anomalies, riskAdjustment, isNormalSeason }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMPOSITE SCORE COMBINER
// ─────────────────────────────────────────────────────────────────────────────

export function hybridPredict(weather, forecastHours = [], seasonalNormals = null) {
  // 1. Sigmoid Scoring — per-disaster (9 rule sets)
  const lrResult = logisticRegressionAll(weather)
  const stormProb = lrResult.overall   // keep for backward compat / overall risk

  // 2. Decision Tree Voting
  const rfResult = randomForestVote(weather)

  // 3. Weighted Scoring — computed BEFORE determining primaryEvent
  const gbProbs = gradientBoostProbabilities(weather)

  // 4. Time-Series Rules
  const trends = timeSeriesAnalysis(forecastHours)

  // 5. Historical Baseline
  const historical = historicalAnomalyAnalysis(weather, seasonalNormals)

  // ── Composite: combine all 5 scoring techniques per event type ──
  // Weights: Weighted 35%, Sigmoid per-event 25%, Tree Vote 20%, TS modifier, Historical adj
  const eventProbs = {}
  EVENT_TYPES.forEach(type => {
    const gb  = gbProbs[type] || 0
    const lrP = lrResult.perEvent[type] || 0                           // per-disaster LR
    const rfBonus = rfResult.votes[type] > 0
      ? (rfResult.votes[type] / RF_TREES.length) * 100
      : 0

    let combined = (gb * 0.35) + (lrP * 0.25) + (rfBonus * 0.20)
    // Time-series multiplier amplifies when trends are worsening
    combined *= trends.riskMultiplier
    // Historical adjustment adds/subtracts based on seasonal anomaly
    combined += historical.riskAdjustment * (gb > 10 ? 0.5 : 0.1)

    eventProbs[type] = Math.round(Math.max(0, Math.min(100, combined)) * 10) / 10
  })

  // ── Determine primary event from ensemble probs ──
  let primaryEvent = 'No Threat'
  let primaryProb = 0
  Object.entries(eventProbs).forEach(([type, prob]) => {
    if (prob > primaryProb && prob >= 15) { primaryProb = prob; primaryEvent = type }
  })

  // ── Overall risk ──
  const overallProb = Math.max(stormProb, primaryProb)
  let severity
  if (overallProb >= 75) severity = 'Extreme'
  else if (overallProb >= 50) severity = 'High'
  else if (overallProb >= 25) severity = 'Moderate'
  else severity = 'Low'

  severity = enforceConsistency(weather, severity, primaryEvent, eventProbs)

  // ── Sort events ──
  const rankedEvents = EVENT_TYPES
    .map(type => ({
      type,
      probability: eventProbs[type],
      riskLevel: probToLevel(eventProbs[type]),
      color: SEVERITY_COLORS[probToLevel(eventProbs[type])],
    }))
    .sort((a, b) => b.probability - a.probability)

  // ── Compute scoring technique contributions with fallbacks so nothing shows as 0 ──

  // Decision Trees: percentage of trees that voted for ANY event (activity level)
  const rfActivityPct = Math.round((rfResult.totalVotes / RF_TREES.length) * 100)

  // Weighted Scoring: highest score among all event types (best signal found)
  const topGbScore = Math.max(...EVENT_TYPES.map(t => gbProbs[t] || 0))
  // Also get the weighted score for the primary event specifically (or top if no threat)
  const gbPrimaryScore = primaryEvent !== 'No Threat'
    ? (gbProbs[primaryEvent] ?? topGbScore)
    : topGbScore

  // Time-Series: convert multiplier to a percentage change for readability
  // 1.0 = no change = 0%, 1.5 = +50% boost etc. Cap display at the actual value.
  const tsMultiplier = Math.round(trends.riskMultiplier * 100) / 100  // keep 2dp

  // Historical: pass through (already computed; 0 when no normals available)
  const histAdj = historical.riskAdjustment

  return {
    severity,
    overallProbability: Math.round(overallProb * 10) / 10,
    primaryEvent,
    primaryEventProbability: primaryProb,
    eventProbabilities: eventProbs,
    rankedEvents,
    stormProbability: stormProb,
    rfResult,
    trends,
    historical,
    modelContributions: {
      // LR: overall max + top event name + full per-event breakdown
      logisticRegression: stormProb,
      lrTopEvent: Object.entries(lrResult.perEvent).reduce((a, b) => a[1] > b[1] ? a : b)[0],
      lrTopScore: Math.round(Math.max(...Object.values(lrResult.perEvent)) * 10) / 10,
      lrPerEvent: lrResult.perEvent,
      // RF
      randomForest: rfResult.confidence,
      randomForestActivity: rfActivityPct,
      rfPrimary: rfResult.primary,
      // GB
      gradientBoosting: Math.round(gbPrimaryScore * 10) / 10,
      gradientBoostingTop: Math.round(topGbScore * 10) / 10,
      // Time-Series
      timeSeriesMultiplier: tsMultiplier,
      timeSeriesPressureDrop: Math.round((trends.pressureDrop ?? 0) * 10) / 10,
      timeSeriesPeakWind: Math.round(trends.peakWind ?? 0),
      // Historical
      historicalAdjustment: histAdj,
      historicalAnomalyCount: historical.anomalies.filter(a => a.isBad).length,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. LOGICAL CONSISTENCY ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────

function enforceConsistency(w, severity, primaryEvent, probs) {
  const { rain, wind, temp, humidity, pressure } = w

  if (severity === 'Extreme') {
    const hasExtreme = rain > 204 || wind > 117 || temp > 47 || temp < -10 || pressure < 970
    if (!hasExtreme) severity = 'High'
  }

  if (severity === 'High') {
    let elevated = 0
    if (rain > THRESHOLDS.rain.moderate) elevated++
    if (wind > THRESHOLDS.wind.strong) elevated++
    if (temp > THRESHOLDS.temp.heatWave || temp < THRESHOLDS.temp.coldWave) elevated++
    if (pressure < THRESHOLDS.pressure.veryLow) elevated++
    if (humidity > THRESHOLDS.humidity.veryHigh) elevated++
    if (elevated < 2) severity = 'Moderate'
  }

  if (primaryEvent === 'Cyclone' && (pressure > 1000 || wind < 40)) {
    if (severity === 'Extreme') severity = 'High'
  }

  if (primaryEvent === 'Flood Risk' && rain < 30) {
    if (severity === 'High' || severity === 'Extreme') severity = 'Moderate'
  }

  if (primaryEvent === 'Heatwave' && temp < 38) {
    if (severity === 'High') severity = 'Moderate'
  }

  const allNormal = rain < 15 && wind < 30 && temp > 5 && temp < 38 && pressure > 1005 && humidity < 85
  if (allNormal && (severity === 'High' || severity === 'Extreme')) {
    severity = 'Moderate'
  }

  return severity
}

function probToLevel(prob) {
  if (prob >= 75) return 'Extreme'
  if (prob >= 50) return 'High'
  if (prob >= 25) return 'Moderate'
  return 'Low'
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. 7-DAY FORECAST CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export function classifyForecastDays(hourlyData, seasonalNormals = null) {
  if (!hourlyData?.length) return []

  const days = {}
  hourlyData.forEach(h => {
    const date = new Date(h.time)
    const key = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (!days[key]) days[key] = []
    days[key].push(h)
  })

  return Object.entries(days).map(([date, hours]) => {
    const maxTemp = Math.max(...hours.map(h => h.temp ?? 0))
    const maxWind = Math.max(...hours.map(h => h.wind ?? 0))
    const totalRain = hours.reduce((s, h) => s + (h.rain ?? 0), 0)
    const minPressure = Math.min(...hours.map(h => h.pressure ?? 9999))
    const avgHumidity = hours.reduce((s, h) => s + (h.humidity ?? 50), 0) / hours.length

    const dayWeather = {
      temp: maxTemp,
      wind: maxWind,
      rain: totalRain,
      pressure: minPressure,
      humidity: avgHumidity,
    }

    const prediction = hybridPredict(dayWeather, hours, seasonalNormals)

    return {
      date,
      severity: prediction.severity,
      primaryEvent: prediction.primaryEvent,
      probability: prediction.overallProbability,
      eventProbabilities: prediction.eventProbabilities,
      maxTemp: Math.round(maxTemp * 10) / 10,
      maxWind: Math.round(maxWind * 10) / 10,
      totalRain: Math.round(totalRain * 10) / 10,
      minPressure: Math.round(minPressure * 10) / 10,
      avgHumidity: Math.round(avgHumidity),
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export {
  EVENT_TYPES,
  SEVERITY_ORDER,
  SEVERITY_COLORS,
  THRESHOLDS,
  probToLevel,
}

export default {
  hybridPredict,
  classifyForecastDays,
  logisticStormProb,
  randomForestVote,
  gradientBoostProbabilities,
  timeSeriesAnalysis,
  historicalAnomalyAnalysis,
}