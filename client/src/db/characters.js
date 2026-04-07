// client/src/db/characters.js
// Character definitions + base stats (1..100).
// Stats should feel different in gameplay.
// 1v1 server uses:
// - HP = health * 12
// - Damage per correct = round(damage * 1.6)
// - Loot = % chance to earn +1 coin on each correct answer during 1v1

export const CHARACTERS = [
  { id: "archer", folderName: "Archer", displayName: "Archer", baseStats: { health: 65, damage: 75, loot: 35 } },
  { id: "beggar", folderName: "Beggar", displayName: "Beggar", baseStats: { health: 45, damage: 15, loot: 100 } },
  { id: "fairy", folderName: "Fairy", displayName: "Fairy", baseStats: { health: 60, damage: 25, loot: 75 } },
  { id: "king", folderName: "King", displayName: "King", baseStats: { health: 100, damage: 10, loot: 20 } },
  { id: "knight", folderName: "Knight", displayName: "Knight", baseStats: { health: 75, damage: 55, loot: 25 } },
  { id: "merchant", folderName: "Merchant", displayName: "Merchant", baseStats: { health: 70, damage: 10, loot: 80 } },
  { id: "orc", folderName: "Orc", displayName: "Orc", baseStats: { health: 25, damage: 86, loot: 40 } },
  { id: "sorcerer", folderName: "Sorcerer", displayName: "Sorcerer", baseStats: { health: 35, damage: 90, loot: 5 } },
];

export const DEFAULT_CHARACTER_ID = "knight";

export function normalizeCharacterId(id) {
  return String(id || "").trim().toLowerCase();
}

export function getCharacterById(id) {
  const key = normalizeCharacterId(id);
  return CHARACTERS.find((c) => c.id === key) || null;
}

export function getFolderNameFromId(id) {
  return (getCharacterById(id)?.folderName) || getCharacterById(DEFAULT_CHARACTER_ID).folderName;
}

export function getDisplayNameFromId(id) {
  return (getCharacterById(id)?.displayName) || getCharacterById(DEFAULT_CHARACTER_ID).displayName;
}

export function getBaseStatsFor(id) {
  const c = getCharacterById(id) || getCharacterById(DEFAULT_CHARACTER_ID);
  return { ...c.baseStats };
}

export function clampStats(s) {
  const health = Math.max(1, Math.min(100, Number(s?.health ?? 1)));
  const damage = Math.max(1, Math.min(100, Number(s?.damage ?? 1)));
  const loot = Math.max(1, Math.min(100, Number(s?.loot ?? 1)));
  return { health, damage, loot };
}