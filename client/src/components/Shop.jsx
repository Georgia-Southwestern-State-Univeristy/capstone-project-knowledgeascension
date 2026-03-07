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
        </div>
      </div>
    </div>
  );
}