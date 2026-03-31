<<<<<<< HEAD
import React, { useEffect, useMemo, useState } from "react";
import "./shop.css";
import { useAuth } from "../auth/AuthContext.jsx";
import { CHARACTERS, DEFAULT_CHARACTER_ID } from "../db/characters";

const ARENAS = [
  "/assets/arenas/forest.png",
  "/assets/arenas/desert.png",
  "/assets/arenas/temple.png",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PRICES = {
  knight: 0,
  archer: 75,
  beggar: 50,
  fairy: 120,
  king: 200,
  merchant: 150,
  orc: 180,
  sorcerer: 220,
};

const COIN_ICON = "/assets/ui/coin.png";
const SCROLL_IMG = "/assets/ui/Scroll.png";
const SHOP_ICON = "/assets/ui/Shop_icon.png";

const BTN_MENU = "/assets/ui/btn_menu.png";
const BTN_PURCHASE = "/assets/ui/btn_purchase.png";
const BTN_EQUIP = "/assets/ui/btn_equip.png";

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

function StatBar({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="shopStatRow">
      <div className="shopStatLabel">{label}</div>
      <div className="shopStatTrack">
        <div className="shopStatFill" style={{ width: `${v}%` }} />
      </div>
      <div className="shopStatNum">{v}</div>
    </div>
  );
}

export default function Shop({ onBackToMenu }) {
  const { username, profile, purchaseCharacter, equipCharacter } = useAuth();

  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");

  const [arenaBg, setArenaBg] = useState(() => pick(ARENAS));
  useEffect(() => {
    setArenaBg(pick(ARENAS));
  }, []);

  const owned = useMemo(() => new Set((profile?.ownedCharacters || []).map(safeLower)), [profile]);
  const equipped = safeLower(profile?.equippedCharacter || DEFAULT_CHARACTER_ID);
  const coins = Number(profile?.coins || 0);
  const statMap = profile?.characterStats || {};

  const doBuy = async (ch) => {
    if (!username) {
      setMsg("You must be logged in to purchase.");
      return;
    }
    setMsg("");
    setBusyId(ch.id);

    try {
      const price = PRICES[ch.id] ?? 0;
      const ok = await purchaseCharacter(ch.id, price);
      if (!ok) setMsg("Not enough coins.");
      else setMsg(`${ch.displayName} purchased.`);
    } catch {
      setMsg("Purchase failed.");
    }

    setBusyId("");
  };

  const doEquip = async (ch) => {
    if (!username) {
      setMsg("You must be logged in to equip.");
      return;
    }
    setMsg("");
    setBusyId(ch.id);

    try {
      await equipCharacter(ch.id);
      setMsg(`${ch.displayName} equipped.`);
    } catch {
      setMsg("Equip failed.");
    }

    setBusyId("");
  };

  return (
    <div className="shopRoot">
      <img className="shopBg" src={arenaBg} alt="" draggable="false" />

      <div className="shopStage">
        <button className="shopBackBtn shopImgBtn glowBtn" onClick={onBackToMenu} type="button">
          <img src={BTN_MENU} alt="Menu" draggable="false" />
        </button>

        <div className="shopTitleIcon">
          <img className="shopIconImg" src={SHOP_ICON} alt="Shop" draggable="false" />
        </div>

        <div className="shopCoins">
          <div className="shopCoinsRow">
            <img className="shopCoinIcon" src={COIN_ICON} alt="Coin" draggable="false" />
            <span className="shopCoinsValue">{coins}</span>
          </div>
          <div className="shopAccountHint">
            {username ? `Logged in as: ${username}` : "Not logged in"}
          </div>
        </div>

        <div className="shopPaper">
          <div className="shopPaperBlur" aria-hidden="true" />
          <img className="shopScrollImg" src={SCROLL_IMG} alt="" draggable="false" />

          <div className="paperMask">
            <div className="paperHeader">
              <div className="paperHeaderTitle">Characters</div>
              {msg ? <div className="paperMsg">{msg}</div> : <div className="paperMsg muted"> </div>}
            </div>

            <div className="paperScroll">
              {CHARACTERS.map((ch) => {
                const isOwned = owned.has(ch.id);
                const isEquipped = equipped === ch.id;
                const price = PRICES[ch.id] ?? 0;
                const imgSrc = `/assets/characters/${ch.folderName}/front.png`;

                const st = statMap[ch.id] || ch.baseStats;

                return (
                  <div className="shopRow" key={ch.id}>
                    <div className="shopCharPreview">
                      <img src={imgSrc} alt={ch.displayName} draggable="false" />
                    </div>

                    {/* New middle column layout: info + stat bars + actions */}
                    <div className="shopCharInfo">
                      <div className="shopCharName">{ch.displayName}</div>

                      <div className="shopCharMeta">
                        <div className="shopPrice">
                          Price:
                          <span className="shopPriceWithCoin">
                            <img className="shopCoinTiny" src={COIN_ICON} alt="Coin" draggable="false" />
                            <b>{price}</b>
                          </span>
                        </div>

                        <div className="shopStatus">
                          {isEquipped ? (
                            <span className="tag equipped">Equipped</span>
                          ) : isOwned ? (
                            <span className="tag owned">Owned</span>
                          ) : (
                            <span className="tag locked">Locked</span>
                          )}
                        </div>
                      </div>

                      {/* Stat bars BETWEEN sprite and the button area */}
                      <div className="shopStatBars">
                        <StatBar label="HP" value={st.health} />
                        <StatBar label="DMG" value={st.damage} />
                        <StatBar label="LOOT" value={st.loot} />
                      </div>

                      <div className="shopActions">
                        {!isOwned ? (
                          <button
                            className="shopImgBtn glowBtn"
                            type="button"
                            disabled={busyId === ch.id}
                            onClick={() => doBuy(ch)}
                          >
                            <img src={BTN_PURCHASE} alt="Purchase" draggable="false" />
                          </button>
                        ) : (
                          <button
                            className="shopImgBtn glowBtn"
                            type="button"
                            disabled={busyId === ch.id || isEquipped}
                            onClick={() => doEquip(ch)}
                          >
                            <img src={BTN_EQUIP} alt="Equip" draggable="false" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="paperFooter">Characters save automatically.</div>
          </div>
=======
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
>>>>>>> origin/Shop-Addition
        </div>
      </div>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> origin/Shop-Addition
