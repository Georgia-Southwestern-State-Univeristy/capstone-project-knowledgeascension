import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createAccount, getProfile, loginAccount, updateProfile } from "../db/appDb";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = localStorage.getItem("ka_username");
      if (saved) {
        const p = await getProfile(saved);
        setUsername(saved);
        setProfile(p);
      }
      setLoading(false);
    })();
  }, []);

  const signup = async (u, p) => {
    const newUser = await createAccount({ username: u, password: p });
    localStorage.setItem("ka_username", newUser);
    const prof = await getProfile(newUser);
    setUsername(newUser);
    setProfile(prof);
    return newUser;
  };

  const login = async (u, p) => {
    const res = await loginAccount({ username: u, password: p });
    localStorage.setItem("ka_username", res.username);
    setUsername(res.username);
    setProfile(res.profile);
    return res.username;
  };

  const logout = () => {
    localStorage.removeItem("ka_username");
    setUsername(null);
    setProfile(null);
  };

  const addCoins = async (amount) => {
    if (!username) return null;
    const currentCoins = Number(profile?.coins ?? 0);
    const nextCoins = Math.max(0, currentCoins + Number(amount || 0));
    const updated = await updateProfile(username, { coins: nextCoins });
    setProfile(updated);
    return updated;
  };

  const setEquippedCharacter = async (characterKey) => {
    if (!username) return null;
    const updated = await updateProfile(username, { equippedCharacter: characterKey });
    setProfile(updated);
    return updated;
  };

  const value = useMemo(() => ({
    loading,
    username,
    profile,
    signup,
    login,
    logout,
    addCoins,
    setEquippedCharacter,
    setProfile
  }), [loading, username, profile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
