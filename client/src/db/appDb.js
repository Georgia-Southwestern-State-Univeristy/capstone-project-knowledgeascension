import Dexie from "dexie";

export const appDb = new Dexie("knowledge_ascension_db");

appDb.version(1).stores({
  users: "username, passwordHash, createdAt",
  profiles: "username, coins, equippedCharacter"
});

export async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function createAccount({ username, password }) {
  const cleanUser = (username || "").trim().toLowerCase();
  if (!cleanUser || cleanUser.length < 3) throw new Error("Username must be at least 3 characters.");
  if (!password || password.length < 4) throw new Error("Password must be at least 4 characters.");

  const existing = await appDb.users.get(cleanUser);
  if (existing) throw new Error("Username already exists.");

  const passwordHash = await sha256(password);

  await appDb.users.add({
    username: cleanUser,
    passwordHash,
    createdAt: Date.now()
  });

  await appDb.profiles.put({
    username: cleanUser,
    coins: 0,
    equippedCharacter: "knight",
    ownedCharacters: ["knight"]
  });

  return cleanUser;
}

export async function loginAccount({ username, password }) {
  const cleanUser = (username || "").trim().toLowerCase();
  const user = await appDb.users.get(cleanUser);
  if (!user) throw new Error("Account not found.");

  const passwordHash = await sha256(password);
  if (passwordHash !== user.passwordHash) throw new Error("Incorrect password.");

  const profile = await appDb.profiles.get(cleanUser);
  return { username: cleanUser, profile };
}

export async function getProfile(username) {
  if (!username) return null;
  return await appDb.profiles.get(username);
}

export async function updateProfile(username, patch) {
  const current = await appDb.profiles.get(username);
  if (!current) throw new Error("Profile not found.");
  const updated = { ...current, ...patch };
  await appDb.profiles.put(updated);
  return updated;
}
