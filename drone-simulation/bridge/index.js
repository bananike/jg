import { WebSocketServer } from 'ws';
import { CONFIG } from './config.js';
import { initDrones, getDrones, tick, buildTelemetry } from './simulator.js';
import { handleCommand } from './commands.js';

initDrones();

const wss = new WebSocketServer({ port: CONFIG.PORT });

console.log(`[bridge] listening on ws://localhost:${CONFIG.PORT}`);
console.log(`[bridge] simulating ${CONFIG.DRONE_COUNT} drones @ ${CONFIG.TELEMETRY_HZ}Hz`);

wss.on('connection', (ws) => {
  console.log(`[ws] client connected (total: ${wss.clients.size})`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'command') {
        handleCommand(msg, getDrones());
      }
    } catch (e) {
      console.error('[ws] parse error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`[ws] client disconnected (total: ${wss.clients.size})`);
  });

  ws.on('error', (err) => {
    console.error('[ws] error:', err.message);
  });
});

const intervalMs = 1000 / CONFIG.TELEMETRY_HZ;
let lastTick = Date.now();

setInterval(() => {
  const now = Date.now();
  const elapsed = now - lastTick;
  lastTick = now;

  tick(elapsed);

  if (wss.clients.size === 0) return;

  const payload = JSON.stringify({
    type: 'telemetry',
    t: now,
    drones: buildTelemetry()
  });

  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}, intervalMs);

process.on('SIGINT', () => {
  console.log('\n[bridge] shutting down');
  wss.close(() => process.exit(0));
});
