// client/src/db/questionsDb.js
// RUN-ONLY in-memory question bank.
// - Non-shared across modes unless you explicitly call setRunBank in that mode.
// - Reset every run by calling clearRunBank when entering/leaving a mode.
//
// Shape:
// { text, a, b, c, d, correct:"a"|"b"|"c"|"d" }

let RUN_BANK = [];

function normalizeCorrect(v) {
  const s = String(v || "").trim().toLowerCase();
  return ["a", "b", "c", "d"].includes(s) ? s : "a";
}

function normalizeQuestion(q) {
  if (!q) return null;

  const text = String(q.text || "").trim();
  const a = String(q.a || "").trim();
  const b = String(q.b || "").trim();
  const c = String(q.c || "").trim();
  const d = String(q.d || "").trim();
  const correct = normalizeCorrect(q.correct);

  if (!text || !a || !b || !c || !d) return null;
  return { text, a, b, c, d, correct };
}

export function clearRunBank() {
  RUN_BANK = [];
}

export function hasRunBank() {
  return RUN_BANK.length > 0;
}

export function getRunBankSize() {
  return RUN_BANK.length;
}

export function setRunBank(questions) {
  const list = Array.isArray(questions) ? questions : [];
  const out = [];

  for (const q of list) {
    const n = normalizeQuestion(q);
    if (n) out.push(n);
  }

  RUN_BANK = out;
  return RUN_BANK.length;
}

export async function getRandomQuestion() {
  if (!RUN_BANK.length) return null;
  const q = RUN_BANK[Math.floor(Math.random() * RUN_BANK.length)];
  return { ...q };
}