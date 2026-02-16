import React, { useEffect, useMemo, useRef, useState } from "react";
import "./shop.css";
import trackShop from "../assets/audio/track_shop.mp3";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Shop({ onBack }) {
  const { loading, username, profile, equipCharacter, buyCharacter, logout } = useAuth();

  // 1920x1080 stage scaling (same as menu)
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const W = 1920, H = 1080;
    const update = () =>
      setScale(Math.min(1, Math.min(window.innerWidth / W, window.innerHeight / H)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const stageStyle = useMemo(
    () => ({ transform: `translate(-50%, -50%) scale(${scale})` }),
    [scale]
  );

  // Music
  const audioRef = useRef(null);
  const [musicOn, setMusicOn] = useState(false);
  const [volume, setVolume] = useState(0.6);

  useEffect(() => {
    const a = new Audio(trackShop);
    a.loop = true;
    a.volume = volume;
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const startMusic = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      await a.play();
      setMusicOn(true);
    } catch {
      setMusicOn(false);
    }
  };

  const stopMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setMusicOn(false);
  };

  // UI selection + keyboard
  const [selected, setSelected] = useState("KNIGHT");
  useEffect(() => {
    const order = ["KNIGHT", "MAGE", "ROGUE", "BACK"];
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();
      if (k === "arrowright" || k === "d")
        setSelected((cur) => order[(order.indexOf(cur) + 1) % order.length]);
      if (k === "arrowleft" || k === "a")
        setSelected((cur) => order[(order.indexOf(cur) - 1 + order.length) % order.length]);

      if (k === "escape") onBack?.();

      if (k === "enter") {
        if (selected === "BACK") onBack?.();
        if (selected === "KNIGHT") onEquipOrBuy("knight");
        if (selected === "MAGE") onEquipOrBuy("mage");
        if (selected === "ROGUE") onEquipOrBuy("rogue");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, onBack, username, profile]);

  // Button image wrapper (glow behind)
  const Btn = ({ imgSrc, alt }) => (
    <div className="btnWrap">
      <div className="goldGlow" />
      <img src={imgSrc} alt={alt} draggable="false" />
    </div>
  );

  // Shop logic (stubbed safely if your auth context doesn’t have these yet)
  const [msg, setMsg] = useState("");

  const coins = profile?.coins ?? 0;
  const equipped = profile?.equippedCharacter ?? "knight";

  const owned = profile?.ownedCharacters ?? ["knight"]; // fallback
  const prices = { knight: 0, mage: 250, rogue: 250 };

  const isOwned = (id) => owned?.includes(id);
  const isEquipped = (id) => equipped === id;

  const onEquipOrBuy = async (id) => {
    setMsg("");
    if (!username) {
      setMsg("Login to use the shop.");
      return;
    }

    try {
      // If not owned, attempt purchase
      if (!isOwned(id)) {
        if (typeof buyCharacter !== "function") {
          setMsg("buyCharacter() not wired yet in AuthContext.");
          return;
        }
        await buyCharacter(id); // expected to deduct coins + add owned
        setMsg(`Purchased ${id}!`);
      }

      // Equip
      if (!isEquipped(id)) {
        if (typeof equipCharacter !== "function") {
          setMsg("equipCharacter() not wired yet in AuthContext.");
          return;
        }
        await equipCharacter(id);
        setMsg(`Equipped ${id}!`);
      } else {
        setMsg(`${id} is already equipped.`);
      }
    } catch (e) {
      setMsg(e?.message || "Error");
    }
  };

  const labelFor = (id) => {
    if (isEquipped(id)) return "Equipped";
    if (isOwned(id)) return "Equip";
    return `Buy (${prices[id]})`;
  };

  return (
    <div className="menuRoot">
      {/* Background image/video for shop */}
      <video className="menuBg" src="/assets/shop/bg.mp4" autoPlay loop muted playsInline />

      <div className="menuStage" style={stageStyle}>
        {/* Account panel (re-uses menu styles) */}
        <div className="loginPanel">
          {loading ? (
            <div className="loginTitle">Loading</div>
          ) : username ? (
            <>
              <div className="loginTitle">Shop</div>
              <div className="loginRow">
                <b>User:</b> {username}
              </div>
              <div className="loginRow">
                <b>Brains:</b> {coins}
              </div>
              <div className="loginRow">
                <b>Equipped:</b> {equipped}
              </div>
              <button className="loginBtn" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <div className="loginTitle">Shop</div>
              <div className="loginRow">Login from the main menu to buy/equip.</div>
              <button className="loginBtn" onClick={onBack}>
                Back to Menu
              </button>
            </>
          )}

          {msg && <div className="loginMsg">{msg}</div>}
        </div>

        {/* Title */}
        <img
          className="menuTitle"
          src="/assets/shop/title.png"
          alt="Shop"
          draggable="false"
        />

        {/* Back button */}
        <button
          className={`imgBtn shopBtn ${selected === "BACK" ? "selected" : ""}`}
          onMouseEnter={() => setSelected("BACK")}
          onClick={() => onBack?.()}
        >
          <Btn imgSrc="/assets/shop/btn_back.png" alt="Back" />
        </button>

        {/* Character cards (buttons) */}
        <button
          className={`imgBtn modeBtn btn1 ${selected === "KNIGHT" ? "selected" : ""}`}
          onMouseEnter={() => setSelected("KNIGHT")}
          onClick={() => onEquipOrBuy("knight")}
        >
          <Btn imgSrc="/assets/shop/btn_knight.png" alt={`Knight - ${labelFor("knight")}`} />
        </button>

        <button
          className={`imgBtn modeBtn btn2 ${selected === "MAGE" ? "selected" : ""}`}
          onMouseEnter={() => setSelected("MAGE")}
          onClick={() => onEquipOrBuy("mage")}
        >
          <Btn imgSrc="/assets/shop/btn_mage.png" alt={`Mage - ${labelFor("mage")}`} />
        </button>

        <button
          className={`imgBtn modeBtn btn3 ${selected === "ROGUE" ? "selected" : ""}`}
          onMouseEnter={() => setSelected("ROGUE")}
          onClick={() => onEquipOrBuy("rogue")}
        >
          <Btn imgSrc="/assets/shop/btn_rogue.png" alt={`Rogue - ${labelFor("rogue")}`} />
        </button>

        {/* Music panel */}
        <div className="musicPanel">
          {!musicOn ? (
            <button onClick={startMusic}>Start Music</button>
          ) : (
            <button onClick={stopMusic}>Stop Music</button>
          )}
          <span style={{ color: "#fff", opacity: 0.9 }}>Vol</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
