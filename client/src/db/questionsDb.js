import Dexie from "dexie";

export const db = new Dexie("knowledge_ascension_db");

db.version(1).stores({
  questions: "++id, text"
});

// Seed once if empty
export async function seedQuestionsIfNeeded() {
  const count = await db.questions.count();
  if (count > 0) return;

  await db.questions.bulkAdd([
    {
      text: "What does CPU stand for?",
      a: "Central Processing Unit",
      b: "Computer Personal Unit",
      c: "Central Power Utility",
      d: "Control Program Unit",
      correct: "a"
    },
    {
      text: "Which data structure uses FIFO?",
      a: "Stack",
      b: "Queue",
      c: "Tree",
      d: "Graph",
      correct: "b"
    },
    {
      text: "Which protocol is used for secure web browsing?",
      a: "HTTP",
      b: "FTP",
      c: "HTTPS",
      d: "SMTP",
      correct: "c"
    },
    {
      text: "What is 2^5?",
      a: "10",
      b: "16",
      c: "32",
      d: "64",
      correct: "c"
    },
    {
      text: "Which one is a relational database?",
      a: "MySQL",
      b: "Redis",
      c: "MongoDB",
      d: "Neo4j",
      correct: "a"
    }
  ]);
}

export async function getRandomQuestion() {
  const count = await db.questions.count();
  if (count === 0) return null;

  // Dexie doesn't have a native random pick, so we pick by offset
  const idx = Math.floor(Math.random() * count);
  const q = await db.questions.offset(idx).first();
  return q ?? null;
}
