// client/src/db/characters.js
// Stores character ids (saved in IndexedDB/profile) and the folder casing used in /public/assets/characters/.

export const CHARACTERS = [
  { id: "archer", folderName: "Archer", displayName: "Archer" },
  { id: "beggar", folderName: "Beggar", displayName: "Beggar" },
  { id: "fairy", folderName: "Fairy", displayName: "Fairy" },
  { id: "king", folderName: "King", displayName: "King" },
  { id: "knight", folderName: "Knight", displayName: "Knight" },
  { id: "merchant", folderName: "Merchant", displayName: "Merchant" },
  { id: "orc", folderName: "Orc", displayName: "Orc" },
  { id: "sorcerer", folderName: "Sorcerer", displayName: "Sorcerer" },
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
