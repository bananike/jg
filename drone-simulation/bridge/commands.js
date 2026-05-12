export function handleCommand(msg, drones) {
  const { cmd, targets, payload } = msg;
  // assignLine은 targets 대신 positions 사용 가능
  if (
    cmd !== 'assignLine' &&
    (!Array.isArray(targets) || targets.length === 0)
  )
    return;

  switch (cmd) {
    case 'moveTo':
      forEach(targets, drones, (d) => {
        if (!payload.append) d.waypoints = [];
        const wp = {
          lat: payload.lat,
          lng: payload.lng,
          alt: payload.alt ?? d.alt
        };
        if (payload.heading != null) wp.heading = payload.heading;
        d.waypoints.push(wp);
        d.target = d.waypoints[0];
        if (d.target.heading != null) d.targetHeading = d.target.heading;
        if (d.status !== 'offline') d.status = 'moving';
      });
      break;

    case 'moveFormation':
      moveFormation(targets, payload, drones);
      break;

    case 'stop':
      forEach(targets, drones, (d) => {
        d.target = null;
        d.waypoints = [];
        d.hoverLat = d.lat;
        d.hoverLng = d.lng;
        if (d.status !== 'offline') d.status = 'idle';
      });
      break;

    case 'home':
      forEach(targets, drones, (d) => {
        d.waypoints = [{ lat: d.home.lat, lng: d.home.lng, alt: 0 }];
        d.target = d.waypoints[0];
        if (d.status !== 'offline') d.status = 'moving';
      });
      break;

    case 'land':
      forEach(targets, drones, (d) => {
        d.waypoints = [{ lat: d.lat, lng: d.lng, alt: 0 }];
        d.target = d.waypoints[0];
        if (d.status !== 'offline') d.status = 'moving';
      });
      break;

    case 'setHeading':
      forEach(targets, drones, (d) => {
        if (payload.heading == null) return;
        d.targetHeading = payload.heading;
      });
      break;

    case 'assignLine':
      if (!Array.isArray(payload.positions)) return;
      for (const item of payload.positions) {
        const d = drones.get(item.id);
        if (!d) continue;
        if (!payload.append) d.waypoints = [];
        const wp = {
          lat: item.lat,
          lng: item.lng,
          alt: item.alt ?? d.alt
        };
        if (item.heading != null) wp.heading = item.heading;
        d.waypoints.push(wp);
        d.target = d.waypoints[0];
        if (d.target.heading != null) d.targetHeading = d.target.heading;
        if (d.status !== 'offline') d.status = 'moving';
      }
      break;

    case 'setAltitude':
      forEach(targets, drones, (d) => {
        d.waypoints = [];
        d.target = {
          lat: d.lat,
          lng: d.lng,
          alt: payload.alt ?? d.alt,
          altOnly: true
        };
        if (d.status !== 'offline') d.status = 'moving';
      });
      break;

    default:
      console.warn(`[cmd] unknown command: ${cmd}`);
  }
}

function forEach(ids, drones, fn) {
  for (const id of ids) {
    const d = drones.get(id);
    if (d) fn(d);
  }
}

function moveFormation(targets, payload, drones) {
  // 큐의 마지막 위치(append 시) 또는 현재 위치 기준으로 중심 계산
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;
  for (const id of targets) {
    const d = drones.get(id);
    if (!d) continue;
    const last =
      payload.append && d.waypoints && d.waypoints.length > 0
        ? d.waypoints[d.waypoints.length - 1]
        : null;
    sumLat += last ? last.lat : d.lat;
    sumLng += last ? last.lng : d.lng;
    count++;
  }
  if (count === 0) return;

  const centerLat = sumLat / count;
  const centerLng = sumLng / count;
  const deltaLat = payload.lat - centerLat;
  const deltaLng = payload.lng - centerLng;

  for (const id of targets) {
    const d = drones.get(id);
    if (!d) continue;
    if (!payload.append) d.waypoints = [];
    const last =
      d.waypoints.length > 0 ? d.waypoints[d.waypoints.length - 1] : null;
    const baseLat = last ? last.lat : d.lat;
    const baseLng = last ? last.lng : d.lng;
    const wp = {
      lat: baseLat + deltaLat,
      lng: baseLng + deltaLng,
      alt: payload.alt ?? d.alt
    };
    if (payload.heading != null) wp.heading = payload.heading;
    d.waypoints.push(wp);
    d.target = d.waypoints[0];
    if (d.target.heading != null) d.targetHeading = d.target.heading;
    if (d.status !== 'offline') d.status = 'moving';
  }
}
