'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '@/lib/store';
import type { MapTheme } from '@/lib/store';
import { connect, disconnect, sendCommand } from '@/lib/ws';
import type { Drone, DroneStatus } from '@/lib/types';

const TILE_CONFIG: Record<
  MapTheme,
  { url: string; attribution: string; maxNativeZoom: number; subdomains?: string }
> = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO',
    maxNativeZoom: 19,
    subdomains: 'abcd',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OSM &copy; CARTO',
    maxNativeZoom: 19,
    subdomains: 'abcd',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri World Imagery',
    maxNativeZoom: 19,
  },
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxNativeZoom: 19,
  },
};

function makeTileLayer(theme: MapTheme): L.TileLayer {
  const cfg = TILE_CONFIG[theme];
  return L.tileLayer(cfg.url, {
    attribution: cfg.attribution,
    maxZoom: 22,
    maxNativeZoom: cfg.maxNativeZoom,
    subdomains: cfg.subdomains ?? 'abc',
  });
}

const STATUS_COLOR: Record<DroneStatus, string> = {
  idle: '#9ca3af',
  moving: '#3b82f6',
  warning: '#eab308',
  error: '#ef4444',
  offline: '#475569',
};

const WS_URL = process.env.NEXT_PUBLIC_BRIDGE_URL ?? 'ws://localhost:8080';
const DEFAULT_ALT = 30;
const HIT_RADIUS = 16;
const CLICK_THRESHOLD = 5;
const TELEM_INTERVAL = 100; // bridge 송신 주기 (ms)
const ALT_MAX_DISPLAY = 150; // 인디케이터 게이지 최대 고도 (m)
const BAR_W = 3;
const BAR_H = 16;
const BAR_OFFSET_X = 14; // 본체 오른쪽
const BAR_OFFSET_Y = -8;

function interpolatePos(d: Drone, now: number): { lat: number; lng: number } {
  if (d._prevLat == null || d._prevLng == null || d._updateTime == null) {
    return { lat: d.lat, lng: d.lng };
  }
  const dt = now - d._updateTime;
  const ratio = Math.max(0, Math.min(1, dt / TELEM_INTERVAL));
  return {
    lat: d._prevLat + (d.lat - d._prevLat) * ratio,
    lng: d._prevLng + (d.lng - d._prevLng) * ratio,
  };
}

type DragState =
  | { type: 'idle' }
  | { type: 'select-box'; startX: number; startY: number; currX: number; currY: number }
  | { type: 'drone-pending'; droneId: number; startX: number; startY: number; toggle: boolean }
  | { type: 'map-pan-pending'; startX: number; startY: number }
  | { type: 'drawing-line'; points: Array<[number, number]> };

function distributeOnLine(
  points: Array<[number, number]>,
  n: number
): Array<{ x: number; y: number; tangent: number }> {
  if (points.length === 0 || n === 0) return [];
  if (points.length === 1) {
    return Array.from({ length: n }, () => ({
      x: points[0][0],
      y: points[0][1],
      tangent: 0,
    }));
  }
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    distances.push(distances[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLen = distances[distances.length - 1];
  if (totalLen < 1) {
    return Array.from({ length: n }, () => ({
      x: points[0][0],
      y: points[0][1],
      tangent: 0,
    }));
  }
  const step = n > 1 ? totalLen / (n - 1) : 0;
  const result: Array<{ x: number; y: number; tangent: number }> = [];
  for (let i = 0; i < n; i++) {
    const target = i * step;
    let j = 0;
    while (j < distances.length - 1 && distances[j + 1] < target) j++;
    const segLen = distances[j + 1] - distances[j];
    const ratio = segLen > 0 ? (target - distances[j]) / segLen : 0;
    const x = points[j][0] + (points[j + 1][0] - points[j][0]) * ratio;
    const y = points[j][1] + (points[j + 1][1] - points[j][1]) * ratio;
    const dx = points[j + 1][0] - points[j][0];
    const dy = points[j + 1][1] - points[j][1];
    // canvas y+ = 남쪽. compass heading: atan2(east, -north) = atan2(dx, -dy)
    const tangent = Math.atan2(dx, -dy);
    result.push({ x, y, tangent });
  }
  return result;
}

// 탐욕 매칭: 가까운 드론·점 쌍부터 할당
function greedyMatch(
  drones: Array<{ id: number; x: number; y: number }>,
  points: Array<{ x: number; y: number }>
): Array<{ droneId: number; pointIdx: number }> {
  type Pair = { di: number; pi: number; dist: number };
  const pairs: Pair[] = [];
  for (let i = 0; i < drones.length; i++) {
    for (let j = 0; j < points.length; j++) {
      const dx = drones[i].x - points[j].x;
      const dy = drones[i].y - points[j].y;
      pairs.push({ di: i, pi: j, dist: dx * dx + dy * dy });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);
  const usedD = new Set<number>();
  const usedP = new Set<number>();
  const result: Array<{ droneId: number; pointIdx: number }> = [];
  for (const p of pairs) {
    if (usedD.has(p.di) || usedP.has(p.pi)) continue;
    result.push({ droneId: drones[p.di].id, pointIdx: p.pi });
    usedD.add(p.di);
    usedP.add(p.pi);
    if (result.length === Math.min(drones.length, points.length)) break;
  }
  return result;
}

const SPRITE_SIZE = 44;
const SPRITE_ARM = 12;
const SPRITE_PROP_R = 5;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeSprite(status: DroneStatus, dpr: number): HTMLCanvasElement {
  const sz = SPRITE_SIZE;
  const c = document.createElement('canvas');
  c.width = sz * dpr;
  c.height = sz * dpr;
  const cx = c.getContext('2d');
  if (!cx) return c;
  cx.scale(dpr, dpr);
  cx.translate(sz / 2, sz / 2);

  const isOffline = status === 'offline';
  const ledColor = STATUS_COLOR[status];

  // 1) 지면 그림자
  if (!isOffline) {
    cx.fillStyle = 'rgba(0,0,0,0.32)';
    cx.beginPath();
    cx.ellipse(0, 7, 13, 4, 0, 0, Math.PI * 2);
    cx.fill();
  }

  // 2) X자 암 (어두운 / 진한 검정)
  cx.strokeStyle = isOffline ? '#1e293b' : '#09090b';
  cx.lineWidth = 2.6;
  cx.lineCap = 'round';
  cx.beginPath();
  cx.moveTo(-SPRITE_ARM, -SPRITE_ARM);
  cx.lineTo(SPRITE_ARM, SPRITE_ARM);
  cx.moveTo(-SPRITE_ARM, SPRITE_ARM);
  cx.lineTo(SPRITE_ARM, -SPRITE_ARM);
  cx.stroke();

  // 암 하이라이트 (얇은 회색 선)
  if (!isOffline) {
    cx.strokeStyle = 'rgba(120,120,135,0.45)';
    cx.lineWidth = 0.8;
    cx.beginPath();
    cx.moveTo(-SPRITE_ARM + 1, -SPRITE_ARM + 1);
    cx.lineTo(SPRITE_ARM - 1, SPRITE_ARM - 1);
    cx.moveTo(-SPRITE_ARM + 1, SPRITE_ARM - 1);
    cx.lineTo(SPRITE_ARM - 1, -SPRITE_ARM + 1);
    cx.stroke();
  }

  // 3) 4 프로펠러 (gradient로 디스크 입체감)
  const props: [number, number][] = [
    [-SPRITE_ARM, -SPRITE_ARM],
    [SPRITE_ARM, -SPRITE_ARM],
    [SPRITE_ARM, SPRITE_ARM],
    [-SPRITE_ARM, SPRITE_ARM],
  ];
  for (const [px, py] of props) {
    // gradient
    if (isOffline) {
      cx.fillStyle = '#0f172a';
    } else {
      const grad = cx.createRadialGradient(px - 1, py - 1, 0.5, px, py, SPRITE_PROP_R);
      grad.addColorStop(0, '#71717a');
      grad.addColorStop(0.6, '#27272a');
      grad.addColorStop(1, '#09090b');
      cx.fillStyle = grad;
    }
    cx.beginPath();
    cx.arc(px, py, SPRITE_PROP_R, 0, Math.PI * 2);
    cx.fill();
    // 테두리
    cx.strokeStyle = isOffline ? '#020617' : '#09090b';
    cx.lineWidth = 1;
    cx.stroke();
    // 회전 흐림 표시 (프로펠러 회전 라인)
    if (!isOffline) {
      cx.strokeStyle = 'rgba(180,180,190,0.35)';
      cx.lineWidth = 0.6;
      cx.beginPath();
      cx.arc(px, py, SPRITE_PROP_R - 1.3, -Math.PI * 0.35, Math.PI * 0.35);
      cx.stroke();
      cx.beginPath();
      cx.arc(px, py, SPRITE_PROP_R - 1.3, Math.PI * 0.65, Math.PI * 1.35);
      cx.stroke();
    }
  }

  // 4) 중앙 body (어두운 디스크 + outline)
  const bodyR = 6;
  if (isOffline) {
    cx.fillStyle = '#0f172a';
  } else {
    const bodyGrad = cx.createRadialGradient(-1.5, -1.5, 0.5, 0, 0, bodyR);
    bodyGrad.addColorStop(0, '#2a2a2e');
    bodyGrad.addColorStop(0.7, '#0f0f12');
    bodyGrad.addColorStop(1, '#000000');
    cx.fillStyle = bodyGrad;
  }
  cx.beginPath();
  cx.arc(0, 0, bodyR, 0, Math.PI * 2);
  cx.fill();
  cx.strokeStyle = isOffline ? '#1e293b' : '#3f3f46';
  cx.lineWidth = 1;
  cx.stroke();

  // 5) LED 글로우 (offline 제외)
  if (!isOffline) {
    const glow = cx.createRadialGradient(0, 0, 0.5, 0, 0, 9);
    glow.addColorStop(0, ledColor);
    glow.addColorStop(0.25, hexToRgba(ledColor, 0.7));
    glow.addColorStop(0.6, hexToRgba(ledColor, 0.25));
    glow.addColorStop(1, hexToRgba(ledColor, 0));
    cx.fillStyle = glow;
    cx.beginPath();
    cx.arc(0, 0, 9, 0, Math.PI * 2);
    cx.fill();
  }

  // 6) LED 본체
  cx.fillStyle = isOffline ? '#020617' : ledColor;
  cx.beginPath();
  cx.arc(0, 0, 2.6, 0, Math.PI * 2);
  cx.fill();

  // 7) LED 반사 하이라이트
  if (!isOffline) {
    cx.fillStyle = 'rgba(255,255,255,0.75)';
    cx.beginPath();
    cx.arc(-0.8, -0.8, 0.9, 0, Math.PI * 2);
    cx.fill();
  }

  // 8) Nose (앞쪽 방향 식별 — +X가 앞)
  cx.fillStyle = isOffline ? '#1e293b' : '#ef4444';
  cx.strokeStyle = 'rgba(0,0,0,0.7)';
  cx.lineWidth = 0.6;
  cx.beginPath();
  cx.moveTo(bodyR + 3.5, 0);
  cx.lineTo(bodyR - 0.5, -2.6);
  cx.lineTo(bodyR - 0.5, 2.6);
  cx.closePath();
  cx.fill();
  cx.stroke();

  return c;
}

export default function MapClient() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: [37.5665, 126.978],
      zoom: 19,
      maxZoom: 22,
      zoomControl: false,
      fadeAnimation: false,
      preferCanvas: true,
    });

    let currentTheme: MapTheme = useStore.getState().mapTheme;
    let tileLayer = makeTileLayer(currentTheme).addTo(map);

    const unsubscribeTheme = useStore.subscribe((state) => {
      if (state.mapTheme !== currentTheme) {
        currentTheme = state.mapTheme;
        const next = makeTileLayer(currentTheme).addTo(map);
        next.once('load', () => {
          map.removeLayer(tileLayer);
          tileLayer = next;
        });
        // 폴백: 4초 안에 load 안 들어와도 강제 교체
        setTimeout(() => {
          if (tileLayer !== next) {
            map.removeLayer(tileLayer);
            tileLayer = next;
          }
        }, 4000);
      }
    });

    // Leaflet pane 통합: 캔버스를 overlayPane에 부착
    // → 팬 시 leaflet의 mapPane transform이 캔버스를 같이 끌고 감 (paint 부담 없음)
    const overlayPane = map.getPane('overlayPane');
    if (!overlayPane) return;
    const canvas = L.DomUtil.create(
      'canvas',
      'drone-canvas-layer'
    ) as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    overlayPane.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let canvasOrigin = L.point(0, 0);

    const reset = () => {
      const size = map.getSize();
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';

      // 캔버스를 layer 좌표 [0,0] 위치에 배치 → 팬 시 leaflet이 같이 transform
      canvasOrigin = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, canvasOrigin);
    };
    reset();
    map.on('resize', reset);
    map.on('viewreset', reset);
    map.on('zoomend', reset);
    map.on('moveend', reset);

    // 줌 애니메이션 동안 캔버스 일시 숨김 — leaflet과 동기화 안 되는 글리치 방지
    let zooming = false;
    const onZoomStart = () => {
      zooming = true;
      canvas.style.visibility = 'hidden';
    };
    const onZoomEnd = () => {
      zooming = false;
      canvas.style.visibility = '';
    };
    map.on('zoomstart', onZoomStart);
    map.on('zoomend', onZoomEnd);

    let drag: DragState = { type: 'idle' };

    const getOffset = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const hitTest = (px: number, py: number): Drone | null => {
      const now = performance.now();
      const drones = useStore.getState().drones;
      for (const d of drones.values()) {
        const pos = interpolatePos(d, now);
        const p = map.latLngToContainerPoint([pos.lat, pos.lng]);
        const dx = p.x - px;
        const dy = p.y - py;
        if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) return d;
      }
      return null;
    };

    const endDrag = () => {
      drag = { type: 'idle' };
      map.dragging.enable();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    const finalizeLine = (linePoints: Array<[number, number]>) => {
      const state = useStore.getState();
      const sel = state.selected;
      if (sel.size === 0 || linePoints.length < 2) return;

      // 선택 드론 정보 수집 (현재 화면 좌표)
      const drones = state.drones;
      const droneInfo: Array<{ id: number; x: number; y: number }> = [];
      for (const id of sel) {
        const d = drones.get(id);
        if (!d) continue;
        const cp = map.latLngToContainerPoint([d.lat, d.lng]);
        droneInfo.push({ id: d.id, x: cp.x, y: cp.y });
      }
      if (droneInfo.length === 0) return;

      // 선 위에 균등 점 분포
      const distributed = distributeOnLine(linePoints, droneInfo.length);

      // 탐욕 매칭 (가까운 드론·점 쌍부터)
      const matches = greedyMatch(droneInfo, distributed);

      // 명령 발행: 각 드론의 lat/lng + 접선 heading
      const positions = matches.map((m) => {
        const point = distributed[m.pointIdx];
        const ll = map.containerPointToLatLng([point.x, point.y]);
        return {
          id: m.droneId,
          lat: ll.lat,
          lng: ll.lng,
          alt: state.targetAltitude,
          heading: point.tangent,
        };
      });

      sendCommand({
        type: 'command',
        cmd: 'assignLine',
        targets: positions.map((p) => p.id),
        payload: { positions, append: false },
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const { x, y } = getOffset(e);

      // 드로잉 모드 — 다른 인터랙션 모두 무시
      if (useStore.getState().drawingMode) {
        e.preventDefault();
        e.stopPropagation();
        map.dragging.disable();
        drag = { type: 'drawing-line', points: [[x, y]] };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return;
      }

      const drone = hitTest(x, y);

      if (drone) {
        e.preventDefault();
        e.stopPropagation();
        map.dragging.disable();
        drag = {
          type: 'drone-pending',
          droneId: drone.id,
          startX: x,
          startY: y,
          toggle: e.shiftKey,
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      } else if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        map.dragging.disable();
        drag = { type: 'select-box', startX: x, startY: y, currX: x, currY: y };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      } else {
        // 빈 곳 클릭: 작은 이동이면 선택 해제, 큰 이동이면 지도 팬
        drag = { type: 'map-pan-pending', startX: x, startY: y };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const { x, y } = getOffset(e);
      if (drag.type === 'drawing-line') {
        const last = drag.points[drag.points.length - 1];
        if (!last || (x - last[0]) ** 2 + (y - last[1]) ** 2 > 9) {
          drag.points.push([x, y]);
        }
      } else if (drag.type === 'select-box') {
        drag.currX = x;
        drag.currY = y;
      } else if (drag.type === 'drone-pending') {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        if (dx * dx + dy * dy > CLICK_THRESHOLD * CLICK_THRESHOLD) {
          if (e.shiftKey) {
            // 드론 위에서 시작했어도 shift 드래그면 박스 선택으로 전환
            drag = {
              type: 'select-box',
              startX: drag.startX,
              startY: drag.startY,
              currX: x,
              currY: y,
            };
          } else {
            endDrag();
          }
        }
      } else if (drag.type === 'map-pan-pending') {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        if (dx * dx + dy * dy > CLICK_THRESHOLD * CLICK_THRESHOLD) {
          // 지도 팬으로 간주 → 우리 트래킹 종료, leaflet이 처리
          endDrag();
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (drag.type === 'drawing-line') {
        finalizeLine(drag.points);
        useStore.getState().setDrawingMode(false);
      } else if (drag.type === 'select-box') {
        const minX = Math.min(drag.startX, drag.currX);
        const maxX = Math.max(drag.startX, drag.currX);
        const minY = Math.min(drag.startY, drag.currY);
        const maxY = Math.max(drag.startY, drag.currY);
        const hasArea = maxX - minX > 2 && maxY - minY > 2;
        if (hasArea) {
          const now = performance.now();
          const next = new Set<number>();
          for (const d of useStore.getState().drones.values()) {
            const pos = interpolatePos(d, now);
            const p = map.latLngToContainerPoint([pos.lat, pos.lng]);
            if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
              next.add(d.id);
            }
          }
          useStore.getState().setSelected(next);
        }
      } else if (drag.type === 'drone-pending') {
        if (drag.toggle) {
          const next = new Set(useStore.getState().selected);
          if (next.has(drag.droneId)) next.delete(drag.droneId);
          else next.add(drag.droneId);
          useStore.getState().setSelected(next);
        } else {
          useStore.getState().setSelected(new Set([drag.droneId]));
        }
      } else if (drag.type === 'map-pan-pending') {
        // 빈 곳 클릭(이동 작음) → 선택 해제
        useStore.getState().setSelected(new Set());
      }
      void e;
      endDrag();
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const state = useStore.getState();
      const selected = state.selected;
      if (selected.size === 0) return;
      const { x, y } = getOffset(e);
      const ll = map.containerPointToLatLng([x, y]);
      const targets = Array.from(selected);
      const alt = state.targetAltitude;
      const heading = state.targetHeading;
      const append = e.shiftKey;
      const payload = {
        lat: ll.lat,
        lng: ll.lng,
        alt,
        heading,
        append,
      };
      if (targets.length === 1) {
        sendCommand({ type: 'command', cmd: 'moveTo', targets, payload });
      } else {
        sendCommand({
          type: 'command',
          cmd: 'moveFormation',
          targets,
          payload,
        });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as Element | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Escape') {
        // 드로잉 모드면 모드 해제 (선택은 유지)
        if (useStore.getState().drawingMode) {
          useStore.getState().setDrawingMode(false);
          if (drag.type === 'drawing-line') endDrag();
        } else {
          useStore.getState().setSelected(new Set());
        }
        return;
      }
      const sel = useStore.getState().selected;
      if (sel.size === 0) return;
      const targets = Array.from(sel);

      if (e.code === 'Space') {
        e.preventDefault();
        sendCommand({ type: 'command', cmd: 'stop', targets });
      } else if (e.code === 'KeyH') {
        sendCommand({ type: 'command', cmd: 'home', targets });
      } else if (e.code === 'KeyL') {
        sendCommand({ type: 'command', cmd: 'land', targets });
      }
    };

    container.addEventListener('mousedown', onMouseDown, { capture: true });
    container.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    connect(WS_URL);

    const sprites: Record<DroneStatus, HTMLCanvasElement> = {
      idle: makeSprite('idle', dpr),
      moving: makeSprite('moving', dpr),
      warning: makeSprite('warning', dpr),
      error: makeSprite('error', dpr),
      offline: makeSprite('offline', dpr),
    };
    const half = SPRITE_SIZE / 2;

    // setTransform 기반 드론 그리기 (save/restore 없이 변환 절대 설정)
    const drawSprite = (
      x: number,
      y: number,
      status: DroneStatus,
      rotation: number | null,
      alpha = 1
    ) => {
      ctx.globalAlpha = alpha;
      const ix = x | 0;
      const iy = y | 0;
      if (rotation === null) {
        ctx.setTransform(dpr, 0, 0, dpr, ix * dpr, iy * dpr);
      } else {
        const c = Math.cos(rotation);
        const s = Math.sin(rotation);
        ctx.setTransform(
          c * dpr,
          s * dpr,
          -s * dpr,
          c * dpr,
          ix * dpr,
          iy * dpr
        );
      }
      ctx.drawImage(sprites[status], -half, -half, SPRITE_SIZE, SPRITE_SIZE);
    };

    const resetTransform = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    };

    let frameId = 0;
    let lastDrawTs = 0;
    const DRAW_INTERVAL = 1000 / 30;

    const draw = (ts = 0) => {
      if (zooming) {
        frameId = requestAnimationFrame(draw);
        return;
      }
      if (ts - lastDrawTs < DRAW_INTERVAL) {
        frameId = requestAnimationFrame(draw);
        return;
      }
      lastDrawTs = ts;

      const size = map.getSize();
      ctx.clearRect(0, 0, size.x, size.y);

      const { drones, selected } = useStore.getState();
      const now = performance.now();

      const ox = canvasOrigin.x;
      const oy = canvasOrigin.y;

      // 1) 선택된 드론의 웨이포인트 큐 시각화
      type Seg = { fx: number; fy: number; tx: number; ty: number };
      const segments: Seg[] = [];
      const midPoints: { x: number; y: number }[] = [];
      const finalPoints: { x: number; y: number }[] = [];

      for (const id of selected) {
        const d = drones.get(id);
        if (!d) continue;
        const wps =
          d.waypoints && d.waypoints.length > 0
            ? d.waypoints
            : d.target
              ? [d.target]
              : [];
        if (wps.length === 0) continue;

        const pos = interpolatePos(d, now);
        const lp = map.latLngToLayerPoint([pos.lat, pos.lng]);
        let lastX = lp.x - ox;
        let lastY = lp.y - oy;

        for (let i = 0; i < wps.length; i++) {
          const w = wps[i];
          const wlp = map.latLngToLayerPoint([w.lat, w.lng]);
          const wx = wlp.x - ox;
          const wy = wlp.y - oy;
          segments.push({ fx: lastX, fy: lastY, tx: wx, ty: wy });
          if (i === wps.length - 1) {
            finalPoints.push({ x: wx, y: wy });
          } else {
            midPoints.push({ x: wx, y: wy });
          }
          lastX = wx;
          lastY = wy;
        }
      }

      if (segments.length > 0) {
        // 점선 일괄
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        for (const s of segments) {
          ctx.moveTo(s.fx, s.fy);
          ctx.lineTo(s.tx, s.ty);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 중간 웨이포인트 — 작은 점
        if (midPoints.length > 0) {
          ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (const m of midPoints) {
            ctx.moveTo(m.x + 4, m.y);
            ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
          }
          ctx.fill();
          ctx.stroke();
        }

        // 최종 도착 실루엣
        for (const f of finalPoints) {
          drawSprite(f.x, f.y, 'idle', null, 0.32);
        }
        resetTransform();

        // 최종 도착 ring
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        for (const f of finalPoints) {
          ctx.moveTo(f.x + 17, f.y);
          ctx.arc(f.x, f.y, 17, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 2) 드론 본체 — 본체는 자리 그대로, 고도는 옆 인디케이터 바로 표시
      type RenderEntry = {
        id: number;
        px: number;
        py: number;
        alt: number;
        status: DroneStatus;
        rotation: number | null;
        isMoving: boolean;
      };
      const list: RenderEntry[] = [];

      for (const d of drones.values()) {
        const pos = interpolatePos(d, now);
        const lp = map.latLngToLayerPoint([pos.lat, pos.lng]);
        const px = lp.x - ox;
        const py = lp.y - oy;

        if (px < -20 || py < -20 || px > size.x + 20 || py > size.y + 20)
          continue;

        // 회전 = drone 자체 heading (compass: 0=N), canvas: 0=+X
        // → canvas rotation = heading - PI/2
        const rotation =
          d.heading != null ? d.heading - Math.PI / 2 : null;
        const isMoving = d.status === 'moving' && d.target;

        list.push({
          id: d.id,
          px,
          py,
          alt: d.alt,
          status: d.status,
          rotation,
          isMoving: Boolean(isMoving),
        });
      }

      // 2-a) 본체 sprite (nose가 heading 표시)
      const ringPositions: { x: number; y: number }[] = [];
      for (const r of list) {
        drawSprite(r.px, r.py, r.status, r.rotation, 1);
        if (selected.has(r.id)) {
          ringPositions.push({ x: r.px, y: r.py });
        }
      }

      resetTransform();

      // 2-b) 고도 인디케이터 바 (모든 드론) — 본체 오른쪽 옆
      //   배경 박스 일괄
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (const r of list) {
        if (r.alt < 0.5) continue;
        ctx.fillRect(r.px + BAR_OFFSET_X, r.py + BAR_OFFSET_Y, BAR_W, BAR_H);
      }
      //   채우기 일괄 (고도 비례, 위에서 아래로 채워짐 = 게이지)
      ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
      for (const r of list) {
        if (r.alt < 0.5) continue;
        const ratio = Math.min(r.alt / ALT_MAX_DISPLAY, 1);
        const fillH = ratio * BAR_H;
        ctx.fillRect(
          r.px + BAR_OFFSET_X,
          r.py + BAR_OFFSET_Y + BAR_H - fillH,
          BAR_W,
          fillH
        );
      }

      // 2-c) 선택 ring
      if (ringPositions.length > 0) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const r of ringPositions) {
          ctx.moveTo(r.x + 18, r.y);
          ctx.arc(r.x, r.y, 18, 0, Math.PI * 2);
        }
        ctx.stroke();
      }

      // 2-d) 고도 수치 라벨 (선택 드론만)
      if (selected.size > 0) {
        ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.fillStyle = '#fbbf24';
        for (const r of list) {
          if (!selected.has(r.id)) continue;
          const text = `${Math.round(r.alt)}m`;
          const tx = r.px + BAR_OFFSET_X + BAR_W + 3;
          const ty = r.py;
          ctx.strokeText(text, tx, ty);
          ctx.fillText(text, tx, ty);
        }
      }

      // 3) 박스 선택 오버레이
      if (drag.type === 'select-box') {
        const x = Math.min(drag.startX, drag.currX);
        const y = Math.min(drag.startY, drag.currY);
        const w = Math.abs(drag.currX - drag.startX);
        const h = Math.abs(drag.currY - drag.startY);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.12)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      } else if (drag.type === 'drawing-line' && drag.points.length > 0) {
        // 드로잉 중인 선 (마우스 = container 좌표 → canvas 좌표 변환)
        // canvas는 overlayPane에서 layer 기준이라 container point → layer - origin
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < drag.points.length; i++) {
          const cp = map.containerPointToLayerPoint(drag.points[i]);
          const x = cp.x - ox;
          const y = cp.y - oy;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 시작점/끝점 마크
        if (drag.points.length >= 1) {
          ctx.fillStyle = '#fbbf24';
          for (const [idx, p] of [
            [0, drag.points[0]] as const,
            [
              drag.points.length - 1,
              drag.points[drag.points.length - 1],
            ] as const,
          ]) {
            const cp = map.containerPointToLayerPoint(p);
            ctx.beginPath();
            ctx.arc(cp.x - ox, cp.y - oy, idx === 0 ? 4 : 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      frameId = requestAnimationFrame(draw);
    };
    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      map.off('resize', reset);
      map.off('viewreset', reset);
      map.off('zoomend', reset);
      map.off('moveend', reset);
      container.removeEventListener('mousedown', onMouseDown, { capture: true });
      container.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      unsubscribeTheme();
      map.off('zoomstart', onZoomStart);
      map.off('zoomend', onZoomEnd);
      map.remove();
      canvas.remove();
      disconnect();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
