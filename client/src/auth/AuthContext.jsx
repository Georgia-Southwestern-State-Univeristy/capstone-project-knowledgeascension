import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_CHARACTER_ID } from "../db/characters";

const AuthContext = createContext(null);

const DB_NAME = "knowledge_ascension_auth";
const DB_VERSION = 1;

const STORE_USERS = "users";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        db.createObjectStore(STORE_USERS, { keyPath: "username" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getUser(db, username) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_USERS, "readonly");
    const store = tx.objectStore(STORE_USERS);
    const req = store.get(username);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function putUser(db, userObj) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_USERS, "readwrite");
    const store = tx.objectStore(STORE_USERS);
    const req = store.put(userObj);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

function normalizeId(id) {
  return String(id || "").trim().toLowerCase();
}

export function AuthProvider({ children }) {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState(() => localStorage.getItem("ka_user") || "");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await openDb();
        if (!alive) return;
        setDb(d);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const refreshProfile = async (u) => {
    if (!db || !u) {
      setProfile(null);
      return null;
    }
    const row = await getUser(db, u);
    if (!row) {
      setProfile(null);
      return null;
    }
    const p = row.profile || null;
    setProfile(p);
    return p;
  };

  useEffect(() => {
    if (!db) return;
    if (!username) {
      setProfile(null);
      return;
    }
    refreshProfile(username).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const signup = async (u, pass) => {
    const user = String(u || "").trim();
    const pw = String(pass || "");
    if (!user) throw new Error("Username required");
    if (!pw) throw new Error("Password required");
    if (!db) throw new Error("DB not ready");

    const existing = await getUser(db, user);
    if (existing) throw new Error("Username already exists");

    const newUser = {
      username: user,
      password: pw,
      profile: {
        coins: 0,
        equippedCharacter: DEFAULT_CHARACTER_ID,
        ownedCharacters: [DEFAULT_CHARACTER_ID],
      },
    };

    await putUser(db, newUser);

    localStorage.setItem("ka_user", user);
    setUsername(user);
    setProfile(newUser.profile);
  };

  const login = async (u, pass) => {
    const user = String(u || "").trim();
    const pw = String(pass || "");
    if (!user) throw new Error("Username required");
    if (!pw) throw new Error("Password required");
    if (!db) throw new Error("DB not ready");

    const row = await getUser(db, user);
    if (!row) throw new Error("Account not found");
    if (row.password !== pw) throw new Error("Incorrect password");

    localStorage.setItem("ka_user", user);
    setUsername(user);
    setProfile(row.profile || null);
  };

  const logout = async () => {
    localStorage.removeItem("ka_user");
    setUsername("");
    setProfile(null);
  };

  const saveProfile = async (nextProfile) => {
    if (!db) throw new Error("DB not ready");
    if (!username) throw new Error("Not logged in");

    const row = await getUser(db, username);
    if (!row) throw new Error("Account missing");

    const updated = { ...row, profile: nextProfile };
    await putUser(db, updated);
    setProfile(nextProfile);
    return nextProfile;
  };

  const addCoins = async (amount) => {
    const delta = Number(amount || 0);
    if (!delta) return profile;
    if (!username) return profile;
    if (!profile) return profile;

    const coins = Math.max(0, Number(profile.coins || 0) + delta);
    const next = { ...profile, coins };
    return saveProfile(next);
  };

  // FIX: this is what Shop.jsx expects
  const purchaseCharacter = async (characterId, price) => {
    const id = normalizeId(characterId);
    const cost = Math.max(0, Number(price || 0));

    if (!username) throw new Error("Not logged in");
    if (!profile) throw new Error("Profile missing");

    const owned = new Set((profile.ownedCharacters || []).map(normalizeId));
    if (owned.has(id)) return true;

    const coins = Number(profile.coins || 0);
    if (coins < cost) return false;

    owned.add(id);

    const next = {
      ...profile,
      coins: coins - cost,
      ownedCharacters: Array.from(owned),
    };

    await saveProfile(next);
    return true;
  };

  // FIX: this is what Shop.jsx expects
  const equipCharacter = async (characterId) => {
    const id = normalizeId(characterId);

    if (!username) throw new Error("Not logged in");
    if (!profile) throw new Error("Profile missing");

    const owned = new Set((profile.ownedCharacters || []).map(normalizeId));
    if (!owned.has(id)) throw new Error("Character not owned");

    const next = { ...profile, equippedCharacter: id };
    await saveProfile(next);
    return true;
  };

  const value = useMemo(() => ({
    loading,
    username,
    profile,
    signup,
    login,
    logout,
    addCoins,
    purchaseCharacter,
    equipCharacter,
  }), [loading, username, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
