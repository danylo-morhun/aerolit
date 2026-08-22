// Tiny zero-dependency mock API for the take-home dataset.
//
//   node frontend/mock-data/server.mjs        # serves on http://localhost:8787
//   PORT=9000 node frontend/mock-data/server.mjs
//
// It reads the JSON files in this folder and exposes them over HTTP. The
// station list is CURSOR-paginated in BOTH directions: pass `after` to page
// forward and `before` to page backward, using the opaque cursors returned in
// `pageInfo`. There is intentionally no page-number / offset access.
//
//   GET /stations?limit=20&after=<cursor>     # page forward
//   GET /stations?limit=20&before=<cursor>    # page backward
//        -> { items: [...stations], pageInfo: { after?, before? } }
//     `pageInfo.after` / `pageInfo.before` are the cursors for the next /
//     previous page; each is omitted when that direction has no more pages.
//   GET /stations/count
//        -> { total }
//   GET /stations/:id/readings?range=24h|7d|30d
//        -> [{ t, pm25, pm10 }, ...]   (oldest first; range optional)
//   GET /stations/:id/readings/count?from=<ISO>&to=<ISO>&range=24h|7d|30d
//        -> { count }   readings in [from, to] (inclusive); all bounds optional

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const encodeCursor = (id) => Buffer.from(id, 'utf8').toString('base64url');
const decodeCursor = (c) => Buffer.from(c, 'base64url').toString('utf8');

let stationsCache = null;
async function loadStations() {
  if (!stationsCache) {
    const raw = await readFile(path.join(DIR, 'stations.json'), 'utf8');
    // Stable ordering by id, so a cursor (an id) marks an absolute position.
    stationsCache = JSON.parse(raw).sort((a, b) => a.id.localeCompare(b.id));
  }
  return stationsCache;
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      });
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const parts = url.pathname.split('/').filter(Boolean);

    // GET /stations/count
    if (req.method === 'GET' && parts.length === 2 &&
        parts[0] === 'stations' && parts[1] === 'count') {
      const stations = await loadStations();
      return send(res, 200, { total: stations.length });
    }

    // GET /stations  (cursor-paginated, forward via `after`, backward via `before`)
    if (req.method === 'GET' && parts.length === 1 && parts[0] === 'stations') {
      const stations = await loadStations();
      const limit = Math.min(
        Math.max(Number(url.searchParams.get('limit')) || DEFAULT_LIMIT, 1),
        MAX_LIMIT,
      );
      const after = url.searchParams.get('after');
      const before = url.searchParams.get('before');
      if (after && before) {
        return send(res, 400, { error: 'pass only one of `after` / `before`' });
      }

      // Resolve the window [start, end) over the id-sorted list.
      let start;
      let end;
      if (before) {
        const idx = stations.findIndex((s) => s.id === decodeCursor(before));
        if (idx === -1) return send(res, 400, { error: 'invalid cursor' });
        end = idx;                       // item at `before` is excluded
        start = Math.max(0, end - limit); // take the `limit` items just before it
      } else {
        start = 0;
        if (after) {
          const idx = stations.findIndex((s) => s.id === decodeCursor(after));
          if (idx === -1) return send(res, 400, { error: 'invalid cursor' });
          start = idx + 1;               // item at `after` is excluded
        }
        end = Math.min(stations.length, start + limit);
      }

      const items = stations.slice(start, end);
      // `pageInfo` mirrors the query params: pass `after` back as `?after=` for
      // the next page, `before` as `?before=` for the previous one. Each is
      // present only when that direction exists.
      const pageInfo = {};
      if (items.length && end < stations.length) {
        pageInfo.after = encodeCursor(items[items.length - 1].id);
      }
      if (items.length && start > 0) {
        pageInfo.before = encodeCursor(items[0].id);
      }
      return send(res, 200, { items, pageInfo });
    }

    // GET /stations/:id/readings/count?from=<ISO>&to=<ISO>&range=24h|7d|30d
    //   -> { count }   readings whose timestamp `t` falls in [from, to], inclusive.
    //   `range` is an optional shortcut for the last N hours of the series;
    //   `from` / `to` are explicit ISO-8601 bounds (either may be omitted).
    if (req.method === 'GET' && parts.length === 4 &&
        parts[0] === 'stations' && parts[2] === 'readings' && parts[3] === 'count') {
      const id = parts[1];
      let series;
      try {
        series = JSON.parse(
          await readFile(path.join(DIR, 'readings', `${id}.json`), 'utf8'),
        );
      } catch {
        return send(res, 404, { error: `unknown station: ${id}` });
      }

      const hours = RANGE_HOURS[url.searchParams.get('range')];
      if (hours) series = series.slice(-hours);

      const fromParam = url.searchParams.get('from');
      const toParam = url.searchParams.get('to');
      const from = fromParam ? Date.parse(fromParam) : null;
      const to = toParam ? Date.parse(toParam) : null;
      if ((fromParam && Number.isNaN(from)) || (toParam && Number.isNaN(to))) {
        return send(res, 400, { error: 'invalid `from` / `to` (expected ISO-8601)' });
      }

      const count = series.reduce((n, r) => {
        const t = Date.parse(r.t);
        if (from !== null && t < from) return n;
        if (to !== null && t > to) return n;
        return n + 1;
      }, 0);
      return send(res, 200, { count });
    }

    // GET /stations/:id/readings?range=24h|7d|30d
    if (req.method === 'GET' && parts.length === 3 &&
        parts[0] === 'stations' && parts[2] === 'readings') {
      const id = parts[1];
      let series;
      try {
        series = JSON.parse(
          await readFile(path.join(DIR, 'readings', `${id}.json`), 'utf8'),
        );
      } catch {
        return send(res, 404, { error: `unknown station: ${id}` });
      }
      const hours = RANGE_HOURS[url.searchParams.get('range')];
      if (hours) series = series.slice(-hours);
      return send(res, 200, series);
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 500, { error: String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`Mock API listening on http://localhost:${PORT}`);
  console.log('  GET /stations?limit=20&after=<cursor>   (or &before=<cursor>)');
  console.log('  GET /stations/count');
  console.log('  GET /stations/:id/readings?range=24h|7d|30d');
  console.log('  GET /stations/:id/readings/count?from=<ISO>&to=<ISO>');
});
