import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const DB_NAME = "ka_auth_db";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "username" });
      }
      if (!db.objectStoreNames.contains("profiles")) {
        db.createObjectStore("profiles", { keyPath: "username" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function txPut(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

function txDel(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

function defaultProfile(username) {
  return {
    username,
    coins: 0,
    ownedCharacters: ["knight"],
    equippedCharacter: "knight",
  };
}

export function AuthProvider({ children }) {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const _db = await openDb();
        if (!alive) return;
        setDb(_db);

        const savedUser = localStorage.getItem("ka_username") || "";
        if (savedUser) {
          const u = safeLower(savedUser);
          const prof = await txGet(_db, "profiles", u);
          setUsername(u);
          setProfile(prof || defaultProfile(u));
          if (!prof) await txPut(_db, "profiles", defaultProfile(u));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const refreshProfile = async (_db, u) => {
    const prof = await txGet(_db, "profiles", u);
    const finalProf = prof || defaultProfile(u);
    if (!prof) await txPut(_db, "profiles", finalProf);
    setProfile(finalProf);
    return finalProf;
  };

  const signup = async (rawUser, rawPass) => {
    if (!db) throw new Error("Database not ready.");
    const u = safeLower(rawUser);
    const p = String(rawPass || "");

    if (!u || u.length < 3) throw new Error("Username must be at least 3 characters.");
    if (!p || p.length < 3) throw new Error("Password must be at least 3 characters.");

    const existing = await txGet(db, "users", u);
    if (existing) throw new Error("Username already exists.");

    await txPut(db, "users", { username: u, password: p });

    const prof = defaultProfile(u);
    await txPut(db, "profiles", prof);

    localStorage.setItem("ka_username", u);
    setUsername(u);
    setProfile(prof);
  };

  const login = async (rawUser, rawPass) => {
    if (!db) throw new Error("Database not ready.");
    const u = safeLower(rawUser);
    const p = String(rawPass || "");

    const rec = await txGet(db, "users", u);
    if (!rec) throw new Error("Account not found.");
    if (rec.password !== p) throw new Error("Incorrect password.");

    localStorage.setItem("ka_username", u);
    setUsername(u);
    await refreshProfile(db, u);
  };

  const logout = async () => {
    localStorage.removeItem("ka_username");
    setUsername("");
    setProfile(null);
  };

  const addCoins = async (delta) => {
    if (!db) return;
    const u = safeLower(username);
    if (!u) return;

    const prof = await txGet(db, "profiles", u);
    const cur = prof || defaultProfile(u);

    const next = {
      ...cur,
      coins: Math.max(0, Number(cur.coins || 0) + Number(delta || 0)),
    };

    await txPut(db, "profiles", next);
    setProfile(next);
    return next;
  };

  const purchaseCharacter = async (characterId, price) => {
    if (!db) throw new Error("Database not ready.");
    const u = safeLower(username);
    if (!u) throw new Error("Not logged in.");

    const id = safeLower(characterId);
    const cost = Math.max(0, Number(price || 0));

    const prof = await txGet(db, "profiles", u);
    const cur = prof || defaultProfile(u);

    const owned = new Set((cur.ownedCharacters || []).map(safeLower));
    if (owned.has(id)) {
      // already owned, treat as success
      setProfile(cur);
      return true;
    }

    const curCoins = Number(cur.coins || 0);
    if (curCoins < cost) return false;

    owned.add(id);

    const next = {
      ...cur,
      coins: curCoins - cost,
      ownedCharacters: Array.from(owned),
    };

    await txPut(db, "profiles", next);
    setProfile(next);
    return true;
  };

  const equipCharacter = async (characterId) => {
    if (!db) throw new Error("Database not ready.");
    const u = safeLower(username);
    if (!u) throw new Error("Not logged in.");

    const id = safeLower(characterId);

    const prof = await txGet(db, "profiles", u);
    const cur = prof || defaultProfile(u);

    const owned = new Set((cur.ownedCharacters || []).map(safeLower));
    if (!owned.has(id)) throw new Error("Character not owned.");

    const next = {
      ...cur,
      equippedCharacter: id,
    };

    await txPut(db, "profiles", next);
    setProfile(next);
    return next;
  };

  const value = useMemo(
    () => ({
      loading,
      username,
      profile,
      signup,
      login,
      logout,
      addCoins,
      purchaseCharacter,
      equipCharacter,
    }),
    [loading, username, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
