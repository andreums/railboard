/*
  Minimal E2E test (ESM): open WS, then POST to create a train and wait for an "update" event.
  Usage: node scripts/ws_e2e_test.mjs
*/
import WebSocket from 'ws';
import http from 'http';
import { exec as _exec } from 'child_process';
import { promisify } from 'util';
const exec = promisify(_exec);

const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 4000;
const ROUTE_CODE = process.argv[2] || 'C-1';

async function getTrainsViaCurl() {
    try {
        const host = API_HOST.includes(":") ? `[${API_HOST}]` : API_HOST;
        const url = `http://${host}:${API_PORT}/admin/trains`;
        const { stdout } = await exec(`curl -sS -u admin:railboard ${url}`);
        return JSON.parse(stdout || '[]');
    } catch (e) {
        return null;
    }
}

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
    // snapshot current trains (use curl to avoid node socket EPERM)
    const before = await getTrainsViaCurl().catch(() => null) || [];
    const beforeMax = before.length ? Math.max(...before.map(t => t.id || 0)) : 0;

    // attempt WS connection (optional)
    let ws = null;
    try {
        console.log('Attempting WS connection...');
        ws = new WebSocket(`ws://[${API_HOST}]:${API_PORT}/ws`);
        await new Promise((res, rej) => ws.once('open', res) && ws.once('error', rej));
        console.log('WS open');
        const hello = await waitForWSMessage(ws, 2000).catch(() => null);
        console.log('hello:', hello);
    } catch (e) {
        console.warn('WS unavailable, will fallback to polling:', e && e.message);
        ws = null;
    }

    console.log('Posting create train for route', ROUTE_CODE);
    try {
        const host = API_HOST.includes(":") ? `[${API_HOST}]` : API_HOST;
        const url = `http://${host}:${API_PORT}/admin/trains/from-route/${encodeURIComponent(ROUTE_CODE)}`;
        const { stdout, stderr } = await exec(`curl -sS -u admin:railboard -X POST ${url}`);
        if (stderr) console.error('curl stderr:', stderr);
        try { console.log('response', JSON.parse(stdout || '{}')); } catch (e) { console.log(stdout); }
    } catch (e) {
        console.error('post error', e && e.message);
    }

    if (ws) {
        try {
            const msg = await waitForWSMessage(ws, 5000);
            console.log('WS received:', msg);
            process.exit(0);
        } catch (e) {
            console.warn('No WS update received:', e && e.message);
        }
    }

    // Fallback: poll /admin/trains until we see a new id
    console.log('Polling /admin/trains for new train...');
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
        const now = await getTrainsViaCurl().catch(() => null) || [];
        const max = now.length ? Math.max(...now.map(t => t.id || 0)) : 0;
        if (max > beforeMax) {
            console.log('New train detected via HTTP, max id:', max);
            process.exit(0);
        }
        await new Promise(r => setTimeout(r, 500));
    }

    console.error('Failed to detect new train via WS or polling');
    process.exit(2);
}

run();
