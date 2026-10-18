const express = require('express');
const util = require('minecraft-server-util');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CHECK_EVERY_MS = Number(process.env.CHECK_EVERY_MS || 60_000);
const HISTORY_FILE = path.join(__dirname, 'uptime-history.json');

// Set LIFESTEAL_HOST/LIFESTEAL_PORT to the backend's reachable address for
// independent monitoring. If left at defaults, both game checks test play.goatmc.fun.
const services = [
  { id: 'website', name: 'Website', type: 'http', url: process.env.WEBSITE_URL || 'https://store.goatmc.fun' },
  { id: 'lifesteal', name: 'Lifesteal', type: 'minecraft', host: process.env.LIFESTEAL_HOST || 'play.goatmc.fun', port: Number(process.env.LIFESTEAL_PORT || 25565) },
  { id: 'velocity', name: 'Velocity', type: 'minecraft', host: process.env.VELOCITY_HOST || 'play.goatmc.fun', port: Number(process.env.VELOCITY_PORT || 25565) }
];

let history = {};
try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch {}
for (const s of services) if (!Array.isArray(history[s.id])) history[s.id] = [];
const current = Object.fromEntries(services.map(s => [s.id, { online: false, checkedAt: null, latencyMs: null, error: 'Waiting for first check' }]));

async function probe(service) {
  const started = Date.now();
  try {
    if (service.type === 'http') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(service.url, { method: 'GET', signal: controller.signal, redirect: 'follow' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } finally { clearTimeout(timeout); }
    } else {
      await util.status(service.host, service.port, { timeout: 8000, enableSRV: false });
    }
    current[service.id] = { online: true, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, error: null };
  } catch (err) {
    current[service.id] = { online: false, checkedAt: new Date().toISOString(), latencyMs: null, error: String(err.message || err).slice(0, 180) };
  }
  history[service.id].push({ time: current[service.id].checkedAt, online: current[service.id].online });
  // Keep 90 days of one-minute checks per service.
  history[service.id] = history[service.id].slice(-129600);
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(history)); } catch (e) { console.error('Could not save history:', e.message); }
}

function uptimePercent(id) {
  const points = history[id] || [];
  if (!points.length) return null;
  return Math.round((points.filter(p => p.online).length / points.length) * 10000) / 100;
}

function publicStatus() {
  const statuses = services.map(s => ({
    id: s.id, name: s.name,
    address: s.type === 'http' ? 'store.goatmc.fun' : 'play.goatmc.fun',
    online: current[s.id].online,
    checkedAt: current[s.id].checkedAt,
    latencyMs: current[s.id].latencyMs,
    uptimePercent: uptimePercent(s.id),
    history: (history[s.id] || []).slice(-60).map(p => ({ time: p.time, online: p.online }))
  }));
  return { overallOnline: statuses.every(s => s.online), services: statuses, updatedAt: new Date().toISOString() };
}

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/status', (_req, res) => res.json(publicStatus()));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

async function checkAll() {
  await Promise.all(services.map(probe));
  console.log(new Date().toISOString(), services.map(s => `${s.name}: ${current[s.id].online ? 'ONLINE' : 'OFFLINE'}`).join(' | '));
}
app.listen(PORT, async () => {
  console.log(`GOATMC Status listening on :${PORT}`);
  await checkAll();
  setInterval(checkAll, CHECK_EVERY_MS);
});
