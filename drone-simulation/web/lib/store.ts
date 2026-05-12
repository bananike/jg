import { create } from 'zustand';
import type { Drone } from './types';

export type MapTheme = 'light' | 'dark' | 'satellite' | 'streets';

interface State {
  drones: Map<number, Drone>;
  connected: boolean;
  selected: Set<number>;
  mapTheme: MapTheme;
  targetAltitude: number;
  targetHeading: number; // radians, 0 = compass N
  drawingMode: boolean;

  setConnected: (v: boolean) => void;
  updateDrones: (drones: Drone[]) => void;
  setSelected: (ids: Set<number>) => void;
  setMapTheme: (t: MapTheme) => void;
  setTargetAltitude: (alt: number) => void;
  setTargetHeading: (rad: number) => void;
  setDrawingMode: (v: boolean) => void;
}

export const useStore = create<State>((set) => ({
  drones: new Map(),
  connected: false,
  selected: new Set(),
  mapTheme: 'light',
  targetAltitude: 30,
  targetHeading: 0,
  drawingMode: false,

  setConnected: (v) => set({ connected: v }),

  updateDrones: (next) =>
    set((s) => {
      const now = performance.now();
      const m = new Map(s.drones);
      for (const d of next) {
        const existing = m.get(d.id);
        m.set(d.id, {
          ...d,
          _prevLat: existing ? existing.lat : d.lat,
          _prevLng: existing ? existing.lng : d.lng,
          _prevAlt: existing ? existing.alt : d.alt,
          _updateTime: now,
        });
      }
      return { drones: m };
    }),

  setSelected: (ids) => set({ selected: ids }),

  setMapTheme: (t) => set({ mapTheme: t }),

  setTargetAltitude: (alt) => set({ targetAltitude: alt }),

  setTargetHeading: (rad) => set({ targetHeading: rad }),

  setDrawingMode: (v) => set({ drawingMode: v }),
}));
