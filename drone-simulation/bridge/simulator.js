import { CONFIG } from './config.js';

const drones = new Map();

const metersToLat = (m) => m / 111000;
const metersToLng = (m, lat) => m / (111000 * Math.cos((lat * Math.PI) / 180));

export function initDrones() {
  const { cols, rows, spacing } = CONFIG.GRID;
  const dLat = metersToLat(spacing);
  const dLng = metersToLng(spacing, CONFIG.CENTER.lat);

  let id = 1;
  for (let r = 0; r < rows && id <= CONFIG.DRONE_COUNT; r++) {
    for (let c = 0; c < cols && id <= CONFIG.DRONE_COUNT; c++) {
      const lat = CONFIG.CENTER.lat + (r - rows / 2) * dLat;
      const lng = CONFIG.CENTER.lng + (c - cols / 2) * dLng;
      drones.set(id, {
        id,
        lat,
        lng,
        alt: 0,
        battery: 100,
        status: 'idle',
        home: { lat, lng },
        hoverLat: lat,
        hoverLng: lng,
        target: null,
        waypoints: [],
        heading: 0,
        targetHeading: null,
        offlineUntil: 0,
        _phaseLat: Math.random() * Math.PI * 2,
        _phaseLng: Math.random() * Math.PI * 2,
        _freqLat: 0.3 + Math.random() * 0.3,
        _freqLng: 0.3 + Math.random() * 0.3
      });
      id++;
    }
  }
}

export function getDrones() {
  return drones;
}

export function tick(dtMs) {
  const dt = dtMs / 1000;
  const now = Date.now();

  // Phase 1: 모든 드론의 다음 위치 계산 (이전 tick 위치 기반)
  const updates = [];

  for (const d of drones.values()) {
    if (d.status === 'offline' && d.offlineUntil <= now) {
      d.status = d.target ? 'moving' : 'idle';
    }

    const altOnly = d.target?.altOnly === true;
    const targetLat = d.target ? d.target.lat : d.hoverLat;
    const targetLng = d.target ? d.target.lng : d.hoverLng;
    const targetAlt = d.target && d.target.alt != null ? d.target.alt : d.alt;

    const dLatRemain = altOnly ? 0 : targetLat - d.lat;
    const dLngRemain = altOnly ? 0 : targetLng - d.lng;
    const dAltRemain = targetAlt - d.alt;

    const latM = dLatRemain * 111000;
    const lngM = dLngRemain * 111000 * Math.cos((d.lat * Math.PI) / 180);
    const horizDist = Math.sqrt(latM * latM + lngM * lngM);

    // altOnly: 수평 이동·회피 모두 막음 (제자리에서 고도만 변경)
    let vxM = 0;
    let vyM = 0;
    if (!altOnly) {
      // Seek
      if (horizDist > 0.05) {
        const desiredSpeed = d.target
          ? CONFIG.DEFAULT_SPEED
          : Math.min(CONFIG.HOVER_RETURN_SPEED, horizDist * 2);
        vxM = (latM / horizDist) * desiredSpeed;
        vyM = (lngM / horizDist) * desiredSpeed;
      }

      // Separation
      if (CONFIG.SEPARATION_ENABLED) {
        let sepX = 0;
        let sepY = 0;
        for (const o of drones.values()) {
          if (o.id === d.id) continue;
          if (o.status === 'offline' && o.offlineUntil > now) continue;
          const dxM = (d.lat - o.lat) * 111000;
          const dyM =
            (d.lng - o.lng) * 111000 * Math.cos((d.lat * Math.PI) / 180);
          const dist = Math.sqrt(dxM * dxM + dyM * dyM);
          if (dist > 0 && dist < CONFIG.SEPARATION_RADIUS) {
            const strength =
              (CONFIG.SEPARATION_RADIUS - dist) / CONFIG.SEPARATION_RADIUS;
            sepX += (dxM / dist) * strength;
            sepY += (dyM / dist) * strength;
          }
        }
        vxM += sepX * CONFIG.SEPARATION_WEIGHT;
        vyM += sepY * CONFIG.SEPARATION_WEIGHT;
      }

      // 최대 속도 제한
      const speed = Math.sqrt(vxM * vxM + vyM * vyM);
      const maxSpeed = d.target
        ? CONFIG.DEFAULT_SPEED
        : CONFIG.DEFAULT_SPEED * 0.6;
      if (speed > maxSpeed) {
        vxM = (vxM / speed) * maxSpeed;
        vyM = (vyM / speed) * maxSpeed;
      }
    }

    // 고도
    const stepVert = CONFIG.VERTICAL_SPEED * dt;
    let newAlt;
    if (Math.abs(dAltRemain) <= stepVert) {
      newAlt = targetAlt;
    } else {
      newAlt = d.alt + Math.sign(dAltRemain) * stepVert;
    }

    updates.push({
      d,
      newLat: d.lat + metersToLat(vxM * dt),
      newLng: d.lng + metersToLng(vyM * dt, d.lat),
      newAlt,
      horizDist,
      dAltRemain
    });
  }

  // 회전 처리 (이동과 독립, yaw 별도 제어)
  for (const d of drones.values()) {
    if (d.targetHeading === null) continue;
    let dh = d.targetHeading - d.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    const maxStep = CONFIG.ROTATION_SPEED * dt;
    if (Math.abs(dh) <= maxStep) {
      d.heading = d.targetHeading;
      d.targetHeading = null;
    } else {
      d.heading += Math.sign(dh) * maxStep;
    }
    d.heading =
      ((d.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  }

  // Phase 2: 적용
  for (const u of updates) {
    const { d, newLat, newLng, newAlt, horizDist, dAltRemain } = u;
    d.lat = newLat;
    d.lng = newLng;
    d.alt = newAlt;

    if (d.target) {
      const horizDone =
        d.target.altOnly === true || horizDist < CONFIG.ARRIVAL_THRESHOLD;
      if (horizDone && Math.abs(dAltRemain) < 0.5) {
        // 큐에 다음 waypoint 있으면 그쪽으로 (heading도 갱신)
        if (d.waypoints && d.waypoints.length > 0) {
          d.waypoints.shift();
          if (d.waypoints.length > 0) {
            d.target = d.waypoints[0];
            if (d.target.heading != null) d.targetHeading = d.target.heading;
            if (d.status !== 'offline') d.status = 'moving';
          } else {
            d.target = null;
            d.hoverLat = d.lat;
            d.hoverLng = d.lng;
            if (d.status !== 'offline') d.status = 'idle';
          }
        } else {
          d.target = null;
          d.hoverLat = d.lat;
          d.hoverLng = d.lng;
          if (d.status !== 'offline') d.status = 'idle';
        }
      } else if (d.status !== 'offline') {
        d.status = 'moving';
      }
    }

    const drainRate =
      d.status === 'moving'
        ? CONFIG.BATTERY_DRAIN_MOVE
        : CONFIG.BATTERY_DRAIN_IDLE;
    d.battery = Math.max(0, d.battery - (drainRate * dt) / 60);

    if (CONFIG.FAULT_SIM && d.status !== 'offline') {
      if (Math.random() < CONFIG.FAULT_OFFLINE_PROB) {
        d.status = 'offline';
        d.offlineUntil = now + CONFIG.FAULT_OFFLINE_DURATION_MS;
      } else if (Math.random() < CONFIG.FAULT_BATTERY_DROP_PROB) {
        d.battery = Math.max(0, d.battery - 10);
      } else if (Math.random() < CONFIG.FAULT_GPS_JUMP_PROB) {
        d._gpsJumpOffset = {
          lat: metersToLat((Math.random() - 0.5) * 20),
          lng: metersToLng((Math.random() - 0.5) * 20, d.lat),
          framesLeft: 1
        };
      }
    }
  }
}

export function buildTelemetry() {
  const out = [];
  const now = Date.now();

  for (const d of drones.values()) {
    if (d.status === 'offline' && d.offlineUntil > now) continue;

    const tSec = now / 1000;
    const noiseLat =
      Math.sin(tSec * d._freqLat + d._phaseLat) *
      metersToLat(CONFIG.GPS_NOISE);
    const noiseLng =
      Math.cos(tSec * d._freqLng + d._phaseLng) *
      metersToLng(CONFIG.GPS_NOISE, d.lat);

    let jumpLat = 0;
    let jumpLng = 0;
    if (d._gpsJumpOffset && d._gpsJumpOffset.framesLeft > 0) {
      jumpLat = d._gpsJumpOffset.lat;
      jumpLng = d._gpsJumpOffset.lng;
      d._gpsJumpOffset.framesLeft--;
      if (d._gpsJumpOffset.framesLeft <= 0) d._gpsJumpOffset = null;
    }

    let status = d.status;
    if (
      (status === 'idle' || status === 'moving') &&
      d.battery < CONFIG.BATTERY_WARNING_THRESHOLD
    ) {
      status = 'warning';
    }

    out.push({
      id: d.id,
      lat: +(d.lat + noiseLat + jumpLat).toFixed(7),
      lng: +(d.lng + noiseLng + jumpLng).toFixed(7),
      alt: +d.alt.toFixed(1),
      heading: +d.heading.toFixed(3),
      battery: Math.round(d.battery),
      status,
      target: d.target
        ? {
            lat: +d.target.lat.toFixed(7),
            lng: +d.target.lng.toFixed(7),
            alt: d.target.alt ?? null
          }
        : null,
      waypoints:
        d.waypoints && d.waypoints.length > 0
          ? d.waypoints.map((w) => ({
              lat: +w.lat.toFixed(7),
              lng: +w.lng.toFixed(7),
              alt: w.alt ?? null,
              heading: w.heading != null ? +w.heading.toFixed(3) : null
            }))
          : null
    });
  }

  return out;
}
