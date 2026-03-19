const roomQuestionCache = new Map();

export function getCachedQuestions(key) {
  const entry = roomQuestionCache.get(key);

  if (!entry) return null;

  const now = Date.now();
  if (entry.expiresAt < now) {
    roomQuestionCache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCachedQuestions(key, data, ttlMs = 5 * 60 * 1000) {
  roomQuestionCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearCachedQuestions(key) {
  roomQuestionCache.delete(key);
}