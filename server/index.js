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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "2mb" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

/* --------------------------
   Room model (in-memory)
--------------------------- */
const rooms = new Map(); // code -> room

function makeCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function createUniqueCode() {
  let code = makeCode();
  while (rooms.has(code)) code = makeCode();
  return code;
}

function roomPublic(room) {
  return {
    code: room.code,
    started: room.started,
    bossHp: room.bossHp,
    timerMs: room.timerMs,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      hp: p.hp,
      equipped: p.equipped
    })),
    questionCount: room.questions.length
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
}

function allDead(room) {
  return room.players.every(p => p.hp <= 0);
}

/* --------------------------
   Socket.io
--------------------------- */
io.on("connection", (socket) => {
  socket.on("coop:create_room", ({ name, equipped }) => {
    const n = String(name || "").trim();
    if (!n) return roomError(socket, "Enter a name.");

    const code = createUniqueCode();
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
          deadUntil: 0
        }
      ],
      questions: [],
      qIndex: 0,
      tick: null
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
      deadUntil: 0
    });

    sendRoomState(room);
  });

  socket.on("coop:set_ready", ({ code, ready }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = rooms.get(c);
    if (!room) return;

    const p = room.players.find(x => x.id === socket.id);
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

    const everyoneReady = room.players.every(p => p.ready);
    if (!everyoneReady) return roomError(socket, "All players must be ready.");

    room.started = true;
    room.ended = false;
    room.bossHp = 5000;
    room.timerMs = 5 * 60 * 1000;

    for (const p of room.players) {
      p.hp = 100;
      p.deadUntil = 0;
      p.ready = false;
    }

    room.qIndex = 0;

    io.to(room.code).emit("coop:started", roomPublic(room));
    io.to(room.code).emit("coop:question", { q: getCurrentQuestion(room) });

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
    room.questions.push(...normalized);

    if (!room.started) {
      room.qIndex = 0;
    }

    sendRoomState(room);
  });

  socket.on("coop:submit_answer", ({ code, picked }) => {
    const c = String(code || "").trim().toUpperCase();
    const room = rooms.get(c);
    if (!room || !room.started || room.ended) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (player.hp <= 0) return;

    const now = Date.now();
    if (player.deadUntil && now < player.deadUntil) return;

    const cur = getCurrentQuestion(room);
    if (!cur) return;

    const pick = String(picked || "").toLowerCase();
    const correct = String(cur.correct || "").toLowerCase();

    if (pick === correct) {
      const dmg = 10 + Math.floor(Math.random() * 51); // 10..60
      room.bossHp = Math.max(0, room.bossHp - dmg);

      const coinDrop = 1; // Manual: adjust coin rules here
      io.to(room.code).emit("coop:hit", {
        playerId: socket.id,
        damage: dmg,
        coinDrop
      });
    } else {
      player.hp = Math.max(0, player.hp - 10);
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

    const p = room.players.find(x => x.id === socket.id);
    if (!p) return;

    const now = Date.now();
    if (p.hp > 0) return;
    if (p.deadUntil && now < p.deadUntil) return;

    p.hp = 100;
    p.deadUntil = 0;
    sendRoomState(room);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx === -1) continue;

      const wasHost = idx === 0;
      room.players.splice(idx, 1);

      if (!room.players.length) {
        endRoom(room, "host_left");
        rooms.delete(room.code);
        continue;
      }

      if (wasHost) {
        endRoom(room, "host_left");
      } else {
        sendRoomState(room);
      }
    }
  });
});

/* --------------------------
   Upload + Gemini
--------------------------- */
app.post("/api/coop/upload", upload.single("file"), async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!rooms.has(code)) {
      return res.status(400).json({ error: "Room not found. Create the room first." });
    }

    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const ext = (req.file.originalname.split(".").pop() || "").toLowerCase();
    const buf = req.file.buffer;

    let text = "";
    if (ext === "pdf") text = await extractPdf(buf);
    else if (ext === "docx") text = await extractDocx(buf);
    else if (ext === "pptx") text = await extractPptx(buf);
    else return res.status(400).json({ error: "Unsupported file type. Use PDF/DOCX/PPTX." });

    text = cleanText(text);

    if (text.length < 50) {
      return res.status(400).json({ error: "Not enough readable text found in the file." });
    }

    const questions = await generateQuestionsGemini(text);
    return res.json({ questions });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Upload failed." });
  }
});

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
  const slides = Object.keys(zip.files).filter((k) => k.startsWith("ppt/slides/slide") && k.endsWith(".xml"));

  let all = "";
  for (const s of slides) {
    const xml = await zip.files[s].async("string");
    all += " " + xml.replace(/<[^>]+>/g, " ");
  }
  return all;
}

function cleanText(t) {
  return String(t || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18000); // keep prompt size stable
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

async function generateQuestionsGemini(text) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in server/.env");
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt =
    "Create a JSON array of multiple-choice questions from the study content below.\n" +
    "Rules:\n" +
    "- Each question must have exactly 4 answer choices.\n" +
    "- Output ONLY valid JSON (no markdown, no extra text).\n" +
    "- Each item format: {\"text\":\"...\",\"a\":\"...\",\"b\":\"...\",\"c\":\"...\",\"d\":\"...\",\"correct\":\"a|b|c|d\"}\n" +
    "- Make 12 questions.\n\n" +
    "STUDY CONTENT:\n" +
    text;

  const result = await model.generateContent(prompt);
  const raw = result?.response?.text?.() || "";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to salvage JSON if Gemini adds accidental text
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("Gemini did not return JSON.");
    parsed = JSON.parse(raw.slice(start, end + 1));
  }

  const out = [];
  for (const q of Array.isArray(parsed) ? parsed : []) {
    const n = normalizeQuestion(q);
    if (n) out.push(n);
  }
  return out;
}

server.listen(PORT, () => {
  console.log(`Co-op server running on http://localhost:${PORT}`);
});
