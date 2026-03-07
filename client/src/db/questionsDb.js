// client/src/db/questionsDb.js
// Simple in-memory question bank (no IndexedDB)
// Shape:
// { id:number, text:string, a:string, b:string, c:string, d:string, correct:"a"|"b"|"c"|"d" }

const QUESTIONS = [
  {
    id: 1,
    text: "What does CPU stand for?",
    a: "Central Processing Unit",
    b: "Computer Personal Unit",
    c: "Central Power Utility",
    d: "Control Program Unit",
    correct: "a",
  },
  {
    id: 2,
    text: "Which data structure uses FIFO?",
    a: "Stack",
    b: "Queue",
    c: "Tree",
    d: "Graph",
    correct: "b",
  },
  {
    id: 3,
    text: "Which protocol is used for secure web browsing?",
    a: "HTTP",
    b: "FTP",
    c: "HTTPS",
    d: "SMTP",
    correct: "c",
  },
  {
    id: 4,
    text: "What is 2^5?",
    a: "10",
    b: "16",
    c: "32",
    d: "64",
    correct: "c",
  },
  {
    id: 5,
    text: "Which one is a relational database?",
    a: "MySQL",
    b: "MongoDB",
    c: "Redis",
    d: "Neo4j",
    correct: "a",
  },
  {
    id: 6,
    text: "What does RAM stand for?",
    a: "Read Access Memory",
    b: "Random Access Memory",
    c: "Run Access Module",
    d: "Rapid Action Memory",
    correct: "b",
  },
  {
    id: 7,
    text: "Which is a version control system?",
    a: "Node.js",
    b: "Git",
    c: "NPM",
    d: "React",
    correct: "b",
  },
  {
    id: 8,
    text: "Which language is primarily used for styling web pages?",
    a: "HTML",
    b: "CSS",
    c: "JavaScript",
    d: "Python",
    correct: "b",
  },
  {
    id: 9,
    text: "What does SQL stand for?",
    a: "Structured Query Language",
    b: "Simple Query Logic",
    c: "System Queue Language",
    d: "Standard Question List",
    correct: "a",
  },
  {
    id: 10,
    text: "What is 8 * 8?",
    a: "16",
    b: "32",
    c: "64",
    d: "128",
    correct: "c",
  },
];

const API_BASE = "http://localhost:4000/api";

export async function seedQuestionsIfNeeded() {
  return true;
}

export async function getRandomQuestion() {
  const res = await fetch("http://localhost:4000/api/questions/random");
  return await res.json();
}
