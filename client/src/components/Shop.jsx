import React, { useEffect, useMemo, useState } from "react";
import "./shop.css";
import { useAuth } from "../auth/AuthContext.jsx";
import { CHARACTERS, DEFAULT_CHARACTER_ID } from "../db/characters";

/*
  MANUAL: Edit prices here.
  - id MUST match the CHARACTERS ids (lowercase).
*/
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

// Buttons from: client/public/assets/ui/
const BTN_MENU = "/assets/ui/btn_menu.png";
const BTN_PURCHASE = "/assets/ui/btn_purchase.png";
const BTN_EQUIP = "/assets/ui/btn_equip.png";

// Same arena list style as Endless: random each time you enter Shop
const ARENAS = [
  "/assets/arenas/forest.png",
  "/assets/arenas/desert.png",
  "/assets/arenas/temple.png",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function Shop({ onBackToMenu }) {
  const { username, profile, purchaseCharacter, equipCharacter } = useAuth();

  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");

  // Random background each time Shop mounts (entering Shop)
  const [arenaBg, setArenaBg] = useState(() => pick(ARENAS));
  useEffect(() => {
    setArenaBg(pick(ARENAS));
  }, []);

  const owned = useMemo(() => new Set(profile?.ownedCharacters || []), [profile]);
  const equipped = String(profile?.equippedCharacter || DEFAULT_CHARACTER_ID).toLowerCase();
  const coins = Number(profile?.coins || 0);

  const doBuy = async (ch) => {
    if (!username) {
      setMsg("You must be logged in to purchase characters.");
      return;
    }
    setMsg("");
    setBusyId(ch.id);
    try {
      const price = PRICES[ch.id] ?? 0;
      const ok = await purchaseCharacter(ch.id, price);
      if (!ok) setMsg("Not enough coins.");
      else setMsg(`Purchased ${ch.displayName}.`);
    } catch (e) {
      setMsg(e?.message || "Purchase failed.");
    } finally {
      setBusyId("");
    }
  };

  const doEquip = async (ch) => {
    if (!username) {
      setMsg("You must be logged in to equip characters.");
      return;
    }
    setMsg("");
    setBusyId(ch.id);
    try {
      await equipCharacter(ch.id);
      setMsg(`${ch.displayName} equipped.`);
    } catch (e) {
      setMsg(e?.message || "Equip failed.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="shopRoot">
      {/* Background arena image (random per entry) */}
      <img className="shopBg" src={arenaBg} alt="" draggable="false" />
      <div className="shopBgShade" />

      <div className="shopStage">
        {/* MENU button (top-left) */}
        <button className="shopBackBtn" onClick={onBackToMenu} type="button">
          <img className="shopBtnImg" src={BTN_MENU} alt="Menu" draggable="false" />
        </button>

        {/* Shop icon placeholder (top-middle) */}
        <div className="shopTitleIcon">
          <div className="shopIconPlaceholder">SHOP ICON</div>
        </div>

        {/* Coins display (top-right) */}
        <div className="shopCoins">
          <div className="shopCoinsRow">
            <img className="shopCoinIcon" src={COIN_ICON} alt="Coin" draggable="false" />
            <span className="shopCoinsValue">{coins}</span>
          </div>
          <div className="shopAccountHint">
            {username ? `Logged in as: ${username}` : "Not logged in"}
          </div>
        </div>

        {/* Scroll/Paper container (content is clipped INSIDE, no overflow outside) */}
        <div className="shopPaper">
          {/* MANUAL: Replace this placeholder with your scroll PNG image later
              - Put your scroll image at: client/public/assets/ui/shop_scroll.png (example)
              - Then change the src below to that path. */}
          <div className="shopPaperFrame">
            {/* <img className="shopPaperImg" src="/assets/ui/shop_scroll.png" alt="" draggable="false" /> */}
          </div>

          {/* Everything below is forced to stay inside the scroll area */}
          <div className="shopPaperContent">
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

                return (
                  <div className="shopRow" key={ch.id}>
                    <div className="shopCharPreview">
                      <img src={imgSrc} alt={ch.displayName} draggable="false" />
                    </div>

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

                      <div className="shopActions">
                        {!isOwned ? (
                          <button
                            className="shopActionBtn"
                            disabled={busyId === ch.id}
                            onClick={() => doBuy(ch)}
                            type="button"
                          >
                            <img className="shopBtnImg" src={BTN_PURCHASE} alt="Purchase" draggable="false" />
                          </button>
                        ) : (
                          <button
                            className="shopActionBtn"
                            disabled={busyId === ch.id || isEquipped}
                            onClick={() => doEquip(ch)}
                            type="button"
                          >
                            <img className="shopBtnImg" src={BTN_EQUIP} alt="Equip" draggable="false" />
                          </button>
                        )}
                      </div>

                      <div className="manualNote">
                        
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="paperFooter">
              Add more characters by adding entries to <b>CHARACTERS</b> in <b>db/characters.js</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
