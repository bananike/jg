'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import type { MapTheme } from '@/lib/store';
import { sendCommand } from '@/lib/ws';
import type { CommandType, Drone, DroneStatus } from '@/lib/types';

const STATUS_COLOR: Record<DroneStatus, string> = {
  idle: '#9ca3af',
  moving: '#3b82f6',
  warning: '#eab308',
  error: '#ef4444',
  offline: '#475569',
};

const STATUS_LABEL: Record<DroneStatus, string> = {
  idle: '대기',
  moving: '이동',
  warning: '경고',
  error: '오류',
  offline: '오프라인',
};

export default function SidePanel() {
  return (
    <aside className="w-80 shrink-0 flex flex-col bg-neutral-950 text-neutral-100 border-l border-neutral-800 overflow-y-auto">
      <Header />
      <StatusSection />
      <SelectionSection />
      <CommandSection />
      <AltitudeSection />
      <RotationSection />
      <LineAssignSection />
      <ThemeSection />
      <LegendSection />
      <HintsSection />
    </aside>
  );
}

function Header() {
  return (
    <div className="px-4 py-3 border-b border-neutral-800">
      <h1 className="text-sm font-semibold tracking-wide">DRONE CONTROL</h1>
      <p className="text-[11px] text-neutral-500">200대 드론 시뮬레이션 콘솔</p>
    </div>
  );
}

function Section({
  title,
  children,
  trailing,
}: {
  title: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <section className="border-b border-neutral-800 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          {title}
        </h2>
        {trailing}
      </div>
      {children}
    </section>
  );
}

function StatusSection() {
  const connected = useStore((s) => s.connected);
  const droneCount = useStore((s) => s.drones.size);
  const selectedCount = useStore((s) => s.selected.size);

  return (
    <Section title="상태">
      <div className="space-y-1.5 text-sm">
        <Row label="연결">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-green-400' : 'bg-red-400'
              }`}
            />
            <span className="text-xs">
              {connected ? '브리지 연결됨' : '연결 끊김'}
            </span>
          </span>
        </Row>
        <Row label="드론">
          <span className="font-mono text-sm">{droneCount}대</span>
        </Row>
        <Row label="선택">
          <span
            className={`font-mono text-sm ${
              selectedCount > 0 ? 'text-amber-300' : 'text-neutral-300'
            }`}
          >
            {selectedCount}대
          </span>
        </Row>
      </div>
    </Section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-neutral-400">{label}</span>
      {children}
    </div>
  );
}

function SelectionSection() {
  const selected = useStore((s) => s.selected);
  const setSelected = useStore((s) => s.setSelected);
  const [snapshot, setSnapshot] = useState<Drone[]>([]);

  useEffect(() => {
    const sync = () => {
      const drones = useStore.getState().drones;
      const sel = useStore.getState().selected;
      const list: Drone[] = [];
      for (const id of sel) {
        const d = drones.get(id);
        if (d) list.push(d);
        if (list.length >= 30) break;
      }
      list.sort((a, b) => a.id - b.id);
      setSnapshot(list);
    };
    sync();
    const t = setInterval(sync, 500);
    return () => clearInterval(t);
  }, [selected]);

  const isEmpty = selected.size === 0;

  return (
    <Section
      title={isEmpty ? '선택된 드론' : `선택된 드론 (${selected.size})`}
      trailing={
        !isEmpty && (
          <button
            className="text-[11px] text-neutral-400 hover:text-neutral-200"
            onClick={() => setSelected(new Set())}
          >
            해제
          </button>
        )
      }
    >
      {isEmpty ? (
        <p className="text-xs text-neutral-500">
          지도에서 <Key>Shift</Key>+드래그로 선택
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {snapshot.map((d) => (
            <DroneRow key={d.id} drone={d} />
          ))}
          {selected.size > snapshot.length && (
            <p className="text-[11px] text-neutral-500 pt-1">
              외 {selected.size - snapshot.length}대
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

function DroneRow({ drone }: { drone: Drone }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_COLOR[drone.status] }}
        />
        <span className="font-mono text-neutral-300">#{drone.id}</span>
        <span className="text-neutral-500 truncate">
          {STATUS_LABEL[drone.status]}
        </span>
      </div>
      <span
        className={`font-mono shrink-0 ${
          drone.battery < 20 ? 'text-amber-400' : 'text-neutral-400'
        }`}
      >
        {drone.battery}%
      </span>
    </div>
  );
}

function CommandSection() {
  const selectedCount = useStore((s) => s.selected.size);
  const hasSelection = selectedCount > 0;

  const dispatch = (cmd: CommandType) => {
    const sel = useStore.getState().selected;
    if (sel.size === 0) return;
    sendCommand({ type: 'command', cmd, targets: Array.from(sel) });
  };

  return (
    <Section title="명령">
      <div className="grid grid-cols-2 gap-1.5">
        <CmdButton disabled={!hasSelection} onClick={() => dispatch('stop')}>
          <span>정지</span>
          <Key>Space</Key>
        </CmdButton>
        <CmdButton disabled={!hasSelection} onClick={() => dispatch('home')}>
          <span>홈 복귀</span>
          <Key>H</Key>
        </CmdButton>
        <CmdButton
          disabled={!hasSelection}
          onClick={() => dispatch('land')}
          variant="danger"
        >
          <span>착륙</span>
          <Key>L</Key>
        </CmdButton>
        <CmdButton disabled>
          <span className="text-neutral-500">(대형)</span>
        </CmdButton>
      </div>
      {hasSelection ? (
        <p className="mt-2 text-[11px] text-neutral-500">
          지도 우클릭 — 이동 명령
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-neutral-500">
          드론을 먼저 선택하세요
        </p>
      )}
    </Section>
  );
}

function CmdButton({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'danger';
}) {
  const base =
    'rounded px-2 py-2 flex items-center justify-between gap-1 transition-colors text-xs';
  const enabled =
    variant === 'danger'
      ? 'bg-red-900/40 hover:bg-red-900/60 text-red-100'
      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100';
  const disabledCls = 'bg-neutral-900 text-neutral-600 cursor-not-allowed';
  return (
    <button
      className={`${base} ${disabled ? disabledCls : enabled}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded bg-black/40 px-1 py-0.5 text-[10px] font-mono text-neutral-300 border border-neutral-700">
      {children}
    </kbd>
  );
}

function AltitudeSection() {
  const targetAltitude = useStore((s) => s.targetAltitude);
  const setTargetAltitude = useStore((s) => s.setTargetAltitude);
  const selectedCount = useStore((s) => s.selected.size);
  const hasSelection = selectedCount > 0;
  const [avgAlt, setAvgAlt] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => {
      const sel = useStore.getState().selected;
      const drones = useStore.getState().drones;
      if (sel.size === 0) {
        setAvgAlt(null);
        return;
      }
      let sum = 0;
      let count = 0;
      for (const id of sel) {
        const d = drones.get(id);
        if (!d) continue;
        sum += d.alt;
        count++;
      }
      setAvgAlt(count > 0 ? sum / count : null);
    };
    sync();
    const t = setInterval(sync, 500);
    return () => clearInterval(t);
  }, [selectedCount]);

  const applyAltitude = () => {
    const sel = useStore.getState().selected;
    if (sel.size === 0) return;
    sendCommand({
      type: 'command',
      cmd: 'setAltitude',
      targets: Array.from(sel),
      payload: { alt: targetAltitude },
    });
  };

  const presets = [0, 10, 30, 50, 80, 120];

  return (
    <Section
      title="고도"
      trailing={
        avgAlt !== null && (
          <span className="text-[11px] text-neutral-400 font-mono">
            평균 {avgAlt.toFixed(1)}m
          </span>
        )
      }
    >
      <div className="flex items-center gap-2 text-xs mb-2">
        <input
          type="range"
          min={0}
          max={150}
          step={5}
          value={targetAltitude}
          onChange={(e) => setTargetAltitude(Number(e.target.value))}
          className="flex-1 accent-amber-400"
        />
        <span className="font-mono w-12 text-right text-neutral-200 text-sm">
          {targetAltitude}m
        </span>
      </div>

      <div className="grid grid-cols-6 gap-1 mb-2">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => setTargetAltitude(p)}
            className={`h-6 rounded text-[11px] font-mono transition-colors ${
              targetAltitude === p
                ? 'bg-amber-500/25 text-amber-200 border border-amber-500/60'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-transparent'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <button
        disabled={!hasSelection}
        onClick={applyAltitude}
        className={`w-full h-8 rounded text-xs transition-colors ${
          hasSelection
            ? 'bg-blue-600/70 hover:bg-blue-600/90 text-white'
            : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
        }`}
      >
        선택 드론을 {targetAltitude}m 로 이동
      </button>
      <p className="mt-2 text-[11px] text-neutral-500">
        이 값은 우클릭 이동·방향 이동에도 함께 적용됩니다
      </p>
    </Section>
  );
}

function RotationSection() {
  const selectedCount = useStore((s) => s.selected.size);
  const hasSelection = selectedCount > 0;
  const targetHeadingRad = useStore((s) => s.targetHeading);
  const setTargetHeadingStore = useStore((s) => s.setTargetHeading);
  const headingDeg = Math.round((targetHeadingRad * 180) / Math.PI) % 360;
  const [sliderDeg, setSliderDeg] = useState(headingDeg);
  const [avgHeading, setAvgHeading] = useState<number | null>(null);

  useEffect(() => {
    setSliderDeg(headingDeg);
  }, [headingDeg]);

  useEffect(() => {
    const sync = () => {
      const sel = useStore.getState().selected;
      const drones = useStore.getState().drones;
      if (sel.size === 0) {
        setAvgHeading(null);
        return;
      }
      // 각도 평균은 sin/cos 사용
      let sx = 0;
      let sy = 0;
      let count = 0;
      for (const id of sel) {
        const d = drones.get(id);
        if (!d || d.heading == null) continue;
        sx += Math.sin(d.heading);
        sy += Math.cos(d.heading);
        count++;
      }
      if (count === 0) {
        setAvgHeading(null);
        return;
      }
      const rad = Math.atan2(sx, sy);
      const deg = ((rad * 180) / Math.PI + 360) % 360;
      setAvgHeading(deg);
    };
    sync();
    const t = setInterval(sync, 500);
    return () => clearInterval(t);
  }, [selectedCount]);

  const setHeadingValue = (angleDeg: number) => {
    const normalized = ((angleDeg % 360) + 360) % 360;
    const rad = (normalized * Math.PI) / 180;
    setTargetHeadingStore(rad);
    setSliderDeg(normalized);
  };

  const adjust = (delta: number) => {
    const base = avgHeading != null ? avgHeading : headingDeg;
    setHeadingValue(base + delta);
  };

  const applyHeading = () => {
    const sel = useStore.getState().selected;
    if (sel.size === 0) return;
    sendCommand({
      type: 'command',
      cmd: 'setHeading',
      targets: Array.from(sel),
      payload: { heading: targetHeadingRad },
    });
  };

  const cells: ({ angle: number; label: string } | null)[] = [
    { angle: 315, label: '↖' },
    { angle: 0, label: '↑' },
    { angle: 45, label: '↗' },
    { angle: 270, label: '←' },
    null,
    { angle: 90, label: '→' },
    { angle: 225, label: '↙' },
    { angle: 180, label: '↓' },
    { angle: 135, label: '↘' },
  ];

  return (
    <Section
      title="회전 (Yaw)"
      trailing={
        avgHeading !== null && (
          <span className="text-[11px] text-neutral-400 font-mono">
            현재 {Math.round(avgHeading)}°
          </span>
        )
      }
    >
      <div className="grid grid-cols-3 gap-1.5 w-40 mx-auto mb-3">
        {cells.map((cell, i) =>
          cell ? (
            <button
              key={i}
              onClick={() => setHeadingValue(cell.angle)}
              className={`h-11 rounded text-xl flex items-center justify-center transition-colors ${
                headingDeg === cell.angle
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-500/60'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-transparent'
              }`}
              title={`${cell.angle}°`}
            >
              {cell.label}
            </button>
          ) : (
            <div
              key={i}
              className="h-11 flex items-center justify-center text-[10px] text-neutral-600"
            >
              ●
            </div>
          )
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={() => adjust(-15)}
          className="flex-1 h-7 rounded text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
        >
          ↺ −15°
        </button>
        <button
          onClick={() => adjust(15)}
          className="flex-1 h-7 rounded text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
        >
          +15° ↻
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs mb-2">
        <span className="text-neutral-400 shrink-0">각도</span>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={sliderDeg}
          onChange={(e) => setSliderDeg(Number(e.target.value))}
          onMouseUp={() => setHeadingValue(sliderDeg)}
          onTouchEnd={() => setHeadingValue(sliderDeg)}
          className="flex-1 accent-amber-400"
        />
        <span className="font-mono w-10 text-right text-neutral-300">
          {sliderDeg}°
        </span>
      </div>

      <button
        disabled={!hasSelection}
        onClick={applyHeading}
        className={`w-full h-8 rounded text-xs transition-colors ${
          hasSelection
            ? 'bg-blue-600/70 hover:bg-blue-600/90 text-white'
            : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
        }`}
      >
        선택 드론을 {headingDeg}° 로 즉시 회전
      </button>
      <p className="mt-2 text-[11px] text-neutral-500">
        이 값은 우클릭 이동 큐에도 자동 포함 (회전+위치+고도 동시 예약)
      </p>
    </Section>
  );
}

function LineAssignSection() {
  const drawingMode = useStore((s) => s.drawingMode);
  const setDrawingMode = useStore((s) => s.setDrawingMode);
  const selectedCount = useStore((s) => s.selected.size);

  return (
    <Section
      title="선 정렬"
      trailing={
        drawingMode && (
          <span className="text-[11px] text-amber-300 font-mono">
            그리는 중
          </span>
        )
      }
    >
      <button
        disabled={selectedCount === 0}
        onClick={() => setDrawingMode(!drawingMode)}
        className={`w-full h-9 rounded text-xs transition-colors ${
          drawingMode
            ? 'bg-amber-500/30 text-amber-100 border border-amber-500/60'
            : selectedCount > 0
              ? 'bg-blue-600/70 hover:bg-blue-600/90 text-white'
              : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
        }`}
      >
        {drawingMode
          ? '드래그하여 선 그리기 (Esc 취소)'
          : `선 그리기 시작 (${selectedCount}대)`}
      </button>
      <p className="mt-2 text-[11px] text-neutral-500">
        지도에 드래그로 곡선을 그리면 선택 드론이 그 위에 균등 간격으로 정렬됩니다.
        진행 방향으로 자동 회전 + 패널 고도 적용.
      </p>
    </Section>
  );
}

function ThemeSection() {
  const mapTheme = useStore((s) => s.mapTheme);
  const setMapTheme = useStore((s) => s.setMapTheme);

  const themes: { key: MapTheme; label: string }[] = [
    { key: 'light', label: '단색' },
    { key: 'dark', label: '다크' },
    { key: 'satellite', label: '위성' },
    { key: 'streets', label: '도로' },
  ];

  return (
    <Section title="지도 테마">
      <div className="grid grid-cols-2 gap-1.5">
        {themes.map((t) => {
          const active = mapTheme === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setMapTheme(t.key)}
              className={`h-8 rounded text-xs transition-colors ${
                active
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-500/60'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function LegendSection() {
  const items: { status: DroneStatus; label: string }[] = [
    { status: 'idle', label: '대기' },
    { status: 'moving', label: '이동중' },
    { status: 'warning', label: '경고 (배터리 부족 등)' },
    { status: 'error', label: '오류' },
    { status: 'offline', label: '오프라인 (통신 두절)' },
  ];
  return (
    <Section title="상태 색상">
      <div className="space-y-1 text-xs text-neutral-300">
        {items.map((it) => (
          <div key={it.status} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: STATUS_COLOR[it.status] }}
            />
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function HintsSection() {
  return (
    <Section title="조작 안내">
      <div className="text-xs text-neutral-400 space-y-1.5">
        <Line>
          <Key>Shift</Key>+드래그 — 박스 선택
        </Line>
        <Line>드론 클릭 — 단일 선택</Line>
        <Line>
          <Key>Shift</Key>+드론 클릭 — 토글
        </Line>
        <Line>우클릭 — 이동 명령 (큐 초기화)</Line>
        <Line>
          <Key>Shift</Key>+우클릭 — 웨이포인트 추가
        </Line>
        <Line>드래그 — 지도 이동</Line>
        <Line>휠 — 줌</Line>
        <Line>
          <Key>Esc</Key> — 선택 해제
        </Line>
      </div>
    </Section>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 flex-wrap">{children}</div>;
}
