/*
  Minimal E2E test: open WS, then POST to create a train and wait for an "update" event.
  Usage: node scripts/ws_e2e_test.js
*/
const WebSocket = require('ws');
const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 4000;
const ROUTE_CODE = process.argv[2] || 'C-1';

function waitForWSMessage(ws, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for ws message')), timeout);
    ws.on('message', (data) => {
      try {
        const m = JSON.parse(String(data));
        clearTimeout(timer);
        resolve(m);
      } catch (e) {
        // ignore non-json
      }
    });
  });
}

async function run() {
  console.log('Connecting to ws...');
  const ws = new WebSocket(`ws://${API_HOST}:${API_PORT}/ws`);

  await new Promise((res) => ws.on('open', res));
  console.log('WS open');

  // consume initial hello
  const hello = await waitForWSMessage(ws, 2000).catch(() => null);
  console.log('hello:', hello);

  // POST to create a train
  console.log('Posting create train for route', ROUTE_CODE);
  const body = JSON.stringify({});
  const opts = {
    hostname: API_HOST,
    port: API_PORT,
    path: `/admin/trains/from-route/${encodeURIComponent(ROUTE_CODE)}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Authorization': 'Basic ' + Buffer.from('admin:railboard').toString('base64'),
    },
  };

  const req = http.request(opts, (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      console.log('POST status', res.statusCode);
      try { console.log('response', JSON.parse(data)); } catch (e) { console.log(data); }
    });
  });
  req.on('error', (e) => console.error('post error', e));
  req.write(body);
  req.end();

  // Wait for an update broadcast
  try {
    const msg = await waitForWSMessage(ws, 5000);
    console.log('WS received:', msg);
    process.exit(0);
  } catch (e) {
    console.error('Did not receive update:', e.message);
    process.exit(2);
  }
}

run();
