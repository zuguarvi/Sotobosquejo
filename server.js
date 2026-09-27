
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 8080);
const PUBLIC = path.join(__dirname, 'public');

const state = {
  players: [],
  hostId: null,
  currentDrawer: null,
  phase: 'lobby',
  category: 'facil',
  secret: '',
  drawDeadline: 0,
  guessDeadline: 0,
  guessSeconds: 30,
  scores: {},
  strokes: [],
  fillOps: [],
  version: 1,
  message: 'Esperando jugadores'
};

const words = {
  facil: ['casa','sol','pelota','árbol','auto','reloj','flor','luna'],
  comida: ['pizza','hamburguesa','banana','torta','helado','fideos','manzana','pan'],
  acciones: ['correr','dormir','bailar','saltar','nadar','cocinar','leer','cantar'],
  animales: ['perro','gato','elefante','jirafa','pez','león','conejo','mono'],
  objetos: ['lámpara','silla','teléfono','paraguas','tijera','botella','mochila','llave'],
  lugares: ['playa','escuela','hospital','estadio','aeropuerto','parque','cine','supermercado']
};

function bump(msg) {
  if (msg) state.message = msg;
  state.version++;
}

function chooseSecret() {
  const list = words[state.category] || words.facil;
  state.secret = list[Math.floor(Math.random() * list.length)];
}

function otherPlayer(id) {
  return state.players.find(p => p.id !== id);
}

function clientState(id) {
  const now = Date.now();
  const me = state.players.find(p => p.id === id);
  return {
    players: state.players,
    hostId: state.hostId,
    currentDrawer: state.currentDrawer,
    phase: state.phase,
    category: state.category,
    secret: state.currentDrawer === id ? state.secret : null,
    drawLeft: Math.max(0, Math.ceil((state.drawDeadline - now) / 1000)),
    guessLeft: Math.max(0, Math.ceil((state.guessDeadline - now) / 1000)),
    guessSeconds: state.guessSeconds,
    scores: state.scores,
    strokes: state.strokes,
    fillOps: state.fillOps,
    version: state.version,
    message: state.message,
    isHost: state.hostId === id,
    isDrawer: state.currentDrawer === id,
    me
  };
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 2_000_000) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch(e) { reject(e); }
    });
  });
}

function startRound(drawerId) {
  state.currentDrawer = drawerId || state.players[0]?.id || null;
  state.phase = 'drawing';
  state.strokes = [];
  state.fillOps = [];
  chooseSecret();
  state.drawDeadline = Date.now() + 60_000;
  state.guessDeadline = 0;
  bump('¡A dibujar! Tenés 60 segundos.');
}

function sendDrawing(auto=false) {
  if (state.phase !== 'drawing') return;
  state.phase = 'guessing';
  state.drawDeadline = 0;
  state.guessDeadline = Date.now() + state.guessSeconds * 1000;
  bump(auto ? 'Terminó el minuto. Ahora a adivinar.' : 'Dibujo enviado. Ahora a adivinar.');
}

function nextTurn() {
  if (state.players.length < 2) {
    state.phase = 'lobby';
    state.currentDrawer = null;
    bump('Esperando al segundo jugador.');
    return;
  }
  const current = state.players.findIndex(p => p.id === state.currentDrawer);
  const next = state.players[(current + 1) % state.players.length];
  startRound(next.id);
}

setInterval(() => {
  const now = Date.now();
  if (state.phase === 'drawing' && state.drawDeadline && now >= state.drawDeadline) sendDrawing(true);
  if (state.phase === 'guessing' && state.guessDeadline && now >= state.guessDeadline) {
    state.phase = 'result';
    state.guessDeadline = 0;
    bump(`Se terminó el tiempo. La palabra era "${state.secret}".`);
    setTimeout(nextTurn, 2200);
  }
}, 250);

function serveFile(req, res) {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) return res.writeHead(403).end('Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end('Not found');
    const ext = path.extname(file);
    const type = ext === '.html' ? 'text/html; charset=utf-8' :
                 ext === '.js' ? 'text/javascript; charset=utf-8' :
                 ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, {'Content-Type':type, 'Cache-Control':'no-store'});
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/join') {
      const body = await parseBody(req);
      let id = String(body.id || '').slice(0,64);
      const name = String(body.name || 'Jugador').slice(0,24);
      if (!id) id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      let p = state.players.find(x => x.id === id);
      if (!p) {
        if (state.players.length >= 2) return json(res, 409, {error:'La sala ya tiene 2 jugadores.'});
        p = {id, name};
        state.players.push(p);
        state.scores[id] = state.scores[id] || 0;
        if (!state.hostId) state.hostId = id;
        bump(`${name} entró a la sala.`);
      } else {
        p.name = name;
      }
      return json(res, 200, {id, state:clientState(id)});
    }

    if (req.method === 'GET' && req.url.startsWith('/api/state')) {
      const u = new URL(req.url, 'http://localhost');
      const id = u.searchParams.get('id') || '';
      return json(res, 200, clientState(id));
    }

    if (req.method === 'POST' && req.url === '/api/action') {
      const b = await parseBody(req);
      const id = String(b.id || '');
      if (!state.players.some(p => p.id === id)) return json(res, 403, {error:'Jugador inválido'});

      if (b.type === 'settings' && id === state.hostId && state.phase === 'lobby') {
        if (words[b.category]) state.category = b.category;
        state.guessSeconds = [20,30].includes(Number(b.guessSeconds)) ? Number(b.guessSeconds) : 30;
        bump();
      }

      if (b.type === 'start' && id === state.hostId && state.players.length === 2) startRound(state.players[0].id);

      if (b.type === 'stroke' && id === state.currentDrawer && state.phase === 'drawing') {
        const s = b.stroke || {};
        state.strokes.push({
          x1:Number(s.x1)||0,y1:Number(s.y1)||0,x2:Number(s.x2)||0,y2:Number(s.y2)||0,
          color:String(s.color||'#111111').slice(0,16),
          size:Math.max(1,Math.min(40,Number(s.size)||6))
        });
        if (state.strokes.length > 12000) state.strokes.shift();
        bump();
      }

      if (b.type === 'clear' && id === state.currentDrawer && state.phase === 'drawing') {
        state.strokes = []; state.fillOps = []; bump('Pizarra borrada.');
      }

      if (b.type === 'fill' && id === state.currentDrawer && state.phase === 'drawing') {
        state.fillOps.push({x:Number(b.x)||0,y:Number(b.y)||0,color:String(b.color||'#111111').slice(0,16)});
        bump();
      }

      if (b.type === 'send' && id === state.currentDrawer && state.phase === 'drawing') sendDrawing(false);

      if (b.type === 'guess' && state.phase === 'guessing' && id !== state.currentDrawer) {
        const guess = String(b.guess || '').trim().toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        const secret = state.secret.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        if (guess && guess === secret) {
          state.scores[id] = (state.scores[id] || 0) + 1;
          state.phase = 'result';
          state.guessDeadline = 0;
          const p = state.players.find(x => x.id === id);
          bump(`¡Correcto! Punto para ${p?.name || 'el jugador'}.`);
          setTimeout(nextTurn, 1800);
        } else {
          bump('No es. Probá otra vez.');
        }
      }

      if (b.type === 'next' && id === state.hostId) nextTurn();

      return json(res, 200, {ok:true, state:clientState(id)});
    }

    serveFile(req,res);
  } catch(e) {
    console.error(e);
    json(res, 500, {error:'Error interno'});
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nSOTOBOSQUEJO - SERVIDOR LOCAL');
  console.log('================================');
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const n of (list || [])) {
      if (n.family === 'IPv4' && !n.internal) console.log(`Abrí en los celulares: http://${n.address}:${PORT}`);
    }
  }
  console.log(`También en esta PC: http://localhost:${PORT}`);
  console.log('Ambos celulares deben estar en la misma red Wi‑Fi.\n');
});
