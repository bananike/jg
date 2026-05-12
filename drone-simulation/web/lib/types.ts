export type DroneStatus = 'idle' | 'moving' | 'warning' | 'error' | 'offline';

export interface Drone {
  id: number;
  lat: number;
  lng: number;
  alt: number;
  heading?: number; // radians, 0 = compass N
  battery: number;
  status: DroneStatus;
  target?: { lat: number; lng: number; alt: number | null } | null;
  waypoints?: Array<{
    lat: number;
    lng: number;
    alt: number | null;
    heading?: number | null;
  }> | null;
  // 클라이언트 보간용 (서버에서 보내지 않음)
  _prevLat?: number;
  _prevLng?: number;
  _prevAlt?: number;
  _updateTime?: number;
}

export interface TelemetryMessage {
  type: 'telemetry';
  t: number;
  drones: Drone[];
}

export type CommandType =
  | 'moveTo'
  | 'moveFormation'
  | 'stop'
  | 'home'
  | 'land'
  | 'setAltitude'
  | 'setHeading'
  | 'assignLine';

export interface CommandPayload {
  lat?: number;
  lng?: number;
  alt?: number;
  heading?: number;
  shape?: string;
  spacing?: number;
  append?: boolean;
  positions?: Array<{
    id: number;
    lat: number;
    lng: number;
    alt?: number;
    heading?: number;
  }>;
}

export interface CommandMessage {
  type: 'command';
  cmd: CommandType;
  targets: number[];
  payload?: CommandPayload;
}
