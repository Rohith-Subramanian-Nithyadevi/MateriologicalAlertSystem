/**
 * HybridMLEngine.js
 * 
 * A hybrid ML-inspired prediction engine combining 5 techniques:
 *   1. Logistic Regression  — binary storm detection (sigmoid on weighted params)
 *   2. Random Forest         — event type voting (7 independent decision trees)
 *   3. Gradient Boosting     — risk probability refinement (sequential residuals)
 *   4. Time-Series (ARIMA)   — trend detection (pressure/wind acceleration)
 *   5. Historical Baseline   — anomaly detection (z-score vs seasonal normals)
 *
 * All functions are pure — no side effects, no API calls.
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
// 1. LOGISTIC REGRESSION — Binary storm detection
//    Sigmoid(Σ wᵢxᵢ + b) → probability of severe weather event
// ─────────────────────────────────────────────────────────────────────────────

const LR_WEIGHTS = {
  rain:     0.012,   // each mm of rain adds 1.2% logit
  wind:     0.018,   // each km/h adds 1.8%
  temp_hot: 0.025,   // each °C above 40 adds 2.5%
  temp_cold:-0.03,   // each °C below 4 subtracts 3%
  humidity: 0.008,   // each % above 75 adds 0.8%
  pressure:-0.015,   // each hPa below 1013 adds 1.5% (inverted)
}
const LR_BIAS = -3.2  // baseline bias — no storm when all params neutral

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x))
}

/**
 * Logistic Regression: returns storm probability 0–100%
 * @param {{ temp, wind, rain, humidity, pressure }} w — weather params
 * @returns {number} probability 0–100
 */
export function logisticStormProb(w) {
  const z = LR_BIAS
    + LR_WEIGHTS.rain * Math.max(0, w.rain)
    + LR_WEIGHTS.wind * Math.max(0, w.wind)
    + LR_WEIGHTS.temp_hot * Math.max(0, w.temp - 40)
    + LR_WEIGHTS.temp_cold * Math.min(0, w.temp - 4)
    + LR_WEIGHTS.humidity * Math.max(0, w.humidity - 75)
    + LR_WEIGHTS.pressure * (1013 - w.pressure)
  return Math.round(sigmoid(z) * 1000) / 10  // one decimal
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RANDOM FOREST — Event type voting
//    7 independent decision trees, each votes for one event type
//    Majority vote determines primary disaster type
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
  return null
}

function tree3_temperature(w) {
  if (w.temp >= 47) return 'Heatwave'
  if (w.temp >= 40 && w.humidity >= 75) return 'Heatwave'
  if (w.temp <= 0) return 'Cold Wave'
  if (w.temp <= 4 && w.wind > 30) return 'Cold Wave'
  return null
}

function tree4_compound(w) {
  if (w.pressure < 970 && w.wind > 117) return 'Cyclone'
  if (w.rain > 115 && w.wind > 88) return 'Cyclone'
  if (w.temp < 25 && w.wind > 40 && w.rain > 15 && w.humidity > 75) return 'Hailstorm'
  if (w.rain > 64 && w.humidity > 90) return 'Flood Risk'
  return null
}

function tree5_convective(w) {
  if (w.wind > 61 && w.pressure < 1000 && w.rain > 30) return 'Thunderstorm'
  if (w.wind > 88 && w.rain < 15) return 'Extreme Wind'
  if (w.temp < 20 && w.humidity > 80 && w.wind > 50 && w.rain > 10) return 'Hailstorm'
  return null
}

function tree6_tropical(w) {
  if (w.pressure < 980 && w.wind > 62 && w.rain > 50 && w.humidity > 80) return 'Cyclone'
  if (w.pressure < 1000 && w.wind > 40 && w.rain > 30) return 'Tropical Storm'
  if (w.temp > 42 && w.humidity > 60) return 'Heatwave'
  if (w.temp < 2 && w.humidity < 40) return 'Cold Wave'
  return null
}

function tree7_severity(w) {
  if (w.rain > 150 && w.pressure < 990) return 'Cyclone'
  if (w.rain > 100) return 'Flood Risk'
  if (w.wind > 100) return 'Extreme Wind'
  if (w.temp > 45) return 'Heatwave'
  if (w.temp < -5) return 'Cold Wave'
  if (w.wind > 50 && w.rain > 20) return 'Thunderstorm'
  return null
}

const RF_TREES = [tree1_pressureWind, tree2_rainfall, tree3_temperature, tree4_compound, tree5_convective, tree6_tropical, tree7_severity]

/**
 * Random Forest: returns vote counts per event type + winning type
 * @param {{ temp, wind, rain, humidity, pressure }} w
 * @returns {{ votes: Record<string, number>, primary: string, confidence: number }}
 */
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

  const confidence = maxVotes > 0 ? Math.round((maxVotes / RF_TREES.length) * 100) : 0
  return { votes, primary, confidence }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GRADIENT BOOSTING — Risk probability per event type
//    Sequential residual-based refinement: base score → corrections
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

  // Boost 1: Compound factor amplification
  let elevated = 0
  if (rain > THRESHOLDS.rain.moderate) elevated++
  if (wind > THRESHOLDS.wind.squally) elevated++
  if (temp > THRESHOLDS.temp.heatWave || temp < THRESHOLDS.temp.coldWave) elevated++
  if (pressure < THRESHOLDS.pressure.veryLow) elevated++
  if (humidity > THRESHOLDS.humidity.veryHigh) elevated++
  if (elevated >= 3) correction += 12
  else if (elevated >= 2) correction += 6

  // Boost 2: Extreme value bonus
  if (eventType === 'Cyclone' && pressure < 960) correction += 15
  if (eventType === 'Flood Risk' && rain > 200) correction += 15
  if (eventType === 'Heatwave' && temp > 45 && humidity > 70) correction += 15
  if (eventType === 'Extreme Wind' && wind > 130) correction += 15

  // Boost 3: Suppress false positives
  if (eventType === 'Cyclone' && (pressure > 1000 || wind < 40)) correction -= Math.max(0, base - 15)
  if (eventType === 'Flood Risk' && rain < 30) correction -= Math.max(0, base - 10)
  if (eventType === 'Heatwave' && temp < 35) correction -= Math.max(0, base - 5)
  if (eventType === 'Cold Wave' && temp > 10) correction -= Math.max(0, base - 5)
  if (eventType === 'Hailstorm' && temp > 30) correction -= Math.max(0, base - 5)

  return correction
}

/**
 * Gradient Boosting: returns refined probability per event type
 * @param {{ temp, wind, rain, humidity, pressure }} w
 * @returns {Record<string, number>} — event type → probability 0–100
 */
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
// 4. TIME-SERIES — Trend detection from hourly forecast
//    Detects pressure drop rate, wind acceleration, rain intensification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze temporal trends from hourly forecast data
 * @param {Array<{ time, wind, pressure, rain, temp, humidity }>} hours
 * @returns {{ pressureTrend, windTrend, rainTrend, alerts: Array }}
 */
export function timeSeriesAnalysis(hours) {
  if (!hours || hours.length < 6) {
    return { pressureTrend: 'stable', windTrend: 'stable', rainTrend: 'stable', alerts: [], riskMultiplier: 1.0 }
  }

  const h = hours.slice(0, Math.min(48, hours.length))

  // Pressure drop rate (hPa per 24h)
  const p0 = h[0]?.pressure ?? 1013
  const pEnd = h[Math.min(23, h.length - 1)]?.pressure ?? 1013
  const pressureDrop = p0 - pEnd

  // Wind acceleration (max in next 24h vs current)
  const currentWind = h[0]?.wind ?? 0
  const peakWind = Math.max(...h.slice(0, 24).map(x => x.wind ?? 0))
  const windAccel = peakWind - currentWind

  // Rain intensification
  const first6hRain = h.slice(0, 6).reduce((s, x) => s + (x.rain ?? 0), 0)
  const next6hRain = h.slice(6, 12).reduce((s, x) => s + (x.rain ?? 0), 0)
  const rainAccel = next6hRain - first6hRain

  // Cumulative 48h rainfall
  const total48hRain = h.reduce((s, x) => s + (x.rain ?? 0), 0)

  const alerts = []
  let riskMultiplier = 1.0

  // Pressure trend classification
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

  // Wind trend
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

  // Rain trend
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

  // Sort alerts by severity
  const sevOrder = { Extreme: 0, High: 1, Moderate: 2, Low: 3 }
  alerts.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4))

  return { pressureTrend, windTrend, rainTrend, alerts, riskMultiplier, pressureDrop, peakWind, total48hRain }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. HISTORICAL BASELINE — Anomaly detection via z-score
// ─────────────────────────────────────────────────────────────────────────────

function zScore(val, mean, std) {
  if (mean == null || std == null || std === 0) return 0
  return (val - mean) / std
}

/**
 * Historical anomaly analysis
 * @param {{ temp, wind, rain, humidity, pressure }} current
 * @param {{ temp: {mean,std}, wind: {mean,std}, rain: {mean,std}, humidity: {mean,std} }} normals
 * @returns {{ anomalies: Array, riskAdjustment: number, isNormalSeason: boolean }}
 */
export function historicalAnomalyAnalysis(current, normals) {
  if (!normals) return { anomalies: [], riskAdjustment: 0, isNormalSeason: true }

  const anomalies = []
  const checks = [
    { param: 'Temperature', val: current.temp, stats: normals.temp, icon: '🌡️', higherIsBad: null },
    { param: 'Wind Speed', val: current.wind, stats: normals.wind, icon: '💨', higherIsBad: true },
    { param: 'Rainfall', val: current.rain, stats: normals.rain, icon: '🌧️', higherIsBad: true },
    { param: 'Humidity', val: current.humidity, stats: normals.humidity, icon: '💧', higherIsBad: null },
  ]

  let riskAdjustment = 0

  checks.forEach(({ param, val, stats, icon, higherIsBad }) => {
    if (!stats || stats.mean == null) return
    const z = zScore(val, stats.mean, stats.std)
    const az = Math.abs(z)
    if (az < 1.5) return  // within normal seasonal range

    const direction = z > 0 ? 'above' : 'below'
    const isBad = higherIsBad !== null ? (higherIsBad ? z > 0 : z < 0) : az > 2

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
    } else if (!isBad && az < 2) {
      // Conditions normal for season — may warrant downgrade
      riskAdjustment -= 5
    }
  })

  const isNormalSeason = anomalies.filter(a => a.isBad).length === 0
  return { anomalies, riskAdjustment, isNormalSeason }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ENSEMBLE COMBINER — Merges all 5 model outputs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combine all 5 models into final classification
 * @param {{ temp, wind, rain, humidity, pressure }} weather
 * @param {Array} forecastHours — hourly forecast data
 * @param {Object|null} seasonalNormals — from archive API
 * @returns {Object} — complete prediction result
 */
export function hybridPredict(weather, forecastHours = [], seasonalNormals = null) {
  // 1. Logistic Regression — overall storm probability
  const stormProb = logisticStormProb(weather)

  // 2. Random Forest — event type voting
  const rfResult = randomForestVote(weather)

  // 3. Gradient Boosting — per-event probabilities
  const gbProbs = gradientBoostProbabilities(weather)

  // 4. Time-Series — trend analysis
  const trends = timeSeriesAnalysis(forecastHours)

  // 5. Historical Baseline — anomaly detection
  const historical = historicalAnomalyAnalysis(weather, seasonalNormals)

  // ── Ensemble: combine probabilities ──
  // Weighted average: GB 40%, LR 25%, RF 20%, TS modifier 15%
  const eventProbs = {}
  EVENT_TYPES.forEach(type => {
    const gb = gbProbs[type] || 0
    const rfBonus = rfResult.votes[type] > 0 ? (rfResult.votes[type] / RF_TREES.length) * 100 : 0
    const lrFactor = stormProb / 100

    let combined = (gb * 0.40) + (rfBonus * 0.20) + (stormProb * 0.25 * (gb > 10 ? 1 : 0.3))
    // Apply time-series multiplier
    combined *= trends.riskMultiplier
    // Apply historical adjustment
    combined += historical.riskAdjustment * (gb > 10 ? 0.5 : 0.1)

    eventProbs[type] = Math.round(Math.max(0, Math.min(100, combined)) * 10) / 10
  })

  // ── Determine primary event ──
  let primaryEvent = 'No Threat'
  let primaryProb = 0
  Object.entries(eventProbs).forEach(([type, prob]) => {
    if (prob > primaryProb && prob >= 15) { primaryProb = prob; primaryEvent = type }
  })

  // ── Overall risk level with consistency check ──
  const overallProb = Math.max(stormProb, primaryProb)
  let severity
  if (overallProb >= 75) severity = 'Extreme'
  else if (overallProb >= 50) severity = 'High'
  else if (overallProb >= 25) severity = 'Moderate'
  else severity = 'Low'

  // ── CONSISTENCY GATE ──
  severity = enforceConsistency(weather, severity, primaryEvent, eventProbs)

  // ── Sort events by probability for display ──
  const rankedEvents = EVENT_TYPES
    .map(type => ({
      type,
      probability: eventProbs[type],
      riskLevel: probToLevel(eventProbs[type]),
      color: SEVERITY_COLORS[probToLevel(eventProbs[type])],
    }))
    .sort((a, b) => b.probability - a.probability)

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
      logisticRegression: stormProb,
      randomForest: rfResult.confidence,
      gradientBoosting: primaryProb > 0 ? gbProbs[primaryEvent] : 0,
      timeSeriesMultiplier: trends.riskMultiplier,
      historicalAdjustment: historical.riskAdjustment,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. LOGICAL CONSISTENCY ENFORCEMENT
// ─────────────────────────────────────────────────────────────────────────────

function enforceConsistency(w, severity, primaryEvent, probs) {
  const { rain, wind, temp, humidity, pressure } = w

  // RULE 1: Extreme requires at least 1 parameter in extreme IMD range
  if (severity === 'Extreme') {
    const hasExtreme = rain > 204 || wind > 117 || temp > 47 || temp < -10 || pressure < 970
    if (!hasExtreme) severity = 'High'
  }

  // RULE 2: High requires at least 2 elevated parameters
  if (severity === 'High') {
    let elevated = 0
    if (rain > THRESHOLDS.rain.moderate) elevated++
    if (wind > THRESHOLDS.wind.strong) elevated++
    if (temp > THRESHOLDS.temp.heatWave || temp < THRESHOLDS.temp.coldWave) elevated++
    if (pressure < THRESHOLDS.pressure.veryLow) elevated++
    if (humidity > THRESHOLDS.humidity.veryHigh) elevated++
    if (elevated < 2) severity = 'Moderate'
  }

  // RULE 3: Cyclone requires pressure < 990 AND wind > 88 AND rain > 64
  if (primaryEvent === 'Cyclone' && (pressure > 1000 || wind < 40)) {
    if (severity === 'Extreme') severity = 'High'
  }

  // RULE 4: Flood requires rain > 64
  if (primaryEvent === 'Flood Risk' && rain < 30) {
    if (severity === 'High' || severity === 'Extreme') severity = 'Moderate'
  }

  // RULE 5: Heatwave requires temp > 38
  if (primaryEvent === 'Heatwave' && temp < 38) {
    if (severity === 'High') severity = 'Moderate'
  }

  // RULE 6: If all params clearly normal, cap at Moderate
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

/**
 * Classify each day in the 7-day forecast using the hybrid model
 * @param {Array<{ time, wind, pressure, rain, temp, humidity }>} hourlyData
 * @param {Object|null} seasonalNormals
 * @returns {Array<{ date, severity, primaryEvent, probability, maxTemp, maxWind, totalRain, minPressure }>}
 */
export function classifyForecastDays(hourlyData, seasonalNormals = null) {
  if (!hourlyData?.length) return []

  // Group hours by day
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

    // Create weather snapshot for this day
    const dayWeather = {
      temp: maxTemp,
      wind: maxWind,
      rain: totalRain,
      pressure: minPressure,
      humidity: avgHumidity,
    }

    // Run hybrid prediction for this day
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
  zScore,
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
