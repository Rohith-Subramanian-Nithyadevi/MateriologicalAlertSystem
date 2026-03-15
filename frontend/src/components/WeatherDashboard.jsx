import { useState, useEffect, useCallback } from 'react'

const BACKEND_URL = "https://meteorological-backend.onrender.com"

// ─── Severity / Disaster config ───────────────────────────────────────────────

const SEV = {
  Low:      { emoji:'✅', cls:'low',      color:'#4ade80' },
  Moderate: { emoji:'⚠️', cls:'moderate', color:'#fbbf24' },
  High:     { emoji:'🔶', cls:'high',     color:'#fb923c' },
  Extreme:  { emoji:'🔴', cls:'extreme',  color:'#f87171' },
}

const DIS = {
  'Cyclone Watch':     { emoji:'🌀', color:'#818cf8', bg:'rgba(129,140,248,0.12)', bdr:'rgba(129,140,248,0.3)' },
  'Storm Surge':       { emoji:'🌊', color:'#22d3ee', bg:'rgba(34,211,238,0.12)',  bdr:'rgba(34,211,238,0.3)'  },
  'Flood Risk':        { emoji:'💧', color:'#22d3ee', bg:'rgba(34,211,238,0.12)',  bdr:'rgba(34,211,238,0.3)'  },
  'Heat Stress':       { emoji:'🔥', color:'#fb923c', bg:'rgba(251,146,60,0.12)',  bdr:'rgba(251,146,60,0.3)'  },
  'Cold Stress':       { emoji:'❄️', color:'#93c5fd', bg:'rgba(147,197,253,0.12)', bdr:'rgba(147,197,253,0.3)' },
  'Thunderstorm Risk': { emoji:'⛈️', color:'#a78bfa', bg:'rgba(167,139,250,0.12)', bdr:'rgba(167,139,250,0.3)' },
  'Compound Risk':     { emoji:'⚡', color:'#fbbf24', bg:'rgba(251,191,36,0.12)',  bdr:'rgba(251,191,36,0.3)'  },
  'No Threat':         { emoji:'✅', color:'#4ade80', bg:'rgba(74,222,128,0.12)',  bdr:'rgba(74,222,128,0.3)'  },
}

const CITIES = [
  { name:'Mumbai',           country:'India',       lat:19.08,  lon:72.88  },
  { name:'Delhi',            country:'India',       lat:28.61,  lon:77.21  },
  { name:'Chennai',          country:'India',       lat:13.08,  lon:80.27  },
  { name:'Kolkata',          country:'India',       lat:22.57,  lon:88.36  },
  { name:'Dhaka',            country:'Bangladesh',  lat:23.81,  lon:90.41  },
  { name:'Tokyo',            country:'Japan',       lat:35.68,  lon:139.69 },
  { name:'Manila',           country:'Philippines', lat:14.60,  lon:120.98 },
  { name:'Ho Chi Minh City', country:'Vietnam',     lat:10.82,  lon:106.63 },
  { name:'Bangkok',          country:'Thailand',    lat:13.75,  lon:100.52 },
  { name:'Jakarta',          country:'Indonesia',   lat:-6.21,  lon:106.85 },
  { name:'Shanghai',         country:'China',       lat:31.23,  lon:121.47 },
  { name:'Beijing',          country:'China',       lat:39.90,  lon:116.40 },
  { name:'Hong Kong',        country:'China',       lat:22.32,  lon:114.17 },
  { name:'Seoul',            country:'South Korea', lat:37.57,  lon:126.98 },
  { name:'London',           country:'UK',          lat:51.51,  lon:-0.13  },
  { name:'Miami',            country:'USA',         lat:25.76,  lon:-80.19 },
  { name:'Houston',          country:'USA',         lat:29.76,  lon:-95.37 },
  { name:'New York',         country:'USA',         lat:40.71,  lon:-74.01 },
  { name:'Mexico City',      country:'Mexico',      lat:19.43,  lon:-99.13 },
  { name:'Sao Paulo',        country:'Brazil',      lat:-23.55, lon:-46.63 },
  { name:'Lagos',            country:'Nigeria',     lat:6.52,   lon:3.38   },
  { name:'Cairo',            country:'Egypt',       lat:30.04,  lon:31.24  },
  { name:'Sydney',           country:'Australia',   lat:-33.87, lon:151.21 },
  { name:'Dubai',            country:'UAE',         lat:25.20,  lon:55.27  },
  { name:'Karachi',          country:'Pakistan',    lat:24.86,  lon:67.01  },
  { name:'Colombo',          country:'Sri Lanka',   lat:6.93,   lon:79.84  },
  { name:'Yangon',           country:'Myanmar',     lat:16.87,  lon:96.20  },
  { name:'Havana',           country:'Cuba',        lat:23.11,  lon:-82.37 },
  { name:'Nairobi',          country:'Kenya',       lat:-1.29,  lon:36.82  },
  { name:'Taipei',           country:'Taiwan',      lat:25.03,  lon:121.57 },
]

// ─── Season helpers ───────────────────────────────────────────────────────────

function getSeason(month, lat) {
  const NH = lat >= 0
  const nhMap = {
    1:  { name:'Winter',       icon:'❄️',  color:'#93c5fd' },
    2:  { name:'Winter',       icon:'❄️',  color:'#93c5fd' },
    3:  { name:'Pre-Monsoon',  icon:'🌤️', color:'#fbbf24' },
    4:  { name:'Pre-Monsoon',  icon:'🌤️', color:'#fbbf24' },
    5:  { name:'Pre-Monsoon',  icon:'☀️',  color:'#fb923c' },
    6:  { name:'Monsoon',      icon:'🌧️', color:'#22d3ee' },
    7:  { name:'Monsoon',      icon:'🌧️', color:'#22d3ee' },
    8:  { name:'Monsoon',      icon:'🌧️', color:'#22d3ee' },
    9:  { name:'Monsoon',      icon:'🌦️', color:'#22d3ee' },
    10: { name:'Post-Monsoon', icon:'🌥️', color:'#a78bfa' },
    11: { name:'Post-Monsoon', icon:'🌥️', color:'#a78bfa' },
    12: { name:'Winter',       icon:'❄️',  color:'#93c5fd' },
  }
  const shMonth = ((month - 1 + 6) % 12) + 1
  return NH ? nhMap[month] : nhMap[shMonth]
}

function monthName(m) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]
}

// ─── Seasonal archive fetch ───────────────────────────────────────────────────

async function fetchSeasonalNormals(lat, lon, month, latForSeason) {
  const year  = new Date().getFullYear()
  const years = [year-5, year-4, year-3, year-2, year-1]

  const allTemp = [], allWind = [], allRain = [], allHum = []

  await Promise.all(years.map(async y => {
    const daysInMonth = new Date(y, month, 0).getDate()
    const start = `${y}-${String(month).padStart(2,'0')}-01`
    const end   = `${y}-${String(month).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`
    try {
      const res = await fetch(
        `https://archive-api.open-meteo.com/v1/archive` +
        `?latitude=${lat}&longitude=${lon}` +
        `&start_date=${start}&end_date=${end}` +
        `&daily=temperature_2m_mean,wind_speed_10m_max,precipitation_sum,relative_humidity_2m_mean`
      )
      const d = await res.json()
      if (!d.daily) return
      ;(d.daily.temperature_2m_mean       || []).forEach(v => v != null && allTemp.push(v))
      ;(d.daily.wind_speed_10m_max        || []).forEach(v => v != null && allWind.push(v))
      ;(d.daily.precipitation_sum         || []).forEach(v => v != null && allRain.push(v))
      ;(d.daily.relative_humidity_2m_mean || []).forEach(v => v != null && allHum.push(v))
    } catch(_) {}
  }))

  function stats(arr) {
    if (!arr.length) return { mean:null, std:null, min:null, max:null, count:0 }
    const mean = arr.reduce((a,b) => a+b, 0) / arr.length
    const std  = Math.sqrt(arr.reduce((a,b) => a+(b-mean)**2, 0) / arr.length)
    return {
      mean:  Math.round(mean*10)/10,
      std:   Math.round(std*10)/10,
      min:   Math.round(Math.min(...arr)*10)/10,
      max:   Math.round(Math.max(...arr)*10)/10,
      count: arr.length,
    }
  }

  return {
    temp:     stats(allTemp),
    wind:     stats(allWind),
    rain:     stats(allRain),
    humidity: stats(allHum),
    month,
    season:   getSeason(month, latForSeason),
    years,
  }
}

// ─── Anomaly / Z-score helpers ────────────────────────────────────────────────

function zScore(val, mean, std) {
  if (mean == null || std == null || std === 0) return 0
  return (val - mean) / std
}

function anomalyLevel(z, higherIsBad = true) {
  const az   = Math.abs(z)
  const isBad = higherIsBad ? z > 0 : z < 0
  if (az < 1) return { level:'normal',   label:'Normal',    color:'#4ade80', bad:false }
  if (az < 2) return { level:'moderate', label:'Slightly',  color:'#fbbf24', bad:isBad }
  if (az < 3) return { level:'high',     label:'Notably',   color:'#fb923c', bad:isBad }
  return           { level:'extreme',  label:'Extremely', color:'#f87171', bad:isBad }
}

function seasonalSeverity(current, normals, baseSeverity) {
  if (!normals) return { severity: baseSeverity, anomalies: [], overridden: false }

  const anomalies = []
  const order = ['Low','Moderate','High','Extreme']

  const tZ = zScore(current.temp, normals.temp.mean, normals.temp.std)
  if (Math.abs(tZ) > 2) anomalies.push({
    param: 'Temperature', z: tZ,
    msg: `${Math.abs(tZ).toFixed(1)}σ ${tZ>0?'above':'below'} ${monthName(normals.month)} seasonal mean (${normals.temp.mean}°C)`,
    level: anomalyLevel(tZ, tZ > 0),
  })

  const rZ = zScore(current.rain, normals.rain.mean, normals.rain.std)
  if (rZ > 2) anomalies.push({
    param: 'Rainfall', z: rZ,
    msg: `${rZ.toFixed(1)}σ above ${monthName(normals.month)} seasonal mean (${normals.rain.mean}mm/day)`,
    level: anomalyLevel(rZ, true),
  })

  const wZ = zScore(current.wind, normals.wind.mean, normals.wind.std)
  if (wZ > 2) anomalies.push({
    param: 'Wind Speed', z: wZ,
    msg: `${wZ.toFixed(1)}σ above ${monthName(normals.month)} seasonal mean (${normals.wind.mean}km/h)`,
    level: anomalyLevel(wZ, true),
  })

  const hZ = zScore(current.humidity, normals.humidity.mean, normals.humidity.std)
  if (Math.abs(hZ) > 2) anomalies.push({
    param: 'Humidity', z: hZ,
    msg: `${Math.abs(hZ).toFixed(1)}σ ${hZ>0?'above':'below'} ${monthName(normals.month)} seasonal mean (${normals.humidity.mean}%)`,
    level: anomalyLevel(hZ, hZ > 0),
  })

  const hasExtreme = anomalies.some(a => a.level.level === 'extreme')
  const hasHigh    = anomalies.some(a => a.level.level === 'high')
  let finalSev = baseSeverity, overridden = false

  if (hasExtreme && order.indexOf(baseSeverity) < order.indexOf('High'))    { finalSev = 'High';     overridden = true }
  if (hasHigh    && order.indexOf(baseSeverity) < order.indexOf('Moderate')){ finalSev = 'Moderate'; overridden = true }

  // Downgrade if no anomalies and base severity driven by parameters normal for this season
  if (!anomalies.length && baseSeverity !== 'Low' && current.rain < (normals.rain.mean ?? 0) * 1.5) {
    const idx = order.indexOf(baseSeverity)
    if (idx > 0) { finalSev = order[idx-1]; overridden = true }
  }

  return { severity: finalSev, anomalies, overridden }
}

// ─── General utilities ────────────────────────────────────────────────────────

const compass = deg => {
  const d = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return d[Math.round((deg ?? 0) / 22.5) % 16]
}

function heatIndex(tc, rh) {
  if (tc < 27) return null
  const tf = tc * 9/5 + 32
  const h  = -42.379 + 2.04901523*tf + 10.14333127*rh - 0.22475541*tf*rh
           - 6.83783e-3*tf*tf - 5.481717e-2*rh*rh + 1.22874e-3*tf*tf*rh
           + 8.5282e-4*tf*rh*rh - 1.99e-6*tf*tf*rh*rh
  const hc = (h - 32) * 5/9
  return hc > tc + 2 ? Math.round(hc*10)/10 : null
}

function trendArrow(cur, avg, invertBad = false) {
  const d = cur - avg
  if (Math.abs(d) < 0.5) return { sym:'→', label:'Stable', color:'#3d6275' }
  const up = d > 0
  return { sym: up?'↑':'↓', label:`${up?'+':''}${d.toFixed(1)}`, color:(up!==invertBad)?'#f87171':'#4ade80' }
}

function classifyFE({ temp, wind, rain, pressure, humidity=50 }) {
  if ((pressure<970&&wind>88)||rain>204||wind>117||temp>47||temp<-10) return 'Extreme'
  if (rain>115||wind>88||wind>61||temp>40||temp<0||(pressure<990&&wind>61)||(humidity>90&&temp>40)) return 'High'
  if (rain>64||wind>40||pressure<990||humidity>90) return 'Moderate'
  return 'Low'
}

function disasterFE({ wind, rain, pressure, temp, humidity=50 }) {
  if (pressure<970&&wind>88&&rain>64) return 'Cyclone Watch'
  if (pressure<970&&wind>117) return 'Storm Surge'
  if (rain>115) return 'Flood Risk'
  if (temp>40&&humidity>75) return 'Heat Stress'
  if (temp<0) return 'Cold Stress'
  if (wind>40&&rain>15&&pressure<1005) return 'Thunderstorm Risk'
  return 'No Threat'
}

function stormApproach(hrs) {
  if (!hrs?.length) return []
  const h    = hrs.slice(0, Math.min(48, hrs.length))
  const p0   = h[0]?.pressure ?? 1013
  const p24  = h[Math.min(23,h.length-1)]?.pressure ?? 1013
  const drop = p0 - p24
  const peakW = Math.max(...h.map(x=>x.wind??0))
  const peakR = Math.max(...h.map(x=>x.rain??0))
  const wIdx  = h.findIndex(x=>x.wind===peakW)
  const rIdx  = h.findIndex(x=>x.rain===peakR)
  const out   = []
  if      (drop>20)   out.push({icon:'🌀',sev:'Extreme', msg:`Explosive cyclogenesis — pressure falling ${drop.toFixed(1)} hPa/24h. Severe storm imminent.`})
  else if (drop>10)   out.push({icon:'📉',sev:'High',    msg:`Rapid pressure drop ${drop.toFixed(1)} hPa/24h — active storm system developing.`})
  else if (drop>5)    out.push({icon:'⬇️',sev:'Moderate',msg:`Pressure falling ${drop.toFixed(1)} hPa/24h — conditions deteriorating.`})
  if      (peakR>115) out.push({icon:'🌧️',sev:'High',    msg:`Very Heavy rain (~${peakR.toFixed(0)}mm) forecast in ~${rIdx}h — flash flood risk.`})
  else if (peakR>64)  out.push({icon:'🌦️',sev:'Moderate',msg:`Heavy rain (~${peakR.toFixed(0)}mm) expected in ~${rIdx}h.`})
  if      (peakW>88)  out.push({icon:'🌪️',sev:'High',    msg:`Storm-force winds (~${peakW.toFixed(0)} km/h) in ~${wIdx}h — structural damage risk.`})
  else if (peakW>61)  out.push({icon:'💨',sev:'Moderate',msg:`Gale-force winds (~${peakW.toFixed(0)} km/h) in ~${wIdx}h — secure loose objects.`})
  const o={Extreme:0,High:1,Moderate:2}
  return out.sort((a,b)=>(o[a.sev]??3)-(o[b.sev]??3))
}

function compound(w) {
  const {temp,wind,rain,humidity,pressure}=w
  let score=0; const bars=[]
  if      (rain>204){score+=3;bars.push({l:'Rainfall',   p:100,lv:'extreme',v:`${rain}mm`   })}
  else if (rain>115){score+=2;bars.push({l:'Rainfall',   p:70, lv:'high',   v:`${rain}mm`   })}
  else if (rain>64) {score+=1;bars.push({l:'Rainfall',   p:42, lv:'moderate',v:`${rain}mm`  })}
  else                         bars.push({l:'Rainfall',   p:Math.min(rain/64*30,30),lv:'low',v:`${rain}mm`})
  if      (wind>117){score+=3;bars.push({l:'Wind',       p:100,lv:'extreme',v:`${wind}km/h` })}
  else if (wind>88) {score+=2;bars.push({l:'Wind',       p:70, lv:'high',   v:`${wind}km/h` })}
  else if (wind>61) {score+=1;bars.push({l:'Wind',       p:44, lv:'moderate',v:`${wind}km/h`})}
  else                         bars.push({l:'Wind',       p:Math.min(wind/61*35,35),lv:'low',v:`${wind}km/h`})
  if      (temp>47||temp<-10){score+=2;bars.push({l:'Temperature',p:100,lv:'extreme',v:`${temp}°C`})}
  else if (temp>40||temp<0)  {score+=1;bars.push({l:'Temperature',p:60, lv:'high',   v:`${temp}°C`})}
  else                                  bars.push({l:'Temperature',p:20, lv:'low',    v:`${temp}°C`})
  if      (pressure<970){score+=2;bars.push({l:'Pressure',p:100,lv:'extreme',v:`${pressure}hPa`})}
  else if (pressure<990){score+=1;bars.push({l:'Pressure',p:60, lv:'high',   v:`${pressure}hPa`})}
  else                           bars.push({l:'Pressure',p:Math.max(0,Math.min((1013-pressure)/43*40,40)),lv:'low',v:`${pressure}hPa`})
  const hi=heatIndex(temp,humidity)
  if (humidity>90&&temp>35){score+=1;bars.push({l:'Heat Index',p:100,lv:'high',v:hi?`${hi}°C`:`${humidity}%`})}
  else                                bars.push({l:'Heat Index',p:Math.min(humidity/90*45,45),lv:'low',v:hi?`${hi}°C`:`${humidity}%`})
  return {score,pct:Math.round(score/11*100),bars}
}

function dynAssess(w,sev,dtype) {
  const {temp,wind,rain,humidity,pressure}=w
  const hi=heatIndex(temp,humidity)
  if (sev==='Low') return `All parameters within normal safe ranges — temperature ${temp}°C, wind ${wind} km/h, rainfall ${rain} mm, pressure ${pressure} hPa. No disruptions anticipated.`
  switch(dtype){
    case 'Cyclone Watch':     return `Three-parameter compound event: pressure ${pressure} hPa, wind ${wind} km/h, rainfall ${rain} mm — tropical cyclonic system indicators. Conditions likely to deteriorate rapidly.`
    case 'Storm Surge':       return `Extreme pressure (${pressure} hPa) with hurricane-force winds (${wind} km/h) present severe coastal storm surge risk.`
    case 'Flood Risk':        return `Rainfall ${rain} mm ${rain>204?'exceeds IMD Extremely Heavy (>204mm)':'exceeds IMD Very Heavy (>115mm)'} threshold. Flash flooding highly probable.`
    case 'Heat Stress':       return `Temperature ${temp}°C with ${humidity}% humidity creates dangerous heat stress.${hi?` Heat index: ${hi}°C — ${Math.round(hi-temp)}°C above ambient.`:''}`
    case 'Cold Stress':       return `Temperature ${temp}°C ${temp<0?'below freezing':'severe cold wave'}. Wind chill at ${wind} km/h amplifies thermal stress.`
    case 'Thunderstorm Risk': return `Falling pressure (${pressure} hPa), gusty winds (${wind} km/h), and ${rain} mm rainfall indicate active convective storm.`
    case 'Compound Risk':     return `Multiple parameters simultaneously above thresholds — wind: ${wind} km/h, rain: ${rain} mm, pressure: ${pressure} hPa, temp: ${temp}°C.`
    default: return `${sev==='Moderate'?'One or more':'Multiple'} parameters exceeded thresholds — temperature: ${temp}°C, wind: ${wind} km/h, rainfall: ${rain} mm, pressure: ${pressure} hPa.`
  }
}

function dynAdvisories(w,sev,dtype) {
  const {temp,wind,rain,pressure}=w
  const hi=heatIndex(temp,w.humidity)
  if (sev==='Low') return ['No special precautions required — conditions within seasonal normal ranges','Continue monitoring IMD / local weather forecast updates','Outdoor activities may proceed normally']
  const a=[]
  if (dtype==='Cyclone Watch'||dtype==='Storm Surge'){a.push('Move to designated shelter or higher ground immediately');a.push('Comply with all official evacuation orders without delay')}
  if (dtype==='Flood Risk'||rain>100){a.push(`Avoid all low-lying areas — ${rain}mm can cause flash flooding`);a.push('Do not cross flooded roads or waterways')}
  if (dtype==='Heat Stress'||temp>=38){a.push(`Drink 250ml water every 20 min — apparent ${hi??temp}°C causes rapid dehydration`);a.push('Avoid outdoor activity between 11 AM – 4 PM')}
  if (dtype==='Cold Stress'||temp<=0){a.push(`Wear 3+ insulating layers — wind chill at ${wind}km/h creates frostbite risk`)}
  if (dtype==='Thunderstorm Risk'){a.push('Stay indoors; avoid open fields, tall trees, and elevated terrain')}
  if (wind>60) a.push(`Secure all loose outdoor objects — ${wind}km/h winds propel debris dangerously`)
  if (pressure<990) a.push(`Pressure at ${pressure}hPa — monitor IMD bulletins every 30 min`)
  if (sev==='High'||sev==='Extreme') a.push('Prepare emergency kit: 3-day water supply, first-aid, torch, power bank')
  if (sev==='Extreme') a.push('Contact emergency services if in danger — NDRF helpline: 9711077372')
  return a.length?a:['Monitor official IMD weather forecasts and local emergency notifications']
}

function alertReasons(w) {
  const {temp,wind,rain,humidity,pressure}=w
  const hi=heatIndex(temp,humidity)
  const r=[]
  if      (rain>200) r.push({ico:'🌧️',txt:`Rainfall: ${rain}mm — Extremely Heavy (>204mm)`})
  else if (rain>115) r.push({ico:'🌧️',txt:`Rainfall: ${rain}mm — Very Heavy (>115mm)`})
  else if (rain>64)  r.push({ico:'🌧️',txt:`Rainfall: ${rain}mm — Heavy (>64mm)`})
  if      (wind>117) r.push({ico:'🌪️',txt:`Wind: ${wind}km/h — hurricane-force`})
  else if (wind>88)  r.push({ico:'💨',txt:`Wind: ${wind}km/h — storm-force`})
  else if (wind>61)  r.push({ico:'💨',txt:`Wind: ${wind}km/h — gale-force`})
  if      (temp>47)  r.push({ico:'🔥',txt:`Temperature: ${temp}°C — IMD Severe Heat Wave (>47°C)`})
  else if (temp>40)  r.push({ico:'☀️',txt:`Temperature: ${temp}°C — IMD Heat Wave (>40°C)${hi?`; feels like ${hi}°C`:''}`})
  else if (temp<-10) r.push({ico:'🥶',txt:`Temperature: ${temp}°C — extreme cold`})
  else if (temp<0)   r.push({ico:'❄️',txt:`Temperature: ${temp}°C — below freezing`})
  if      (pressure<970)  r.push({ico:'📉',txt:`Pressure: ${pressure}hPa (MSL) — extreme low; cyclonic risk`})
  else if (pressure<990)  r.push({ico:'📉',txt:`Pressure: ${pressure}hPa (MSL) — very low; active system`})
  else if (pressure<1005) r.push({ico:'📉',txt:`Pressure: ${pressure}hPa (MSL) — below normal`})
  if (humidity>90&&temp>35) r.push({ico:'🥵',txt:`Heat stress: ${humidity}% humidity at ${temp}°C — dangerous`})
  if (!r.length) r.push({ico:'✅',txt:'All five parameters within normal operating ranges'})
  return r
}

// ─── SVG path helper ──────────────────────────────────────────────────────────

function smoothPath(vals,W,H,maxV,minV=0){
  if(!vals.length) return {line:'',fill:'',xs:[],ys:[]}
  const range=(maxV-minV)||1, pad=14
  const xs=vals.map((_,i)=>(i/(vals.length-1))*W)
  const ys=vals.map(v=>H-pad-((v-minV)/range)*(H-pad*2))
  let line=`M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`
  for(let i=1;i<xs.length;i++){const cx=((xs[i-1]+xs[i])/2).toFixed(2);line+=` C ${cx} ${ys[i-1].toFixed(2)} ${cx} ${ys[i].toFixed(2)} ${xs[i].toFixed(2)} ${ys[i].toFixed(2)}`}
  const fill=`${line} L ${xs[xs.length-1].toFixed(2)} ${H} L ${xs[0].toFixed(2)} ${H} Z`
  return {line,fill,xs,ys}
}

// ─── WindChart ────────────────────────────────────────────────────────────────

function WindChart({data}){
  if(!data?.length) return <div className="chart-empty">No forecast data</div>
  const W=500,H=130
  const speeds=data.map(d=>d.wind??0)
  const maxS=Math.max(...speeds,20)
  const {line,fill,xs,ys}=smoothPath(speeds,W,H,maxS)
  const clr=maxS>88?'#f87171':maxS>61?'#fb923c':maxS>40?'#fbbf24':'#22d3ee'
  const step=Math.max(1,Math.floor(data.length/7))
  const pts=data.map((d,i)=>({...d,x:xs[i],y:ys[i],i})).filter((_,i)=>i%step===0)
  return(
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H+26}`} style={{width:'100%',display:'block'}}>
        <defs><linearGradient id="wg" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={clr} stopOpacity="0.38"/><stop offset="100%" stopColor={clr} stopOpacity="0.02"/></linearGradient></defs>
        {[0.33,0.66,1].map(p=><line key={p} x1="0" y1={(H-14-p*(H-28)).toFixed(1)} x2={W} y2={(H-14-p*(H-28)).toFixed(1)} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>)}
        {[{v:40,c:'rgba(251,191,36,0.5)'},{v:61,c:'rgba(251,146,60,0.5)'},{v:88,c:'rgba(248,113,113,0.5)'}].map(({v,c})=>maxS>v&&<line key={v} x1="0" y1={(H-14-(v/maxS)*(H-28)).toFixed(1)} x2={W} y2={(H-14-(v/maxS)*(H-28)).toFixed(1)} stroke={c} strokeWidth="0.8" strokeDasharray="3,4"/>)}
        <path d={fill} fill="url(#wg)"/>
        <path d={line} fill="none" stroke={clr} strokeWidth="2.5" strokeLinejoin="round"/>
        {pts.map((p,i)=><g key={i} transform={`translate(${p.x.toFixed(1)},${(p.y-15).toFixed(1)})`}><g transform={`rotate(${p.windDir??0})`}><path d="M0,-6 L3.5,5 L0,2.5 L-3.5,5Z" fill={clr} opacity="0.85"/></g></g>)}
        <circle cx={xs[0].toFixed(1)} cy={ys[0].toFixed(1)} r="6" fill={clr} opacity="0.25"/>
        <circle cx={xs[0].toFixed(1)} cy={ys[0].toFixed(1)} r="4" fill={clr}/>
        {pts.map((p,i)=><text key={i} x={p.x.toFixed(1)} y={(p.y-20).toFixed(1)} textAnchor="middle" fontSize="9" fill={clr} fontWeight="600">{Math.round(p.wind??0)}</text>)}
        {pts.map((p,i)=><text key={i} x={p.x.toFixed(1)} y={H+18} textAnchor="middle" fontSize="9" fill="rgba(127,181,200,0.6)">{new Date(p.time).getHours().toString().padStart(2,'0')}:00</text>)}
      </svg>
      <div className="chart-legend">
        {maxS>40&&<span className="legend-item" style={{color:'#fbbf24'}}>── Strong (40)</span>}
        {maxS>61&&<span className="legend-item" style={{color:'#fb923c'}}>── Gale (61)</span>}
        {maxS>88&&<span className="legend-item" style={{color:'#f87171'}}>── Storm (88)</span>}
        <span className="legend-item" style={{color:'rgba(127,181,200,0.5)'}}>▲ Direction (km/h)</span>
      </div>
    </div>
  )
}

// ─── PressureChart ────────────────────────────────────────────────────────────

function PressureChart({data}){
  if(!data?.length) return <div className="chart-empty">No forecast data</div>
  const W=500,H=100
  const ps=data.map(d=>d.pressure??1013)
  const minP=Math.min(...ps)-3,maxP=Math.max(...ps)+3
  const {line,fill,xs,ys}=smoothPath(ps,W,H,maxP,minP)
  const drop=ps[0]-ps[ps.length-1]
  const clr=drop>15?'#f87171':drop>8?'#fb923c':drop>3?'#fbbf24':'#818cf8'
  const step=Math.max(1,Math.floor(data.length/7))
  const labels=data.map((d,i)=>({...d,x:xs[i],i})).filter((_,i)=>i%step===0)
  const range=(maxP-minP)||1
  return(
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H+24}`} style={{width:'100%',display:'block'}}>
        <defs><linearGradient id="pg" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={clr} stopOpacity="0.32"/><stop offset="100%" stopColor={clr} stopOpacity="0.02"/></linearGradient></defs>
        {minP<1013&&maxP>1013&&<><line x1="0" y1={(H-14-((1013-minP)/range)*(H-28)).toFixed(1)} x2={W} y2={(H-14-((1013-minP)/range)*(H-28)).toFixed(1)} stroke="rgba(127,181,200,0.2)" strokeWidth="1" strokeDasharray="5,4"/><text x={W-4} y={(H-18-((1013-minP)/range)*(H-28)).toFixed(1)} textAnchor="end" fontSize="8" fill="rgba(127,181,200,0.4)">1013hPa</text></>}
        {minP<990&&maxP>990&&<line x1="0" y1={(H-14-((990-minP)/range)*(H-28)).toFixed(1)} x2={W} y2={(H-14-((990-minP)/range)*(H-28)).toFixed(1)} stroke="rgba(251,146,60,0.45)" strokeWidth="0.8" strokeDasharray="3,4"/>}
        <path d={fill} fill="url(#pg)"/>
        <path d={line} fill="none" stroke={clr} strokeWidth="2.2" strokeLinejoin="round"/>
        <circle cx={xs[0].toFixed(1)} cy={ys[0].toFixed(1)} r="4" fill={clr}/>
        <circle cx={xs[0].toFixed(1)} cy={ys[0].toFixed(1)} r="8" fill={clr} opacity="0.2"/>
        {labels.map((l,i)=><text key={i} x={l.x.toFixed(1)} y={H+16} textAnchor="middle" fontSize="9" fill="rgba(127,181,200,0.6)">{i===0?'Now':`+${l.i}h`}</text>)}
      </svg>
      <div className="chart-legend">
        <span className="legend-item" style={{color:clr}}>
          {drop>8?'⚠️ Rapid fall':drop>3?'📉 Falling':drop<-3?'📈 Rising':'→ Stable'}: {Math.abs(drop).toFixed(1)} hPa over {data.length}h
        </span>
        {minP<990&&<span className="legend-item" style={{color:'#fb923c'}}>── 990 hPa danger threshold</span>}
      </div>
    </div>
  )
}

// ─── SeasonalContextCard ──────────────────────────────────────────────────────

function SeasonalContextCard({ normals, current, seasonalResult, loading }) {
  if (loading) {
    return (
      <div className="card">
        <div className="card-title">🗓️ Seasonal Context Analysis</div>
        <div className="card-sub">Querying Open-Meteo archive (5 years · same month · free, no key)</div>
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'1.5rem 0'}}>
          <div className="spinner-sm"></div>
          <span style={{fontSize:'0.84rem',color:'var(--muted)'}}>Fetching 5-year same-month baseline...</span>
        </div>
      </div>
    )
  }
  if (!normals) return null

  const { season, month, years } = normals
  const lvClr = { extreme:'#f87171', high:'#fb923c', moderate:'#fbbf24', low:'#4ade80', normal:'#4ade80' }

  const rows = [
    { label:'Temperature', ico:'🌡️', cur:`${current.temp}°C`,   mean:normals.temp.mean!=null?`${normals.temp.mean}°C`:'—',   range:normals.temp.min!=null?`${normals.temp.min}–${normals.temp.max}°C`:'—',   z:zScore(current.temp,normals.temp.mean,normals.temp.std),       get anomaly(){return anomalyLevel(this.z,this.z>0)} },
    { label:'Wind Speed',  ico:'💨', cur:`${current.wind}km/h`, mean:normals.wind.mean!=null?`${normals.wind.mean}km/h`:'—', range:normals.wind.min!=null?`${normals.wind.min}–${normals.wind.max}km/h`:'—', z:zScore(current.wind,normals.wind.mean,normals.wind.std),       get anomaly(){return anomalyLevel(this.z,true)}    },
    { label:'Rainfall',    ico:'🌧️', cur:`${current.rain}mm`,   mean:normals.rain.mean!=null?`${normals.rain.mean}mm/d`:'—', range:normals.rain.min!=null?`${normals.rain.min}–${normals.rain.max}mm`:'—',   z:zScore(current.rain,normals.rain.mean,normals.rain.std),       get anomaly(){return anomalyLevel(this.z,true)}    },
    { label:'Humidity',    ico:'💧', cur:`${current.humidity}%`, mean:normals.humidity.mean!=null?`${normals.humidity.mean}%`:'—', range:normals.humidity.min!=null?`${normals.humidity.min}–${normals.humidity.max}%`:'—', z:zScore(current.humidity,normals.humidity.mean,normals.humidity.std), get anomaly(){return anomalyLevel(this.z,this.z>0)} },
  ]

  return (
    <div className="card" style={{borderColor:season?.color?`${season.color}30`:'var(--border)'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1rem'}}>
        <div>
          <div className="card-title">{season?.icon} Seasonal Context — {season?.name ?? monthName(month)}</div>
          <div className="card-sub" style={{marginBottom:0}}>
            5-year baseline · {monthName(month)} normals · {years[0]}–{years[years.length-1]}
            {normals.temp.count > 0 && ` · ${normals.temp.count} day-samples`}
          </div>
        </div>
        {seasonalResult?.overridden && (
          <span style={{fontSize:'0.7rem',fontWeight:700,padding:'0.3rem 0.7rem',borderRadius:'999px',background:'rgba(251,191,36,0.15)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.3)',whiteSpace:'nowrap',flexShrink:0}}>
            ⚡ Severity adjusted by seasonal analysis
          </span>
        )}
      </div>

      {/* Anomaly alerts */}
      {seasonalResult?.anomalies?.length > 0 && (
        <div style={{marginBottom:'1rem',display:'flex',flexDirection:'column',gap:'0.45rem'}}>
          {seasonalResult.anomalies.map((a,i) => (
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'0.6rem',background:`${a.level.color}10`,border:`1px solid ${a.level.color}30`,borderLeft:`3px solid ${a.level.color}`,borderRadius:'var(--r-sm)',padding:'0.6rem 0.8rem'}}>
              <span style={{fontSize:'0.9rem',flexShrink:0}}>{a.level.level==='extreme'?'🚨':a.level.level==='high'?'⚠️':'📊'}</span>
              <div>
                <span style={{fontWeight:700,color:a.level.color,fontSize:'0.8rem'}}>{a.param} anomaly — </span>
                <span style={{fontSize:'0.8rem',color:'var(--muted)'}}>{a.msg}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Normal season */}
      {!seasonalResult?.anomalies?.length && normals.temp.mean != null && (
        <div style={{display:'flex',alignItems:'center',gap:'0.6rem',background:'rgba(74,222,128,0.07)',border:'1px solid rgba(74,222,128,0.2)',borderLeft:'3px solid #4ade80',borderRadius:'var(--r-sm)',padding:'0.6rem 0.8rem',marginBottom:'1rem'}}>
          <span>✅</span>
          <span style={{fontSize:'0.82rem',color:'var(--muted)'}}>
            All parameters consistent with expected {season?.name} conditions for this location.
            This is what <strong>{monthName(month)}</strong> normally looks like here based on 5 years of archive data.
          </span>
        </div>
      )}

      {/* Per-parameter anomaly bars */}
      <div style={{display:'flex',flexDirection:'column',gap:'0.55rem'}}>
        {rows.map(row => {
          const clamped = Math.max(-3, Math.min(3, row.z))
          const barPct  = (clamped + 3) / 6 * 100  // 0-100%, 50% = zero deviation
          const barClr  = lvClr[row.anomaly.level] ?? '#4ade80'
          return (
            <div key={row.label} style={{background:'rgba(6,18,40,0.5)',borderRadius:'var(--r-sm)',padding:'0.7rem 0.85rem',border:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.4rem',flexWrap:'wrap',gap:'0.3rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.45rem'}}>
                  <span style={{fontSize:'0.95rem'}}>{row.ico}</span>
                  <span style={{fontSize:'0.8rem',fontWeight:600,color:'var(--text)'}}>{row.label}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'0.75rem',fontSize:'0.75rem',flexWrap:'wrap'}}>
                  <span style={{color:'var(--dim)'}}>5yr avg: <strong style={{color:'var(--muted)'}}>{row.mean}</strong></span>
                  <span style={{color:'var(--dim)'}}>range: {row.range}</span>
                  <span style={{fontWeight:700,color:barClr}}>now: {row.cur}</span>
                </div>
              </div>
              {/* Z-score bar: fills from centre outward */}
              <div style={{position:'relative',height:'6px',background:'rgba(255,255,255,0.06)',borderRadius:'999px',overflow:'visible'}}>
                <div style={{position:'absolute',left:'50%',top:'-2px',width:'1.5px',height:'10px',background:'rgba(127,181,200,0.3)',borderRadius:'1px'}}></div>
                <div style={{
                  position:'absolute',height:'100%',
                  left: clamped>=0?'50%':`${barPct}%`,
                  width:`${Math.abs(barPct-50)}%`,
                  background:barClr,borderRadius:'999px',
                  transition:'all 0.7s ease',opacity:Math.abs(row.z)<0.5?0.3:0.9
                }}></div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'0.3rem',fontSize:'0.68rem',color:'var(--dim)'}}>
                <span>← below normal</span>
                {Math.abs(row.z)>=1
                  ? <span style={{color:barClr,fontWeight:700}}>{row.anomaly.label} {row.z>0?'above':'below'} normal ({row.z>0?'+':''}{row.z.toFixed(1)}σ)</span>
                  : <span style={{color:'#4ade80',fontWeight:600}}>Within normal range</span>
                }
                <span>above normal →</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pressure explanation */}
      <div style={{marginTop:'0.75rem',padding:'0.6rem 0.85rem',background:'rgba(34,211,238,0.05)',border:'1px solid rgba(34,211,238,0.12)',borderRadius:'var(--r-sm)',fontSize:'0.78rem',color:'var(--muted)',lineHeight:1.6}}>
        <span style={{color:'var(--cyan)',fontWeight:600}}>ℹ️ Pressure note: </span>
        This system uses <strong>mean sea-level pressure (pressure_msl)</strong> — standardised to 0m altitude.
        This fixes the old bug where Coimbatore (411m) read 967 hPa and Delhi (216m) read 984 hPa even at normal conditions.
        MSL pressure is always ~1013 hPa when weather is calm, everywhere.
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WeatherDashboard() {
  const [city,         setCity]         = useState('')
  const [weather,      setWeather]      = useState(null)
  const [severity,     setSeverity]     = useState('')
  const [reason,       setReason]       = useState('')
  const [disasterType, setDisasterType] = useState('')
  const [cityName,     setCityName]     = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  const [forecastHrs,  setForecastHrs]  = useState([])
  const [dailyFc,      setDailyFc]      = useState([])
  const [stormAlerts,  setStormAlerts]  = useState([])
  const [namedStorms,  setNamedStorms]  = useState([])

  const [seasonalNormals, setSeasonalNormals] = useState(null)
  const [seasonalResult,  setSeasonalResult]  = useState(null)
  const [seasonalLoading, setSeasonalLoading] = useState(false)

  const [watchlist,    setWatchlist]    = useState([])
  const [monData,      setMonData]      = useState({})
  const [globalAlerts, setGlobalAlerts] = useState([])
  const [scanLoading,  setScanLoading]  = useState(false)
  const [lastScan,     setLastScan]     = useState(null)

  // ─── Global scan ──────────────────────────────────────────────────────────────
  const runScan = useCallback(async () => {
    setScanLoading(true)
    const alerts = []
    for (const loc of CITIES) {
      try {
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,pressure_msl,rain`)
        const wd = await wRes.json()
        const c  = wd.current
        if (!c) continue
        const temp=c.temperature_2m??0,wind=c.wind_speed_10m??0,rain=c.rain??0
        const humidity=c.relative_humidity_2m??50,pressure=c.pressure_msl??1013
        const cr   = await fetch(`${BACKEND_URL}/classify?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}`)
        const cd   = await cr.json()
        const sev  = cd.severity||'Low', dtype=cd.disasterType||'No Threat'
        if (sev!=='Low') alerts.push({name:loc.name,country:loc.country,temp,wind,rain,humidity,pressure,severity:sev,disasterType:dtype})
      } catch(_){}
    }
    const ord={Extreme:0,High:1,Moderate:2}
    alerts.sort((a,b)=>(ord[a.severity]??3)-(ord[b.severity]??3))
    setGlobalAlerts(alerts); setLastScan(new Date()); setScanLoading(false)
  }, [])

  useEffect(()=>{
    runScan()
    fetch('https://www.nhc.noaa.gov/CurrentStorms.json').then(r=>r.json()).then(d=>{if(d?.activeStorms?.length)setNamedStorms(d.activeStorms)}).catch(()=>{})
    const iv=setInterval(runScan,10*60*1000); return()=>clearInterval(iv)
  },[runScan])

  // ─── Watchlist ────────────────────────────────────────────────────────────────
  const addWatch = () => {
    if (!cityName||watchlist.includes(cityName)) return
    setWatchlist(p=>[...p,cityName])
    if (weather&&severity) {
      setMonData(p=>({...p,[cityName]:{temp:weather.temp,wind:weather.wind,rain:weather.rain,humidity:weather.humidity,pressure:weather.pressure,severity,disasterType,country:cityName.split(', ')[1]||'',resolvedName:cityName.split(', ')[0]}}))
    } else { fetchMonCity(cityName) }
  }

  const removeWatch = (e,name)=>{ e.stopPropagation(); setWatchlist(p=>p.filter(c=>c!==name)); setMonData(p=>{const c={...p};delete c[name];return c}) }

  async function fetchMonCity(name){
    try{
      const gr=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`)
      const gd=await gr.json()
      if(gd.results?.[0]){
        const{latitude:lat,longitude:lon,country}=gd.results[0]
        const wr=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,pressure_msl,rain`)
        const wd=await wr.json(); const cur=wd.current
        if(cur){
          const temp=cur.temperature_2m??0,wind=cur.wind_speed_10m??0,rain=cur.rain??0,humidity=cur.relative_humidity_2m??50,pressure=cur.pressure_msl??1013
          const cr=await fetch(`${BACKEND_URL}/classify?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}`)
          const cd=await cr.json()
          setMonData(p=>({...p,[name]:{temp,wind,rain,humidity,pressure,severity:cd.severity||'Low',disasterType:cd.disasterType||'No Threat',country:country||'',resolvedName:gd.results[0].name}}))
        }
      }
    }catch(_){}
  }

  // ─── Main fetch ───────────────────────────────────────────────────────────────
  async function fetchWeather() {
    const q=city.trim()
    if(!q){setError('Please enter a city name.');return}
    setLoading(true);setError('')
    setWeather(null);setSeverity('');setReason('');setDisasterType('')
    setForecastHrs([]);setDailyFc([]);setStormAlerts([])
    setSeasonalNormals(null);setSeasonalResult(null)

    try{
      const gr=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`)
      if(!gr.ok) throw new Error('Geocoding service unavailable.')
      const gd=await gr.json()
      if(!gd.results?.length) throw new Error(`City "${q}" not found. Please check the spelling.`)

      const{latitude:lat,longitude:lon,name:rn,country}=gd.results[0]
      setCityName(`${rn}, ${country||''}`.trim())

      // ── pressure_msl: sea-level standardised pressure (fixes altitude bug) ──
      const wr=await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m,pressure_msl,rain` +
        `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m,pressure_msl,rain` +
        `&past_days=30&forecast_days=7`
      )
      if(!wr.ok) throw new Error('Weather data unavailable.')
      const wd=await wr.json(); const cur=wd.current
      if(!cur) throw new Error('Current conditions unavailable.')

      const temp=cur.temperature_2m??0, wind=cur.wind_speed_10m??0, windDir=cur.wind_direction_10m??0
      const humidity=cur.relative_humidity_2m??50, pressure=cur.pressure_msl??1013, rain=cur.rain??0

      let avgTemp=0,avgWind=0,avgHumidity=50,avgPressure=1013,avgRain=0
      if(wd.hourly?.time){
        const h=wd.hourly, now=new Date()
        const pastEnd=h.time.findIndex(t=>new Date(t)>=now)
        const end=pastEnd>0?pastEnd:h.time.length
        const sl=k=>(h[k]||[]).slice(0,end), sum=a=>a.reduce((x,y)=>x+(y||0),0)
        if(end>0){
          avgTemp=parseFloat((sum(sl('temperature_2m'))/end).toFixed(1))
          avgWind=parseFloat((sum(sl('wind_speed_10m'))/end).toFixed(1))
          avgHumidity=Math.round(sum(sl('relative_humidity_2m'))/end)
          avgPressure=Math.round(sum(sl('pressure_msl'))/end)
          avgRain=parseFloat((sum(sl('rain'))/(end/24||1)).toFixed(1))
        }
      }
      setWeather({temp,wind,windDir,humidity,pressure,rain,avgTemp,avgWind,avgHumidity,avgPressure,avgRain})

      const now=new Date()
      const future=(wd.hourly?.time||[]).map((t,i)=>({
        time:t, wind:wd.hourly.wind_speed_10m[i]??0, windDir:wd.hourly.wind_direction_10m[i]??0,
        pressure:wd.hourly.pressure_msl[i]??1013, rain:wd.hourly.rain[i]??0,
        temp:wd.hourly.temperature_2m[i]??0, humidity:wd.hourly.relative_humidity_2m[i]??50,
      })).filter(h=>new Date(h.time)>=now).slice(0,48)
      setForecastHrs(future); setStormAlerts(stormApproach(future))

      const days={}
      future.forEach(h=>{
        const k=new Date(h.time).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})
        if(!days[k])days[k]=[]; days[k].push(h)
      })
      const daily=Object.entries(days).map(([date,hrs])=>{
        const maxW=Math.max(...hrs.map(h=>h.wind??0)),maxR=Math.max(...hrs.map(h=>h.rain??0))
        const maxT=Math.max(...hrs.map(h=>h.temp??0)),minP=Math.min(...hrs.map(h=>h.pressure??9999))
        const avgH=hrs.reduce((a,h)=>a+(h.humidity??50),0)/hrs.length
        return{date,maxW,maxR,maxT,minP,severity:classifyFE({wind:maxW,rain:maxR,temp:maxT,pressure:minP,humidity:avgH}),disasterType:disasterFE({wind:maxW,rain:maxR,temp:maxT,pressure:minP,humidity:avgH})}
      })
      setDailyFc(daily)

      const cr=await fetch(`${BACKEND_URL}/classifyWithHistory?temp=${temp}&rain=${rain}&wind=${wind}&humidity=${humidity}&pressure=${pressure}&avg_temp=${avgTemp}&avg_rain=${avgRain}&avg_wind=${avgWind}&avg_humidity=${avgHumidity}&avg_pressure=${avgPressure}`)
      if(!cr.ok) throw new Error('Classification service unavailable. Ensure the Haskell backend is running.')
      const cd=await cr.json()
      const baseSev=cd.severity||'Unknown'
      setSeverity(baseSev); setReason(cd.reason||''); setDisasterType(cd.disasterType||'No Threat')

      // Seasonal context — async, non-blocking (UI already shown)
      const currentMonth=new Date().getMonth()+1
      setSeasonalLoading(true)
      fetchSeasonalNormals(lat,lon,currentMonth,lat)
        .then(normals=>{
          setSeasonalNormals(normals)
          const result=seasonalSeverity({temp,wind,rain,humidity,pressure},normals,baseSev)
          setSeasonalResult(result)
          if(result.overridden) setSeverity(result.severity)
        })
        .catch(()=>{})
        .finally(()=>setSeasonalLoading(false))

    }catch(err){setError(err.message||'An unexpected error occurred.')}
    finally{setLoading(false)}
  }

  const onKey=e=>{if(e.key==='Enter')fetchWeather()}

  const sc=SEV[severity]||{emoji:'❓',cls:'',color:'#3d6275'}
  const dc=DIS[disasterType]||DIS['No Threat']
  const hasR=weather&&!loading&&severity
  const cp=weather?compound(weather):null
  const hi=weather?heatIndex(weather.temp,weather.humidity):null
  const cpClr=cp?(cp.pct>=80?'#f87171':cp.pct>=55?'#fb923c':cp.pct>=30?'#fbbf24':'#4ade80'):'#4ade80'
  const lvClr={extreme:'#f87171',high:'#fb923c',moderate:'#fbbf24',low:'#4ade80'}
  const chartData=forecastHrs.filter((_,i)=>i%2===0)

  return (
    <div>
      {/* ════ HERO ════════════════════════════════════════════════════════════ */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="eyebrow-dot"></span>
          IMD Classification · 5-Year Seasonal Anomaly Detection · MSL Pressure · 0 API Keys
        </div>
        <h1 className="hero-title">Real-Time<br/><span className="hero-title-accent">Meteorological</span><br/>Alert System</h1>
        <p className="hero-sub">
          Automated severity classification with 5-year seasonal baseline analysis.
          Because 967 hPa in Coimbatore is perfectly normal — and this system now knows that.
        </p>
        <div className="hero-search">
          <div className="search-wrap">
            <span className="search-ico">🔍</span>
            <input className="search-input" type="text" placeholder="Search any city worldwide..." value={city} onChange={e=>setCity(e.target.value)} onKeyDown={onKey} disabled={loading}/>
            <button className="search-btn" onClick={fetchWeather} disabled={loading}>
              {loading?<span className="btn-spin"></span>:'Analyze'}
            </button>
          </div>
        </div>
        <div className="hero-stats">
          {[{n:'30',l:'Cities Monitored'},{n:'5-Yr',l:'Seasonal Baseline'},{n:'MSL',l:'Corrected Pressure'},{n:'Free',l:'No API Key'}].map((s,i)=>(
            <div key={s.n} style={{display:'flex',alignItems:'center',gap:'2rem'}}>
              {i>0&&<div className="hstat-div"></div>}
              <div className="hstat"><div className="hstat-n">{s.n}</div><div className="hstat-l">{s.l}</div></div>
            </div>
          ))}
        </div>
        <div className="scroll-hint"><span>▼</span><span>Scroll down</span></div>
      </section>

      {/* ════ MAIN ═══════════════════════════════════════════════════════════ */}
      <div className="main">
        {error&&<div className="err-banner"><span>⚠️</span><span>{error}</span></div>}
        {loading&&<div className="loading-center"><div className="spinner-lg"></div><span className="loading-lbl">Fetching data & running IMD classification...</span></div>}

        {hasR&&(
          <>
            {/* Row 1 — Conditions + Severity */}
            <div className="results-row">
              {/* LEFT — Conditions */}
              <div className="card">
                <div className="cond-titlerow">
                  <div><div className="card-title">📍 {cityName}</div><div className="card-sub">Current conditions · MSL pressure · IMD scale</div></div>
                  <button className="btn-watch" onClick={addWatch} disabled={watchlist.includes(cityName)}>{watchlist.includes(cityName)?'✓ Watching':'+ Watch'}</button>
                </div>
                <div className="cond-grid">
                  {[
                    {ico:'🌡️',val:`${weather.temp}°C`,   lbl:'Temperature',                      t:trendArrow(weather.temp,    weather.avgTemp),       avg:`${weather.avgTemp}°C`   },
                    {ico:'💨',val:`${weather.wind} km/h`, lbl:`Wind · ${compass(weather.windDir)}`, t:trendArrow(weather.wind,    weather.avgWind),       avg:`${weather.avgWind}km/h` },
                    {ico:'💧',val:`${weather.humidity}%`, lbl:'Humidity',                          t:trendArrow(weather.humidity,weather.avgHumidity),   avg:`${weather.avgHumidity}%`},
                    {ico:'🌧️',val:`${weather.rain} mm`,  lbl:'Rainfall',                          t:trendArrow(weather.rain,    weather.avgRain),       avg:`${weather.avgRain}mm`   },
                  ].map(s=>(
                    <div className="cond-cell" key={s.lbl}>
                      <span className="cond-ico">{s.ico}</span>
                      <div className="cond-val">{s.val}</div>
                      <div className="cond-lbl">{s.lbl}</div>
                      <div className="cond-trend" style={{color:s.t.color}}>{s.t.sym} {s.t.label}</div>
                      <div className="cond-avg">30d avg: {s.avg}</div>
                    </div>
                  ))}
                </div>
                <div className="pres-row">
                  <div className="pres-left">
                    <span style={{fontSize:'1.2rem'}}>📊</span>
                    <div><div className="pres-val">{weather.pressure} hPa</div><div className="cond-lbl">Sea-Level Pressure (MSL)</div></div>
                  </div>
                  <div>
                    {(()=>{const t=trendArrow(weather.pressure,weather.avgPressure,true);return<div style={{color:t.color,fontWeight:700,fontSize:'0.85rem',textAlign:'right'}}>{t.sym} {t.label} hPa vs 30d avg</div>})()}
                    <div className="pres-note" style={{color:weather.pressure<970?'#f87171':weather.pressure<990?'#fb923c':weather.pressure<1005?'#fbbf24':'#4ade80',textAlign:'right'}}>
                      {weather.pressure<970?'🔴 Extreme low — cyclonic risk':weather.pressure<990?'🟠 Very low — active system':weather.pressure<1005?'🟡 Below normal':'✅ Normal range'}
                    </div>
                  </div>
                </div>
                {hi&&<div className="hi-pill">🌡️ Apparent temperature: <strong>{hi}°C</strong> — {hi-weather.temp>=5?'dangerously':'noticeably'} hotter than ambient</div>}
              </div>

              {/* RIGHT — Severity */}
              <div className="card">
                <div className="sev-head">
                  <div className="sev-big-emoji">{disasterType&&disasterType!=='No Threat'?dc.emoji:sc.emoji}</div>
                  <div className="sev-badges">
                    <span className="badge badge-anim" style={{background:`${sc.color}18`,color:sc.color,border:`1px solid ${sc.color}45`}}>{sc.emoji} {severity} Alert</span>
                    {disasterType&&disasterType!=='No Threat'&&<span className="badge badge-sm" style={{background:dc.bg,color:dc.color,border:`1px solid ${dc.bdr}`}}>{dc.emoji} {disasterType}</span>}
                    {seasonalResult?.overridden&&<span className="badge badge-sm" style={{background:'rgba(251,191,36,0.12)',color:'#fbbf24',border:'1px solid rgba(251,191,36,0.3)'}}>⚡ Seasonal override</span>}
                  </div>
                </div>
                <p className="sev-assess">{dynAssess(weather,severity,disasterType)}</p>
                {reason&&<div className="ctx-box"><div className="ctx-lbl">30-day Historical Context</div><p>{reason}</p></div>}
                {cp&&(
                  <div className="compound-box">
                    <div className="compound-hdr">
                      <span className="compound-lbl">Risk Fingerprint</span>
                      <span><span className="compound-score-num" style={{color:cpClr}}>{cp.score}</span><span className="compound-score-max">/11 · {cp.pct}%</span></span>
                    </div>
                    <div className="compound-main-track"><div className="compound-main-fill" style={{width:`${cp.pct}%`,background:`linear-gradient(90deg,${cpClr}70,${cpClr})`}}></div></div>
                    <div className="compound-bars">
                      {cp.bars.map(b=>(
                        <div className="cbar-row" key={b.l}>
                          <span className="cbar-lbl">{b.l}</span>
                          <div className="cbar-track"><div className="cbar-fill" style={{width:`${b.p}%`,background:lvClr[b.lv]}}></div></div>
                          <span className="cbar-val" style={{color:lvClr[b.lv]}}>{b.v}</span>
                        </div>
                      ))}
                    </div>
                    {cp.score>=3&&<p style={{marginTop:'0.7rem',fontSize:'0.76rem',color:'var(--muted)',lineHeight:1.5}}>⚠️ {cp.score>=6?'Critical':'Multiple'} parameters elevated — compound events carry disproportionately higher risk.</p>}
                  </div>
                )}
              </div>
            </div>

            {/* ── Seasonal Context Card ── */}
            <SeasonalContextCard normals={seasonalNormals} current={weather} seasonalResult={seasonalResult} loading={seasonalLoading}/>

            {/* Storm approach */}
            {stormAlerts.length>0&&(
              <div className="storm-section">
                <h2 className="section-heading"><span className="pdot pdot-orange"></span>⚡ Incoming Threat Analysis — Next 48 Hours</h2>
                <div className="storm-grid">
                  {stormAlerts.map((a,i)=>{const s2=SEV[a.sev]||SEV['Moderate'];return(
                    <div key={i} className="storm-card" style={{borderLeftColor:s2.color}}>
                      <div className="storm-card-top"><span className="storm-icon">{a.icon}</span><span className="badge badge-sm" style={{background:`${s2.color}18`,color:s2.color,border:`1px solid ${s2.color}45`}}>{a.sev}</span></div>
                      <p className="storm-msg">{a.msg}</p>
                    </div>
                  )})}
                </div>
              </div>
            )}

            {/* Charts */}
            {chartData.length>0&&(
              <div className="charts-row">
                <div className="card">
                  <div className="chart-hdr">
                    <div className="chart-title">💨 Wind Behaviour — Next 48h</div>
                    <div className="chart-meta">Now <strong>{weather.wind} km/h</strong> · Dir <strong>{compass(weather.windDir)}</strong> · Peak <strong>{Math.max(...forecastHrs.map(h=>h.wind||0)).toFixed(0)} km/h</strong></div>
                  </div>
                  <WindChart data={chartData}/>
                </div>
                <div className="card">
                  <div className="chart-hdr">
                    <div className="chart-title">📊 Pressure Trend — Next 48h (MSL)</div>
                    <div className="chart-meta">Now <strong>{weather.pressure} hPa</strong> · Min <strong>{Math.min(...forecastHrs.map(h=>h.pressure||9999)).toFixed(0)} hPa</strong> · {weather.pressure<990?'⚠️ Below danger threshold':'Within safe range'}</div>
                  </div>
                  <PressureChart data={chartData}/>
                </div>
              </div>
            )}

            {/* 7-Day forecast */}
            {dailyFc.length>0&&(
              <div>
                <h2 className="section-heading" style={{marginBottom:'1rem'}}>🗓️ 7-Day Threat Forecast</h2>
                <div className="forecast-strip">
                  {dailyFc.map((d,i)=>{const s2=SEV[d.severity]||SEV['Low'];const d2=DIS[d.disasterType]||DIS['No Threat'];return(
                    <div key={i} className={`fc-card fc-${d.severity}`}>
                      <div className="fc-date">{d.date}</div>
                      <div className="fc-type">{d2.emoji}</div>
                      <div className="fc-temp">{d.maxT.toFixed(0)}°C</div>
                      <div className="fc-badge" style={{background:`${s2.color}15`,color:s2.color,border:`1px solid ${s2.color}35`}}>{s2.emoji} {d.severity}</div>
                      <div className="fc-stats"><span>🌬️{d.maxW.toFixed(0)}</span><span>🌧️{d.maxR.toFixed(0)}</span></div>
                    </div>
                  )})}
                </div>
              </div>
            )}

            {/* Factors + Advisories */}
            <div className="advice-row">
              <div className="card">
                <div className="card-title">🛡️ Contributing Factors</div>
                <ul className="factor-list">{alertReasons(weather).map((r,i)=><li key={i} className="factor-item"><span style={{flexShrink:0}}>{r.ico}</span><span>{r.txt}</span></li>)}</ul>
              </div>
              <div className="card">
                <div className="card-title">📋 Safety Advisories</div>
                <ul className="advisory-list">{dynAdvisories(weather,severity,disasterType).map((adv,i)=><li key={i} className="advisory-item"><span className="adv-bullet">›</span><span>{adv}</span></li>)}</ul>
              </div>
            </div>
          </>
        )}

        {/* Named storms */}
        {namedStorms.length>0&&(
          <div>
            <h2 className="section-heading"><span className="pdot pdot-red"></span>🌀 Active Named Storms — NOAA NHC</h2>
            <div className="monitor-grid">{namedStorms.map((s,i)=><div key={i} className="monitor-card extreme"><div className="monitor-card-header"><span className="monitor-city">🌀 {s.name}</span><span className="monitor-country">{s.basin||'Active'}</span></div><div className="monitor-card-body"><div className="monitor-badge extreme">Extreme</div></div></div>)}</div>
          </div>
        )}

        {/* Global alerts */}
        <div>
          <div className="section-hdr-row">
            <div>
              <h2 className="section-heading"><span className="pdot pdot-cyan"></span>🌍 Global Alerts</h2>
              <p className="section-sub">Auto-scanning {CITIES.length} cities · MSL pressure{lastScan&&<> · Updated {lastScan.toLocaleTimeString()}</>}</p>
            </div>
            {scanLoading&&<div className="spinner-sm"></div>}
          </div>
          {scanLoading&&!globalAlerts.length&&<div className="scan-center"><div className="spinner-lg"></div><span style={{fontSize:'0.84rem',color:'var(--muted)'}}>Scanning...</span></div>}
          {!scanLoading&&!globalAlerts.length&&<div className="empty-box"><span className="empty-ico">✅</span><p>All {CITIES.length} monitored cities within safe parameters.</p></div>}
          {globalAlerts.length>0&&(
            <div className="monitor-grid">
              {globalAlerts.map(a=>{
                const s2=SEV[a.severity]||{emoji:'❓',cls:''}
                const d2=DIS[a.disasterType]||DIS['No Threat']
                return(
                  <div key={a.name} className={`monitor-card ${s2.cls}`} onClick={()=>{setCity(a.name);fetchWeather()}}>
                    <div className="monitor-card-header"><span className="monitor-city">{a.name}</span><span className="monitor-country">{a.country}</span></div>
                    <div className="monitor-card-body"><div className="monitor-temp">{a.temp}°C</div><div className={`monitor-badge ${s2.cls}`}>{s2.emoji} {a.severity}</div></div>
                    {a.disasterType&&a.disasterType!=='No Threat'&&<div style={{marginBottom:'0.4rem'}}><span style={{fontSize:'0.67rem',fontWeight:700,padding:'0.15rem 0.5rem',borderRadius:'999px',background:d2.bg,color:d2.color,border:`1px solid ${d2.bdr}`}}>{d2.emoji} {a.disasterType}</span></div>}
                    <div className="monitor-card-footer"><span>🌬️{a.wind}km/h</span><span>🌧️{a.rain}mm</span><span>📉{a.pressure}hPa</span></div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Watchlist */}
        <div>
          <h2 className="section-heading">📍 My Watchlist</h2>
          {!watchlist.length&&<div className="empty-box"><span className="empty-ico">📍</span><p>Search a city, then click <strong>+ Watch</strong> to track it here.</p></div>}
          {watchlist.length>0&&(
            <div className="monitor-grid">
              {watchlist.map(name=>{
                const data=monData[name]
                if(!data) return <div key={name} className="monitor-card skeleton"><div className="skel-line short"></div><div className="skel-line"></div></div>
                const s2=SEV[data.severity]||{emoji:'❓',cls:''}
                const d2=DIS[data.disasterType]||DIS['No Threat']
                return(
                  <div key={name} className={`monitor-card ${s2.cls}`} onClick={()=>{setCity(data.resolvedName||name);fetchWeather()}}>
                    <button className="remove-btn" onClick={e=>removeWatch(e,name)}>×</button>
                    <div className="monitor-card-header"><span className="monitor-city">{data.resolvedName}</span><span className="monitor-country">{data.country}</span></div>
                    <div className="monitor-card-body"><div className="monitor-temp">{data.temp}°C</div><div className={`monitor-badge ${s2.cls}`}>{s2.emoji} {data.severity}</div></div>
                    {data.disasterType&&data.disasterType!=='No Threat'&&<div style={{marginBottom:'0.4rem'}}><span style={{fontSize:'0.67rem',fontWeight:700,padding:'0.15rem 0.5rem',borderRadius:'999px',background:d2.bg,color:d2.color,border:`1px solid ${d2.bdr}`}}>{d2.emoji} {data.disasterType}</span></div>}
                    <div className="monitor-card-footer"><span>🌬️{data.wind}km/h</span><span>🌧️{data.rain}mm</span></div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
