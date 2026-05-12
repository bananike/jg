import { useStore } from './store';
import type { CommandMessage, TelemetryMessage } from './types';

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentUrl: string | null = null;

export function connect(url: string) {
  currentUrl = url;
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close();
  }

  socket = new WebSocket(url);

  socket.addEventListener('open', () => {
    console.log('[ws] connected');
    useStore.getState().setConnected(true);
  });

  socket.addEventListener('close', () => {
    console.log('[ws] closed, reconnecting in 2s...');
    useStore.getState().setConnected(false);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      if (currentUrl) connect(currentUrl);
    }, 2000);
  });

  socket.addEventListener('error', () => {
    // close handler will run after this
  });

  socket.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data) as TelemetryMessage;
      if (msg.type === 'telemetry') {
        useStore.getState().updateDrones(msg.drones);
      }
    } catch (err) {
      console.error('[ws] parse error', err);
    }
  });
}

export function disconnect() {
  currentUrl = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
}

export function sendCommand(msg: CommandMessage) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  } else {
    console.warn('[ws] cannot send, socket not open');
  }
}
