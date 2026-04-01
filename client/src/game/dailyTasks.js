function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}
async function todayKey() { 
  try {
    const response = await fetch("https://timeapi.io/api/Time/current/zone?timeZone=UTC");
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log(data.year + "-" + data.month + "-" + data.day);
    return `${data.year}-${data.month}-${data.day}`;
  } catch (error) {
    console.error("Error fetching time:", error);
  }
}
/*function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}*/

function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffleWithRng(arr, rng) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function statsKey(username) {
  return `ka_daily_stats_${safeLower(username || "guest")}`;
}

function tasksKey(username) {
  return `ka_daily_tasks_${safeLower(username || "guest")}`;
}

const DEFAULT_STATS = {
  enemyKills: 0,
  correctAnswers: 0,
  coinsEarned: 0,
  endlessRuns: 0,
  coopMatches: 0,
  coopWins: 0,
  onevoneMatches: 0,
  onevoneWins: 0,
};

export function getDailyStats(username) {
  return readJson(statsKey(username), { ...DEFAULT_STATS });
}

export function recordDailyStat(username, statName, amount = 1) {
  const user = safeLower(username);
  if (!user) return;

  const stats = getDailyStats(user);
  const next = {
    ...stats,
    [statName]: Math.max(0, Number(stats[statName] || 0) + Number(amount || 0)),
  };

  writeJson(statsKey(user), next);
}

const TASK_TEMPLATES = [
  { id: "kill_1", stat: "enemyKills", label: (n) => `Defeat ${n} enemies`, min: 4, max: 10, rewardMin: 18, rewardMax: 32 },
  { id: "kill_2", stat: "enemyKills", label: (n) => `Take down ${n} monsters`, min: 8, max: 18, rewardMin: 28, rewardMax: 45 },
  { id: "kill_3", stat: "enemyKills", label: (n) => `Eliminate ${n} enemies in battle`, min: 10, max: 22, rewardMin: 34, rewardMax: 54 },
  { id: "kill_4", stat: "enemyKills", label: (n) => `Clear out ${n} enemy mobs`, min: 12, max: 26, rewardMin: 40, rewardMax: 60 },
  { id: "kill_5", stat: "enemyKills", label: (n) => `Destroy ${n} foes`, min: 14, max: 30, rewardMin: 42, rewardMax: 66 },

  { id: "correct_1", stat: "correctAnswers", label: (n) => `Answer ${n} questions correctly`, min: 8, max: 16, rewardMin: 18, rewardMax: 34 },
  { id: "correct_2", stat: "correctAnswers", label: (n) => `Get ${n} right answers`, min: 12, max: 22, rewardMin: 28, rewardMax: 42 },
  { id: "correct_3", stat: "correctAnswers", label: (n) => `Land ${n} correct answers today`, min: 16, max: 30, rewardMin: 34, rewardMax: 54 },
  { id: "correct_4", stat: "correctAnswers", label: (n) => `Solve ${n} questions correctly`, min: 20, max: 36, rewardMin: 40, rewardMax: 62 },
  { id: "correct_5", stat: "correctAnswers", label: (n) => `Hit ${n} correct answers in matches`, min: 24, max: 42, rewardMin: 48, rewardMax: 70 },

  { id: "coins_1", stat: "coinsEarned", label: (n) => `Earn ${n} coins`, min: 10, max: 30, rewardMin: 16, rewardMax: 28 },
  { id: "coins_2", stat: "coinsEarned", label: (n) => `Collect ${n} coins from gameplay`, min: 20, max: 45, rewardMin: 24, rewardMax: 38 },
  { id: "coins_3", stat: "coinsEarned", label: (n) => `Stack up ${n} coins today`, min: 30, max: 60, rewardMin: 30, rewardMax: 48 },
  { id: "coins_4", stat: "coinsEarned", label: (n) => `Bring home ${n} coins`, min: 40, max: 75, rewardMin: 38, rewardMax: 56 },
  { id: "coins_5", stat: "coinsEarned", label: (n) => `Farm ${n} coins`, min: 50, max: 90, rewardMin: 46, rewardMax: 64 },

  { id: "endless_1", stat: "endlessRuns", label: (n) => `Start ${n} Endless runs`, min: 1, max: 3, rewardMin: 16, rewardMax: 24 },
  { id: "endless_2", stat: "endlessRuns", label: (n) => `Play Endless mode ${n} times`, min: 2, max: 4, rewardMin: 22, rewardMax: 34 },
  { id: "endless_3", stat: "endlessRuns", label: (n) => `Jump into ${n} Endless runs today`, min: 3, max: 5, rewardMin: 30, rewardMax: 42 },

  { id: "coop_1", stat: "coopMatches", label: (n) => `Play ${n} co-op boss matches`, min: 1, max: 3, rewardMin: 20, rewardMax: 30 },
  { id: "coop_2", stat: "coopWins", label: (n) => `Win ${n} co-op boss fights`, min: 1, max: 2, rewardMin: 36, rewardMax: 58 },
  { id: "coop_3", stat: "coopMatches", label: (n) => `Queue up for co-op ${n} times`, min: 2, max: 4, rewardMin: 28, rewardMax: 40 },

  { id: "duel_1", stat: "onevoneMatches", label: (n) => `Play ${n} 1v1 duels`, min: 1, max: 3, rewardMin: 20, rewardMax: 32 },
  { id: "duel_2", stat: "onevoneWins", label: (n) => `Win ${n} 1v1 matches`, min: 1, max: 2, rewardMin: 40, rewardMax: 62 },
  { id: "duel_3", stat: "onevoneMatches", label: (n) => `Enter ${n} 1v1 battles`, min: 2, max: 4, rewardMin: 28, rewardMax: 42 },

  { id: "mix_1", stat: "correctAnswers", label: (n) => `Stay sharp with ${n} correct answers`, min: 10, max: 20, rewardMin: 22, rewardMax: 34 },
  { id: "mix_2", stat: "enemyKills", label: (n) => `Go on a streak of ${n} enemy kills`, min: 6, max: 14, rewardMin: 22, rewardMax: 36 },
];

async function ensureDailyTaskPack(username) { //changed to async.
  const user = safeLower(username);
  const today = await todayKey(); //changed to await
  const existing = readJson(tasksKey(user), null);
  const stats = getDailyStats(user);
  if (existing?.date === today && Array.isArray(existing?.tasks)) {
    return existing;
  }

  const seedFn = hashString(`${user}_${today}_daily_tasks`);
  const rng = mulberry32(seedFn());

  const chosen = shuffleWithRng(TASK_TEMPLATES, rng).slice(0, 6);

  const tasks = chosen.map((tpl, index) => {
    const target = randInt(rng, tpl.min, tpl.max);
    const reward = randInt(rng, tpl.rewardMin, tpl.rewardMax);
    const startValue = Number(stats[tpl.stat] || 0);

    return {
      instanceId: `${tpl.id}_${index}`,
      templateId: tpl.id,
      stat: tpl.stat,
      text: tpl.label(target),
      target,
      reward,
      startValue,
      claimed: false,
    };
  });

  const pack = {
    date: today,
    tasks,
  };

  writeJson(tasksKey(user), pack);
  return pack;
}

export async function getDailyTaskPack(username) { //changed to async
  const user = safeLower(username);
  const pack = await ensureDailyTaskPack(user); //changeed to await
  const stats = getDailyStats(user);

  const tasks = pack.tasks.map((task) => {
    const current = Number(stats[task.stat] || 0);
    const progress = Math.max(0, current - Number(task.startValue || 0));
    const complete = progress >= Number(task.target || 0);

    return {
      ...task,
      progress,
      complete,
    };
  });

  const claimedCount = tasks.filter((t) => t.claimed).length;
  const completedCount = tasks.filter((t) => t.complete).length;

  return {
    date: pack.date,
    tasks,
    claimedCount,
    completedCount,
  };
}

export async function claimDailyTask(username, instanceId) { //changed to async
  const user = safeLower(username);
  const pack = await ensureDailyTaskPack(user); //changed to await
  const stats = getDailyStats(user);

  const idx = pack.tasks.findIndex((t) => t.instanceId === instanceId);
  if (idx === -1) return { ok: false, reward: 0 };

  const task = pack.tasks[idx];
  const progress = Math.max(0, Number(stats[task.stat] || 0) - Number(task.startValue || 0));
  const complete = progress >= Number(task.target || 0);

  if (!complete || task.claimed) {
    return { ok: false, reward: 0 };
  }

  pack.tasks[idx] = {
    ...task,
    claimed: true,
  };

  writeJson(tasksKey(user), pack);

  return {
    ok: true,
    reward: Number(task.reward || 0),
  };
}