import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import multer from "multer";
import { Server } from "socket.io";

import pdf from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PORT = Number(process.env.PORT || 5175);
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();

const GEMINI_TARGET_COUNT = Math.max(10, Number(process.env.GEMINI_TARGET_COUNT || 100));
const GEMINI_BATCH_SIZE = Math.max(5, Number(process.env.GEMINI_BATCH_SIZE || 20));
const GEMINI_BATCH_DELAY_MS = Math.max(0, Number(process.env.GEMINI_BATCH_DELAY_MS || 350));
const GEMINI_MAX_RETRIES = Math.max(0, Number(process.env.GEMINI_MAX_RETRIES || 4));

const CLIENT_URL = process.env.CLIENT_URL || "https://knowledgeascension.onrender.com";

const app = express();
app.use(cors({ origin: CLIENT_URL, credentials: false }));
app.use(express.json({ limit: "2mb" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ["GET", "POST"] },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/* =========================================================
   Shared helpers
========================================================= */
function makeCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function createUniqueCode(map) {
  let code = makeCode();
  while (map.has(code)) code = makeCode();
  return code;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeQuestion(q) {
  if (!q) return null;

  const text = String(q.text || "").trim();
  const a = String(q.a || "").trim();
  const b = String(q.b || "").trim();
  const c = String(q.c || "").trim();
  const d = String(q.d || "").trim();
  const correct = String(q.correct || "").trim().toLowerCase();

  if (!text || !a || !b || !c || !d) return null;
  if (!["a", "b", "c", "d"].includes(correct)) return null;

  return { text, a, b, c, d, correct };
}

async function extractAny(file) {
  const ext = (file.originalname.split(".").pop() || "").toLowerCase();
  const buf = file.buffer;

  let text = "";
  if (ext === "pdf") text = await extractPdf(buf);
  else if (ext === "docx") text = await extractDocx(buf);
  else if (ext === "pptx") text = await extractPptx(buf);
  else throw new Error("Unsupported file type. Use PDF/DOCX/PPTX.");

  return cleanText(text);
}

async function extractPdf(buf) {
  const out = await pdf(buf);
  return String(out?.text || "");
}

async function extractDocx(buf) {
  const out = await mammoth.extractRawText({ buffer: buf });
  return String(out?.value || "");
}

async function extractPptx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files).filter(
    (k) => k.startsWith("ppt/slides/slide") && k.endsWith(".xml")
  );

  let all = "";
  for (const s of slides) {
    const xml = await zip.files[s].async("string");
    all += " " + xml.replace(/<[^>]+>/g, " ");
  }
  return all;
}

function cleanText(t) {
  return String(t || "").replace(/\s+/g, " ").trim().slice(0, 18000);
}

/* =========================================================
   Gemini generation
========================================================= */
function makeGeminiPrompt(studyText, count, seedHint) {
  return (
    "Return ONLY valid JSON (no markdown, no extra text).\n" +
    `Create ${count} multiple-choice questions from the study content.\n` +
    "Rules:\n" +
    '- Each item format: {"text":"...","a":"...","b":"...","c":"...","d":"...","correct":"a|b|c|d"}\n' +
    "- Exactly 4 answer choices.\n" +
    "- Vary the questions and avoid duplicates.\n" +
    (seedHint ? `- Variation hint: ${seedHint}\n` : "") +
    "\nSTUDY CONTENT:\n" +
    studyText
  );
}

async function callGeminiJSON(model, prompt) {
  const result = await model.generateContent(prompt);
  const raw = result?.response?.text?.() || "";

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("Gemini did not return JSON.");
    return JSON.parse(raw.slice(start, end + 1));
  }
}

async function generateQuestionsGemini(text, opts) {
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in server/.env");

  const targetCount = Math.max(10, Number(opts?.targetCount || 100));
  const batchSize = Math.max(5, Number(opts?.batchSize || 20));
  const onProgress = typeof opts?.onProgress === "function" ? opts.onProgress : null;

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const out = [];
  const seen = new Set();

  if (onProgress) onProgress({ done: 0, total: targetCount, status: "Starting..." });

  while (out.length < targetCount) {
    const remaining = targetCount - out.length;
    const count = Math.min(batchSize, remaining);

    const seedHint = `batch=${Math.floor(out.length / batchSize) + 1}, avoid repeating: ${out
      .slice(-3)
      .map((q) => q.text)
      .join(" | ")}`;

    const prompt = makeGeminiPrompt(text, count, seedHint);

    let parsed = null;
    let lastErr = null;

    for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
      try {
        parsed = await callGeminiJSON(model, prompt);
        break;
      } catch (e) {
        lastErr = e;
        await sleep(300 + attempt * 500);
      }
    }

    if (!parsed) throw new Error(lastErr?.message || "Gemini request failed.");

    for (const q of Array.isArray(parsed) ? parsed : []) {
      const n = normalizeQuestion(q);
      if (!n) continue;

      const key = n.text.trim().toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      out.push(n);
      if (out.length >= targetCount) break;
    }

    if (onProgress) onProgress({ done: out.length, total: targetCount, status: "Generating..." });

    if (out.length < targetCount) {
      await sleep(GEMINI_BATCH_DELAY_MS);
    }
  }

  if (onProgress) onProgress({ done: targetCount, total: targetCount, status: "Done" });

  return out.slice(0, targetCount);
}

/* =========================================================
   CO-OP
========================================================= */
const rooms = new Map();

function roomPublic(room) {
  return {
    code: room.code,
    started: room.started,
    ended: room.ended,
    bossHp: room.bossHp,
    timerMs: room.timerMs,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      hp: p.hp,
      equipped: p.equipped,
    })),
    questionCount: room.questions.length,
  };
}

function sendRoomState(room) {
  io.to(room.code).emit("coop:room_state", roomPublic(room));
}

function roomError(socket, message) {
  socket.emit("coop:error", { message });
}

function pickNextQuestion(room) {
  if (!room.questions.length) return null;
  room.qIndex = (room.qIndex + 1) % room.questions.length;
  return room.questions[room.qIndex];
}

function getCurrentQuestion(room) {
  if (!room.questions.length) return null;
  if (room.qIndex < 0 || room.qIndex >= room.questions.length) room.qIndex = 0;
  return room.questions[room.qIndex];
}

function endRoom(room, reason) {
  if (room.ended) return;
  room.ended = true;
  room.started = false;

  if (room.tick) {
    clearInterval(room.tick);
    room.tick = null;
  }

  io.to(room.code).emit("coop:ended", { reason });
  sendRoomState(room);
}

function allDead(room) {
  return room.players.every((p) => p.hp <= 0);
}

/* =========================================================
   1v1
========================================================= */
const v1Rooms = new Map();

const CHARACTER_STATS = {
  archer: { health: 65, damage: 24, loot: 45 },
  beggar: { health: 55, damage: 14, loot: 95 },
  fairy: { health: 60, damage: 20, loot: 80 },
  king: { health: 95, damage: 16, loot: 20 },
  knight: { health: 78, damage: 22, loot: 40 },
  merchant: { health: 70, damage: 18, loot: 90 },
  orc: { health: 80, damage: 26, loot: 15 },
  sorcerer: { health: 55, damage: 30, loot: 35 },
};

function clampId(id) {
  const k = String(id || "knight").trim().toLowerCase();
  return CHARACTER_STATS[k] ? k : "knight";
}

function calcHpMax(equippedId) {
  const st = CHARACTER_STATS[clampId(equippedId)];
  return Math.max(1, Math.round(st.health * 12));
}

function calcDamage(equippedId) {
  const st = CHARACTER_STATS[clampId(equippedId)];
  return Math.max(1, Math.round(st.damage * 1.6));
}

function lootChance(equippedId) {
  const st = CHARACTER_STATS[clampId(equippedId)];
  return Math.max(0, Math.min(100, Number(st.loot || 0)));
}

function v1Public(room) {
  return {
    code: room.code,
    started: room.started,
    ended: room.ended,
    winnerId: room.winnerId || "",
    questionCount: room.questions.length,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      equipped: p.equipped,
      hp: p.hp,
      hpMax: p.hpMax,
    })),
  };
}

function v1SendState(room) {
  io.to(room.code).emit("onevone:state", v1Public(room));
}

function v1Error(socket, message) {
  socket.emit("onevone:error", { message });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function v1InitQuestionStream(room, player) {
  const n = room.questions.length;
  const order = shuffle([...Array(n).keys()]);
  player.qOrder = order;
  player.qPtr = 0;
  player.curQIndex = order[0] ?? 0;
}

function v1CurrentQuestion(room, player) {
  const n = room.questions.length;
  if (!n) return null;
  const idx = Number(player.curQIndex ?? 0);
  return room.questions[idx] || null;
}

function v1NextQuestion(room, player) {
  const n = room.questions.length;
  if (!n) return null;

  player.qPtr += 1;
  if (player.qPtr >= player.qOrder.length) {
    player.qOrder = shuffle([...Array(n).keys()]);
    player.qPtr = 0;
  }

  player.curQIndex = player.qOrder[player.qPtr] ?? 0;
  return room.questions[player.curQIndex] || null;
}

/* =========================================================
   Socket.io
========================================================= */
io.on("connection", (socket) => {
  /* --------------------------
     CO-OP
  -------------------------- */
  socket.on("coop:request_state", ({ code }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = rooms.get(c);
    if (!room) return;
    io.to(socket.id).emit("coop:room_state", roomPublic(room));
  });

  socket.on("coop:request_question", ({ code }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = rooms.get(c);
    if (!room || !room.started || room.ended) return;

    const q = getCurrentQuestion(room);
    io.to(socket.id).emit("coop:question", { q });
  });

  socket.on("coop:create_room", ({ name, equipped }) => {
    const n = String(name || "").trim();
    if (!n) return roomError(socket, "Enter a name.");

    const code = createUniqueCode(rooms);
    const room = {
      code,
      createdAt: Date.now(),
      started: false,
      ended: false,
      bossHp: 5000,
      timerMs: 5 * 60 * 1000,
      players: [
        {
          id: socket.id,
          name: n,
          equipped: String(equipped || "knight").toLowerCase(),
          ready: false,
          hp: 100,
          deadUntil: 0,
        },
      ],
      questions: [],
      qIndex: 0,
      tick: null,
    };

    rooms.set(code, room);
    socket.join(code);
    sendRoomState(room);
  });

  socket.on("coop:join_room", ({ code, name, equipped }) => {
    const c = String(code || "").trim().toUpperCase();
    const n = String(name || "").trim();
    if (!c) return roomError(socket, "Enter a room code.");
    if (!n) return roomError(socket, "Enter a name.");

    const room = rooms.get(c);
    if (!room) return roomError(socket, "Room not found.");
    if (room.started) return roomError(socket, "Game already started.");
    if (room.players.length >= 4) return roomError(socket, "Room full (max 4).");

    socket.join(c);
    room.players.push({
      id: socket.id,
      name: n,
      equipped: String(equipped || "knight").toLowerCase(),
      ready: false,
      hp: 100,
      deadUntil: 0,
    });

    sendRoomState(room);
  });

  socket.on("coop:set_ready", ({ code, ready }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = rooms.get(c);
    if (!room) return;

    const p = room.players.find((x) => x.id === socket.id);
    if (!p) return;

    p.ready = !!ready;
    sendRoomState(room);
  });

  socket.on("coop:start_game", ({ code }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = rooms.get(c);
    if (!room) return;

    const hostId = room.players[0]?.id;
    if (socket.id !== hostId) return roomError(socket, "Only the host can start.");
    if (room.players.length < 2) return roomError(socket, "Need at least 2 players.");
    if (!room.questions.length) return roomError(socket, "Upload a study file first (needs questions).");

    const everyoneReady = room.players.every((p) => p.ready);
    if (!everyoneReady) return roomError(socket, "All players must be ready.");

    room.started = true;
    room.ended = false;
    room.bossHp = 5000;
    room.timerMs = 5 * 60 * 1000;
    room.qIndex = 0;

    for (const p of room.players) {
      p.hp = 100;
      p.deadUntil = 0;
      p.ready = false;
    }

    io.to(room.code).emit("coop:started", roomPublic(room));
    io.to(room.code).emit("coop:question", { q: getCurrentQuestion(room) });
    sendRoomState(room);

    if (room.tick) clearInterval(room.tick);
    room.tick = setInterval(() => {
      if (!room.started || room.ended) return;

      room.timerMs -= 200;

      if (room.timerMs <= 0) {
        room.timerMs = 0;
        sendRoomState(room);
        endRoom(room, "time");
        return;
      }

      if (room.bossHp <= 0) {
        room.bossHp = 0;
        sendRoomState(room);
        endRoom(room, "win");
        return;
      }

      if (allDead(room)) {
        sendRoomState(room);
        endRoom(room, "all_dead");
        return;
      }

      sendRoomState(room);
    }, 200);
  });

  socket.on("coop:push_questions", ({ code, questions }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = rooms.get(c);
    if (!room) return;

    const hostId = room.players[0]?.id;
    if (socket.id !== hostId) return roomError(socket, "Only the host can add questions.");

    const list = Array.isArray(questions) ? questions : [];
    const normalized = [];

    for (const q of list) {
      const item = normalizeQuestion(q);
      if (item) normalized.push(item);
    }

    if (!normalized.length) return roomError(socket, "No valid questions detected.");

    room.questions = normalized;
    room.qIndex = 0;
    sendRoomState(room);
  });

  socket.on("coop:submit_answer", ({ code, picked }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = rooms.get(c);
    if (!room || !room.started || room.ended) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    if (player.hp <= 0) return;

    const now = Date.now();
    if (player.deadUntil && now < player.deadUntil) return;

    const cur = getCurrentQuestion(room);
    if (!cur) return;

    const pick = String(picked || "").toLowerCase();
    const correct = String(cur.correct || "").toLowerCase();

    if (pick === correct) {
      const dmg = 10 + Math.floor(Math.random() * 51);
      room.bossHp = Math.max(0, room.bossHp - dmg);

      io.to(room.code).emit("coop:hit", {
        playerId: socket.id,
        damage: dmg,
        coinDrop: 1,
      });
    } else {
      player.hp = Math.max(0, player.hp - 10);

      io.to(room.code).emit("coop:player_hurt", {
        playerId: socket.id,
        hp: player.hp,
      });

      if (player.hp === 0) {
        player.deadUntil = Date.now() + 5000;
      }
    }

    const next = pickNextQuestion(room);
    io.to(room.code).emit("coop:question", { q: next });
    sendRoomState(room);

    if (room.bossHp <= 0) endRoom(room, "win");
    else if (allDead(room)) endRoom(room, "all_dead");
  });

  socket.on("coop:respawn", ({ code }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = rooms.get(c);
    if (!room || !room.started || room.ended) return;

    const p = room.players.find((x) => x.id === socket.id);
    if (!p) return;

    const now = Date.now();
    if (p.hp > 0) return;
    if (p.deadUntil && now < p.deadUntil) return;

    p.hp = 100;
    p.deadUntil = 0;
    sendRoomState(room);
  });

  /* --------------------------
     1v1
  -------------------------- */
  socket.on("onevone:request_state", ({ code }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = v1Rooms.get(c);
    if (!room) return;
    io.to(socket.id).emit("onevone:state", v1Public(room));
  });

  socket.on("onevone:request_question", ({ code }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = v1Rooms.get(c);
    if (!room || !room.started || room.ended) return;

    const p = room.players.find((x) => x.id === socket.id);
    if (!p) return;

    const q = v1CurrentQuestion(room, p);
    io.to(p.id).emit("onevone:question", { q });
  });

  socket.on("onevone:create_room", ({ name, equipped }) => {
    const n = String(name || "").trim();
    if (!n) return v1Error(socket, "Enter a name.");

    const code = createUniqueCode(v1Rooms);
    const eq = clampId(equipped);

    const p0 = {
      id: socket.id,
      name: n,
      equipped: eq,
      ready: false,
      hpMax: calcHpMax(eq),
      hp: calcHpMax(eq),
      qOrder: [],
      qPtr: 0,
      curQIndex: 0,
    };

    const room = {
      code,
      createdAt: Date.now(),
      started: false,
      ended: false,
      winnerId: "",
      questions: [],
      players: [p0],
    };

    v1Rooms.set(code, room);
    socket.join(code);
    v1SendState(room);
  });

  socket.on("onevone:join_room", ({ code, name, equipped }) => {
    const c = String(code || "").trim().toUpperCase();
    const n = String(name || "").trim();
    if (!c) return v1Error(socket, "Enter a room code.");
    if (!n) return v1Error(socket, "Enter a name.");

    const room = v1Rooms.get(c);
    if (!room) return v1Error(socket, "Room not found.");
    if (room.started) return v1Error(socket, "Game already started.");
    if (room.players.length >= 2) return v1Error(socket, "Room full (2 players).");

    const eq = clampId(equipped);

    room.players.push({
      id: socket.id,
      name: n,
      equipped: eq,
      ready: false,
      hpMax: calcHpMax(eq),
      hp: calcHpMax(eq),
      qOrder: [],
      qPtr: 0,
      curQIndex: 0,
    });

    socket.join(c);
    v1SendState(room);
  });

  socket.on("onevone:update_equipped", ({ code, equipped }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = v1Rooms.get(c);
    if (!room) return;

    const p = room.players.find((x) => x.id === socket.id);
    if (!p) return;

    p.equipped = clampId(equipped);
    if (!room.started) {
      p.hpMax = calcHpMax(p.equipped);
      p.hp = p.hpMax;
    }

    v1SendState(room);
  });

  socket.on("onevone:set_ready", ({ code, ready }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = v1Rooms.get(c);
    if (!room) return;

    const p = room.players.find((x) => x.id === socket.id);
    if (!p) return;

    p.ready = !!ready;
    v1SendState(room);
  });

  socket.on("onevone:push_questions", ({ code, questions }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = v1Rooms.get(c);
    if (!room) return;

    const hostId = room.players[0]?.id;
    if (socket.id !== hostId) return v1Error(socket, "Only the host can add questions.");

    const list = Array.isArray(questions) ? questions : [];
    const normalized = [];

    for (const q of list) {
      const item = normalizeQuestion(q);
      if (item) normalized.push(item);
    }

    if (!normalized.length) return v1Error(socket, "No valid questions detected.");

    room.questions = normalized;
    room.started = false;
    room.ended = false;
    room.winnerId = "";
    v1SendState(room);
  });

  socket.on("onevone:start_game", ({ code }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = v1Rooms.get(c);
    if (!room) return;

    const hostId = room.players[0]?.id;
    if (socket.id !== hostId) return v1Error(socket, "Only the host can start.");
    if (room.players.length < 2) return v1Error(socket, "Need 2 players.");
    if (!room.questions.length) return v1Error(socket, "Upload a study file first.");

    const everyoneReady = room.players.every((p) => p.ready);
    if (!everyoneReady) return v1Error(socket, "Both players must be ready.");

    room.started = true;
    room.ended = false;
    room.winnerId = "";

    for (const p of room.players) {
      p.hpMax = calcHpMax(p.equipped);
      p.hp = p.hpMax;
      p.ready = false;
      v1InitQuestionStream(room, p);
    }

    v1SendState(room);
    io.to(room.code).emit("onevone:started", v1Public(room));

    for (const p of room.players) {
      io.to(p.id).emit("onevone:question", { q: v1CurrentQuestion(room, p) });
    }
  });

  socket.on("onevone:submit_answer", ({ code, picked }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = v1Rooms.get(c);
    if (!room || !room.started || room.ended) return;

    const me = room.players.find((p) => p.id === socket.id);
    if (!me) return;

    const enemy = room.players.find((p) => p.id !== socket.id);
    if (!enemy) return;

    const cur = v1CurrentQuestion(room, me);
    if (!cur) return;

    const pick = String(picked || "").toLowerCase();
    const correct = String(cur.correct || "").toLowerCase();

    if (pick === correct) {
      const dmg = calcDamage(me.equipped);
      enemy.hp = Math.max(0, enemy.hp - dmg);

      const roll = Math.floor(Math.random() * 100) + 1;
      if (roll <= lootChance(me.equipped)) {
        io.to(me.id).emit("onevone:loot", { amount: 1 });
      }
    } else {
      me.hp = Math.max(0, me.hp - 10);
    }

    if (enemy.hp <= 0) {
      room.ended = true;
      room.started = false;
      room.winnerId = me.id;
      v1SendState(room);
      io.to(room.code).emit("onevone:ended", { reason: "win", winner: me.id });
      return;
    }

    if (me.hp <= 0) {
      room.ended = true;
      room.started = false;
      room.winnerId = enemy.id;
      v1SendState(room);
      io.to(room.code).emit("onevone:ended", { reason: "win", winner: enemy.id });
      return;
    }

    io.to(me.id).emit("onevone:question", { q: v1NextQuestion(room, me) });
    v1SendState(room);
  });

  /* --------------------------
     Disconnect cleanup
  -------------------------- */
  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx === -1) continue;

      const wasHost = idx === 0;
      room.players.splice(idx, 1);

      if (!room.players.length) {
        if (room.tick) clearInterval(room.tick);
        rooms.delete(room.code);
        continue;
      }

      if (wasHost) {
        endRoom(room, "host_left");
      } else {
        sendRoomState(room);
      }
    }

    for (const room of v1Rooms.values()) {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx === -1) continue;

      room.players.splice(idx, 1);

      if (!room.players.length) {
        v1Rooms.delete(room.code);
        continue;
      }

      room.ended = true;
      room.started = false;
      room.winnerId = room.players[0]?.id || "";
      v1SendState(room);
      io.to(room.code).emit("onevone:ended", {
        reason: "opponent_left",
        winner: room.winnerId,
      });
    }
  });
});

/* =========================================================
   Upload endpoints
========================================================= */
app.post("/api/coop/upload", upload.single("file"), async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!rooms.has(code)) {
      return res.status(400).json({ error: "Room not found. Create the room first." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const text = await extractAny(req.file);
    if (text.length < 50) {
      return res.status(400).json({ error: "Not enough readable text found in the file." });
    }

    const questions = await generateQuestionsGemini(text, {
      targetCount: GEMINI_TARGET_COUNT,
      batchSize: GEMINI_BATCH_SIZE,
    });

    return res.json({ questions });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Upload failed." });
  }
});

app.post("/api/endless/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const text = await extractAny(req.file);
    if (text.length < 50) {
      return res.status(400).json({ error: "Not enough readable text found in the file." });
    }

    const questions = await generateQuestionsGemini(text, {
      targetCount: GEMINI_TARGET_COUNT,
      batchSize: GEMINI_BATCH_SIZE,
    });

    return res.json({ questions });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Upload failed." });
  }
});

app.post("/api/onevone/upload", upload.single("file"), async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const room = v1Rooms.get(code);
    if (!room) {
      return res.status(400).json({ error: "Room not found. Create the room first." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const text = await extractAny(req.file);
    if (text.length < 50) {
      return res.status(400).json({ error: "Not enough readable text found in the file." });
    }

    const questions = await generateQuestionsGemini(text, {
      targetCount: GEMINI_TARGET_COUNT,
      batchSize: GEMINI_BATCH_SIZE,
      onProgress: (p) => io.to(code).emit("onevone:upload_progress", p),
    });

    return res.json({ questions });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Upload failed." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});