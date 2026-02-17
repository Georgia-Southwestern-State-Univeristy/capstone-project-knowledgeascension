import React, { useEffect, useMemo, useRef, useState } from "react";
import "./endless.css";
import { seedQuestionsIfNeeded, getRandomQuestion } from "../db/questionsDb";
import { useAuth } from "../auth/AuthContext.jsx";
import { CHARACTERS, DEFAULT_CHARACTER_ID } from "../db/characters";

const UI = {
  ENEMY_BAR: "/assets/ui/enemy_bar.png",
  HERO_BAR: "/assets/ui/hero_bar.png",
  QUESTION_BOX: "/assets/ui/question_box.png",
  YOU_DIED: "/assets/ui/you_died.png",
};

const ARENAS = [
  "/assets/arenas/forest.png",
  "/assets/arenas/desert.png",
  "/assets/arenas/temple.png",
];

const ENEMIES = [
  { name: "Clam", src: "/assets/enemies/clam.png" },
  { name: "Fire Sprite", src: "/assets/enemies/fire.png" },
  { name: "Crystal Monster", src: "/assets/enemies/crystal.png" },
  { name: "Slime", src: "/assets/enemies/slime.png" },
  { name: "Skeleton", src: "/assets/enemies/skeleton.png" },
  { name: "Cave Skeleton", src: "/assets/enemies/cave_skeleton.png" },
];

const COIN_PNG = "/assets/ui/coin.png";

import battleTrack from "../assets/audio/track_battle.mp3";
import coinDropSfx from "../assets/audio/coin_drop.mp3";

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeKey(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (["a", "b", "c", "d"].includes(s)) return s;
  if (["1", "2", "3", "4"].includes(s)) return ["a", "b", "c", "d"][Number(s) - 1];
  if (["0", "1", "2", "3"].includes(s)) return ["a", "b", "c", "d"][Number(s)];
  return null;
}

function safeLower(v) {
  return String(v || "").trim().toLowerCase();
}

export default function EndlessMode({ onBackToMenu }) {
  const { username, profile, addCoins } = useAuth();

  // Manual: increase for faster kills
  const HERO_DAMAGE = 25;

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const W = 1920, H = 1080;
    const update = () => setScale(Math.min(1, Math.min(window.innerWidth / W, window.innerHeight / H)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const stageStyle = useMemo(
    () => ({ transform: `translate(-50%, -50%) scale(${scale})` }),
    [scale]
  );

  // FIX: map equipped id -> folderName (TitleCase folders)
  const equippedId = safeLower(profile?.equippedCharacter || DEFAULT_CHARACTER_ID);
  const equippedChar = CHARACTERS.find((c) => safeLower(c.id) === equippedId) || CHARACTERS[0];
  const heroBack = `/assets/characters/${equippedChar.folderName}/back.png`;
  const equippedLabel = equippedChar.id;

  const makeEnemy = () => {
    const e = pick(ENEMIES);
    const hp = randInt(10, 100);
    return { ...e, maxHp: hp, hp };
  };

  const [arena, setArena] = useState(() => pick(ARENAS));
  const [playerHp, setPlayerHp] = useState(100);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [kills, setKills] = useState(0);
  const [dead, setDead] = useState(false);
  const [enemy, setEnemy] = useState(() => makeEnemy());
  const [question, setQuestion] = useState(null);

  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);

  const playerHpRef = useRef(playerHp);
  const enemyRef = useRef(enemy);
  const questionRef = useRef(question);

  useEffect(() => { playerHpRef.current = playerHp; }, [playerHp]);
  useEffect(() => { enemyRef.current = enemy; }, [enemy]);
  useEffect(() => { questionRef.current = question; }, [question]);

  const [coinDrops, setCoinDrops] = useState([]);
  const [coinPop, setCoinPop] = useState(null);
  const coinIdRef = useRef(1);

  const audioRef = useRef(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.6);

  useEffect(() => {
    const audio = new Audio(battleTrack);
    audio.loop = true;
    audio.volume = musicVolume;
    audioRef.current = audio;

    return () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = musicVolume;
  }, [musicVolume]);

  useEffect(() => {
    if (!dead) return;
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setMusicPlaying(false);
  }, [dead]);

  const toggleMusic = async () => {
    const a = audioRef.current;
    if (!a) return;

    if (musicPlaying) {
      a.pause();
      setMusicPlaying(false);
      return;
    }

    try {
      await a.play();
      setMusicPlaying(true);
    } catch (err) {
      console.warn("Music play blocked:", err);
      setMusicPlaying(false);
    }
  };

  const stopMusicHard = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setMusicPlaying(false);
  };

  const sfxCooldownRef = useRef(0);
  const playCoinSfx = () => {
    const now = Date.now();
    if (now - sfxCooldownRef.current < 60) return;
    sfxCooldownRef.current = now;

    try {
      const sfx = new Audio(coinDropSfx);
      sfx.volume = Math.min(1, Math.max(0, musicVolume * 0.9));
      sfx.play().catch(() => {});
    } catch {}
  };

  useEffect(() => {
    (async () => {
      await seedQuestionsIfNeeded();
      setQuestion(await getRandomQuestion());
    })();
  }, []);

  const nextQuestion = async () => setQuestion(await getRandomQuestion());

  const rollCoinDrop = () => (Math.random() < 0.35 ? randInt(1, 7) : 0);

  const prevCoinsRef = useRef(0);
  useEffect(() => {
    const prev = prevCoinsRef.current;
    if (coinsEarned > prev && username) {
      const delta = coinsEarned - prev;
      addCoins(delta).catch(() => {});
    }
    prevCoinsRef.current = coinsEarned;
  }, [coinsEarned, username, addCoins]);

  const spawnCoinDrop = (amount) => {
    playCoinSfx();

    const id = coinIdRef.current++;
    const startX = 1180;
    const startY = 360;

    const driftX = `${randInt(-980, -760)}px`;
    const spin = `${randInt(520, 980)}deg`;
    const groundY = `${randInt(820, 900)}px`;

    setCoinDrops((d) => [...d, { id, x: startX, y: startY, driftX, spin, groundY }]);

    setTimeout(() => {
      setCoinDrops((d) => d.filter((c) => c.id !== id));
    }, 2600);

    setCoinPop({ id: `pop-${id}`, amount });
    setTimeout(() => setCoinPop(null), 1100);
  };

  const resetRun = async () => {
    lockedRef.current = false;
    setLocked(false);
    setDead(false);
    setPlayerHp(100);
    setCoinsEarned(0);
    setKills(0);
    setArena(pick(ARENAS));
    setEnemy(makeEnemy());
    setQuestion(await getRandomQuestion());
    prevCoinsRef.current = 0;
    setCoinDrops([]);
    setCoinPop(null);

    stopMusicHard();
  };

  const resolveOnce = async (pickedKey) => {
    if (dead) return;
    if (lockedRef.current) return;

    lockedRef.current = true;
    setLocked(true);

    const q = questionRef.current;
    if (!q) {
      lockedRef.current = false;
      setLocked(false);
      return;
    }

    const picked = normalizeKey(pickedKey);
    const correct = normalizeKey(q.correct);

    if (!picked || !correct) {
      await nextQuestion();
      lockedRef.current = false;
      setLocked(false);
      return;
    }

    const curHP = playerHpRef.current;
    const curEnemy = enemyRef.current;

    if (picked === correct) {
      const nextEnemyHp = Math.max(0, curEnemy.hp - HERO_DAMAGE);
      setEnemy({ ...curEnemy, hp: nextEnemyHp });

      setTimeout(async () => {
        if (nextEnemyHp <= 0) {
          setKills((k) => k + 1);
          const drop = rollCoinDrop();
          if (drop > 0) {
            setCoinsEarned((c) => c + drop);
            spawnCoinDrop(drop);
          }
          setEnemy(makeEnemy());
        }
        await nextQuestion();
        lockedRef.current = false;
        setLocked(false);
      }, 140);

      return;
    }

    const nextHP = Math.max(0, curHP - 10);
    setPlayerHp(nextHP);

    setTimeout(async () => {
      if (nextHP <= 0) {
        setDead(true);
        lockedRef.current = false;
        setLocked(false);
        return;
      }
      await nextQuestion();
      lockedRef.current = false;
      setLocked(false);
    }, 140);
  };

  const handlePick = (key) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    resolveOnce(key);
  };

  const heroPct = Math.max(0, Math.min(1, playerHp / 100));
  const enemyPct = enemy.maxHp ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 1;

  if (dead) {
    return (
      <div className="endRoot">
        <div className="endStage" style={stageStyle}>
          <img className="arenaBg" src={arena} alt="" draggable="false" />

          <div className="deathOverlay">
            <img className="youDied" src={UI.YOU_DIED} alt="You Died" draggable="false" />

            <div className="deathStats">
              <div><b>Enemies Killed:</b> {kills}</div>
              <div><b>Coins Earned This Run:</b> {coinsEarned}</div>
              <div><b>Saved To Account:</b> {username ? "Yes" : "No (not logged in)"}</div>
            </div>

            <div className="deathButtons">
              <button onClick={resetRun}>Play Again</button>
              <button onClick={onBackToMenu}>Menu</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="endRoot">
      <div className="endStage" style={stageStyle}>
        <img className="arenaBg" src={arena} alt="" draggable="false" />

        <div className="hud">
          <div className="hudRow">
            <img className="hudCoinIcon" src={COIN_PNG} alt="" draggable="false" />
            <span className="hudCoinsNum">{coinsEarned}</span>
          </div>
          <div>Kills: {kills}</div>

          {coinPop && (
            <div className="coinPop" style={{ left: 145, top: 8 }}>
              +{coinPop.amount}
            </div>
          )}
        </div>

        <div className="musicDock">
          <button type="button" className="musicBtn" onClick={toggleMusic}>
            {musicPlaying ? "Pause" : "Play"}
          </button>

          <label className="musicLabel">
            Vol
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
            />
          </label>
        </div>

        <button className="menuBtn" onClick={onBackToMenu}>Menu</button>

        {coinDrops.map((c) => (
          <img
            key={c.id}
            className="coinDrop"
            src={COIN_PNG}
            alt=""
            draggable="false"
            style={{
              left: c.x,
              top: c.y,
              ["--driftX"]: c.driftX,
              ["--spin"]: c.spin,
              ["--groundY"]: c.groundY,
            }}
          />
        ))}

        <img className="heroSprite" src={heroBack} alt="Hero" draggable="false" />
        <img className="enemySprite" src={enemy.src} alt={enemy.name} draggable="false" />

        <div className="bar enemyBar">
          <img className="barFrame" src={UI.ENEMY_BAR} alt="" draggable="false" />
          <div className="barName">{enemy.name}</div>
          <div className="barFill" style={{ transform: `scaleX(${enemyPct})` }} />
        </div>

        <div className="bar heroBar">
          <img className="barFrame" src={UI.HERO_BAR} alt="" draggable="false" />
          <div className="barName">{equippedLabel}</div>
          <div className="barFill" style={{ transform: `scaleX(${heroPct})` }} />
        </div>

        <div className="qWrap">
          <img className="qFrame" src={UI.QUESTION_BOX} alt="" draggable="false" />
          <div className="qText">{question ? question.text : "Loading..."}</div>

          <button type="button" className="ans a1" disabled={locked} onPointerDown={handlePick("a")}>
            <span>{question?.a ?? ""}</span>
          </button>
          <button type="button" className="ans a2" disabled={locked} onPointerDown={handlePick("b")}>
            <span>{question?.b ?? ""}</span>
          </button>
          <button type="button" className="ans a3" disabled={locked} onPointerDown={handlePick("c")}>
            <span>{question?.c ?? ""}</span>
          </button>
          <button type="button" className="ans a4" disabled={locked} onPointerDown={handlePick("d")}>
            <span>{question?.d ?? ""}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
