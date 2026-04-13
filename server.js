/**
 * Serveur HTTP statique + WebSocket multijoueur (même port).
 * Lancement : npm install && npm start
 * Variable d’environnement optionnelle : PORT (défaut 8080).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const ROOT = __dirname;
const PORT_BASE = process.env.PORT ? Number(process.env.PORT) : 8080;
/** Préfixe des logs console (référentiel : github.com/nomaterial/paperwarfare) */
const LOG = '[paperwarfare]';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safeJoin(root, reqPath) {
  const rel = path.normalize(decodeURIComponent(reqPath)).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(root, rel);
  if (!full.startsWith(root)) return null;
  return full;
}

// Cache mémoire des assets lourds (GLB, MP3…) : zéro I/O disque après le 1er chargement
const fileCache = new Map();
const CACHEABLE = new Set(['.glb', '.mp3', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2']);

const server = http.createServer((req, res) => {
  let u = req.url.split('?')[0];
  if (u === '/') u = '/index.html';
  const filePath = safeJoin(ROOT, u.slice(1));
  if (!filePath) {
    res.writeHead(403);
    res.end();
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const headers = { 'Content-Type': type };
  if (CACHEABLE.has(ext)) headers['Cache-Control'] = 'public, max-age=3600';

  if (fileCache.has(filePath)) {
    res.writeHead(200, headers);
    res.end(fileCache.get(filePath));
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    if (CACHEABLE.has(ext)) fileCache.set(filePath, data);
    res.writeHead(200, headers);
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

let nextId = 1;
function makeId() {
  return 'p' + nextId++;
}

/** id -> { nickname, ws, x,y,z, qx,qy,qz,qw, inPlane, alive } */
const players = new Map();

function playerPayload(id, p) {
  return {
    id,
    nickname: p.nickname,
    x: p.x,
    y: p.y,
    z: p.z,
    qx: p.qx,
    qy: p.qy,
    qz: p.qz,
    qw: p.qw,
    inPlane: p.inPlane,
    alive: p.alive
  };
}

function roster() {
  const out = [];
  for (const [id, p] of players) out.push(playerPayload(id, p));
  return out;
}

function send(ws, obj) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function broadcast(obj, exceptWs) {
  const s = JSON.stringify(obj);
  wss.clients.forEach((c) => {
    if (c === exceptWs) return;
    if (c.readyState === WebSocket.OPEN) c.send(s);
  });
}

wss.on('connection', (ws) => {
  let myId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (!myId) {
      if (msg.type !== 'hello') return;
      myId = makeId();
      const nick = String(msg.nickname || 'Anonyme').trim().slice(0, 24) || 'Anonyme';
      players.set(myId, {
        nickname: nick,
        ws,
        x: 0,
        y: 0,
        z: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
        inPlane: false,
        alive: true
      });
      send(ws, { type: 'welcome', id: myId, players: roster() });
      broadcast(
        {
          type: 'peerJoined',
          player: playerPayload(myId, players.get(myId))
        },
        ws
      );
      return;
    }

    const p = players.get(myId);
    if (!p || p.ws !== ws) return;

    if (msg.type === 'move' && p.alive) {
      // Rate-limit : max 1 update toutes les 40ms (~25/s) par client
      const now = Date.now();
      if (p._lastMove && now - p._lastMove < 40) return;
      p._lastMove = now;
      p.x = Number(msg.x) || 0;
      p.y = Number(msg.y) || 0;
      p.z = Number(msg.z) || 0;
      p.qx = Number(msg.qx) || 0;
      p.qy = Number(msg.qy) || 0;
      p.qz = Number(msg.qz) || 0;
      p.qw = Number(msg.qw) || 1;
      p.inPlane = !!msg.inPlane;
      p._dirty = true; // sera envoyé dans le prochain tick groupé
      return;
    }

    if (msg.type === 'fire') {
      broadcast({
        type: 'fire',
        ownerId: myId,
        sid: String(msg.sid || ''),
        x: Number(msg.x),
        y: Number(msg.y),
        z: Number(msg.z),
        vx: Number(msg.vx),
        vy: Number(msg.vy),
        vz: Number(msg.vz)
      });
      return;
    }

    if (msg.type === 'hit') {
      const victimId = String(msg.victimId || '');
      const byId = String(msg.byId || myId);
      const victim = players.get(victimId);
      if (!victim || !victim.alive) return;
      victim.alive = false;
      broadcast({
        type: 'playerHit',
        victimId,
        byId
      });
      return;
    }

    if (msg.type === 'respawn') {
      p.alive = true;
      p.x = 0;
      p.y = 0;
      p.z = 0;
      p.qx = 0;
      p.qy = 0;
      p.qz = 0;
      p.qw = 1;
      p.inPlane = false;
      broadcast({ type: 'playerRespawn', id: myId });
      return;
    }
  });

  ws.on('close', () => {
    if (!myId) return;
    players.delete(myId);
    broadcast({ type: 'peerLeft', id: myId });
  });
});

// Tick serveur : regroupe toutes les positions modifiées en un seul message batch
// → réduit radicalement le nombre de messages WS avec plusieurs joueurs
setInterval(function () {
  if (players.size < 2) return;
  const moves = [];
  for (const [id, p] of players) {
    if (!p._dirty) continue;
    p._dirty = false;
    moves.push({ id, x: p.x, y: p.y, z: p.z, qx: p.qx, qy: p.qy, qz: p.qz, qw: p.qw, inPlane: p.inPlane });
  }
  if (moves.length === 0) return;
  broadcast({ type: 'batch', moves });
}, 50);

var listenPort = PORT_BASE;
var portAttempts = 0;
var retryScheduled = false;

server.on('listening', function () {
  var u = 'http://localhost:' + listenPort + '/index.html';
  console.log('');
  console.log('  ' + LOG + ' Open this URL in the browser:');
  console.log('  ' + u);
  console.log('');
});

function tryNextPort() {
  if (retryScheduled) return;
  retryScheduled = true;
  process.nextTick(function () {
    retryScheduled = false;
    portAttempts++;
    if (portAttempts > 15) {
      console.error(
        LOG + ' No free port found (tried from ' + PORT_BASE + '). Stop other servers or set PORT.'
      );
      console.error('  PowerShell: netstat -ano | findstr :8080   then   taskkill /PID <pid> /F');
      console.error('  Or: $env:PORT=3005 ; npm start');
      process.exit(1);
    }
    listenPort++;
    console.warn(LOG + ' Port ' + (listenPort - 1) + ' in use, trying ' + listenPort + '…');
    server.listen(listenPort);
  });
}

function onListenError(err) {
  if (err.code === 'EADDRINUSE') {
    tryNextPort();
    return;
  }
  console.error(err);
  process.exit(1);
}

server.on('error', onListenError);
wss.on('error', onListenError);

server.listen(listenPort);
