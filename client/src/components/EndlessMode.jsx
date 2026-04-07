import React, { useEffect, useMemo, useRef, useState } from "react";
import "./endless.css";
import {
  seedQuestionsIfNeeded,
  getRandomQuestion,
  setRunBank,
  clearRunBank,
  getRunBankSize,
} from "../db/questionsDb";
import { useAuth } from "../auth/AuthContext.jsx";
import { CHARACTERS, DEFAULT_CHARACTER_ID } from "../db/characters";
import { recordDailyStat } from "../game/dailyTasks.js";
import AnimatedCharacter from "./AnimatedCharacter.jsx";

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

  const HERO_DAMAGE = 25;
  const HERO_HP_MAX = 100;

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const W = 1920;
    const H = 1080;
    const update = () => setScale(Math.min(1, Math.min(window.innerWidth / W, window.innerHeight / H)));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const stageStyle = useMemo(
    () => ({ transform: `translate(-50%, -50%) scale(${scale})` }),
    [scale]
  );

  const equippedId = safeLower(profile?.equippedCharacter || DEFAULT_CHARACTER_ID);
  const equippedChar = CHARACTERS.find((c) => safeLower(c.id) === equippedId) || CHARACTERS[0];
  const heroFolder = equippedChar.folderName;
  const equippedLabel = equippedChar.id;

  const makeEnemy = () => {
    const e = pick(ENEMIES);
    const hp = randInt(10, 100);
    return { ...e, maxHp: hp, hp };
  };

  const [arena, setArena] = useState(() => pick(ARENAS));
  const [playerHp, setPlayerHp] = useState(HERO_HP_MAX);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [kills, setKills] = useState(0);
  const [dead, setDead] = useState(false);
  const [enemy, setEnemy] = useState(() => makeEnemy());
  const [question, setQuestion] = useState(null);

  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);

  const [heroAction, setHeroAction] = useState("idle");
  const [heroQuake, setHeroQuake] = useState(false);
  const [enemyQuake, setEnemyQuake] = useState(false);

  const heroAttackTimerRef = useRef(null);
  const heroQuakeTimerRef = useRef(null);
  const enemyQuakeTimerRef = useRef(null);

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

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [progress, setProgress] = useState({ pct: 0, label: "" });
  const fakeProgRef = useRef(null);
  const [bankReady, setBankReady] = useState(false);

  const triggerHeroAttack = () => {
    if (heroAttackTimerRef.current) clearTimeout(heroAttackTimerRef.current);
    setHeroAction("attack");
    heroAttackTimerRef.current = setTimeout(() => {
      setHeroAction("idle");
    }, 420);
  };

  const triggerHeroQuake = () => {
    if (heroQuakeTimerRef.current) clearTimeout(heroQuakeTimerRef.current);
    setHeroQuake(true);
    heroQuakeTimerRef.current = setTimeout(() => {
      setHeroQuake(false);
    }, 220);
  };

  const triggerEnemyQuake = () => {
    if (enemyQuakeTimerRef.current) clearTimeout(enemyQuakeTimerRef.current);
    setEnemyQuake(true);
    enemyQuakeTimerRef.current = setTimeout(() => {
      setEnemyQuake(false);
    }, 220);
  };

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
      if (heroAttackTimerRef.current) clearTimeout(heroAttackTimerRef.current);
      if (heroQuakeTimerRef.current) clearTimeout(heroQuakeTimerRef.current);
      if (enemyQuakeTimerRef.current) clearTimeout(enemyQuakeTimerRef.current);
      if (fakeProgRef.current) clearInterval(fakeProgRef.current);
      audioRef.current = null;
      clearRunBank();
    };
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

  useEffect(() => {
    (async () => {
      await seedQuestionsIfNeeded();
      const size = getRunBankSize();
      setBankReady(size > 0);
      if (size > 0) {
        setQuestion(await getRandomQuestion());
      } else {
        setQuestion(null);
      }
    })();
  }, []);

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
    } catch {
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

  const startFakeProgress = () => {
    if (fakeProgRef.current) clearInterval(fakeProgRef.current);
    fakeProgRef.current = window.setInterval(() => {
      setProgress((cur) => ({
        pct: Math.min(95, cur.pct + Math.max(1, (95 - cur.pct) * 0.08)),
        label: cur.label || "Generating.",
      }));
    }, 280);
  };

  const stopFakeProgress = () => {
    if (fakeProgRef.current) window.clearInterval(fakeProgRef.current);
    fakeProgRef.current = null;
  };

  const uploadStudyFile = async (file) => {
    setUploadErr("");
    setUploading(true);
    startFakeProgress();

    try {
      setProgress({ pct: 12, label: "Uploading." });

      const form = new FormData();
      form.append("file", file);

      const host = window.location.hostname;
      const res = await fetch(`http://${host}:5175/api/endless/upload`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.error || "Upload failed."));
      }

      const qs = Array.isArray(data?.questions) ? data.questions : [];
      if (!qs.length) throw new Error("No questions returned.");

      stopFakeProgress();
      setProgress({ pct: 100, label: "Done" });

      clearRunBank();
      setRunBank(qs);
      setBankReady(true);
      setQuestion(qs[0] || null);

      setUploading(false);

      if (username) {
        recordDailyStat(username, "endlessRuns", 1);
      }
    } catch (e) {
      stopFakeProgress();
      setUploading(false);
      setProgress({ pct: 0, label: "" });
      setUploadErr(e?.message || "Upload failed.");
    }
  };

  const resetRun = async () => {
    lockedRef.current = false;
    setLocked(false);
    setDead(false);
    setPlayerHp(HERO_HP_MAX);
    setCoinsEarned(0);
    setKills(0);
    setArena(pick(ARENAS));
    setEnemy(makeEnemy());
    setQuestion(await getRandomQuestion());
    setHeroAction("idle");
    setHeroQuake(false);
    setEnemyQuake(false);
    prevCoinsRef.current = 0;
    setCoinDrops([]);
    setCoinPop(null);
    stopMusicHard();

    if (username) {
      recordDailyStat(username, "endlessRuns", 1);
    }
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
      triggerHeroAttack();
      triggerEnemyQuake();

      if (username) {
        recordDailyStat(username, "correctAnswers", 1);
      }

      const nextEnemyHp = Math.max(0, curEnemy.hp - HERO_DAMAGE);
      setEnemy({ ...curEnemy, hp: nextEnemyHp });

      setTimeout(async () => {
        if (nextEnemyHp <= 0) {
          setKills((k) => k + 1);

          if (username) {
            recordDailyStat(username, "enemyKills", 1);
          }

          const drop = rollCoinDrop();
          if (drop > 0) {
            setCoinsEarned((c) => c + drop);
            spawnCoinDrop(drop);

            if (username) {
              recordDailyStat(username, "coinsEarned", drop);
            }
          }

          setEnemy(makeEnemy());
        }

        await nextQuestion();
        lockedRef.current = false;
        setLocked(false);
      }, 140);

      return;
    }

    triggerHeroQuake();

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

  const needsUpload = !bankReady && !dead;

  const heroPct = Math.max(0, Math.min(1, playerHp / Math.max(1, HERO_HP_MAX)));
  const enemyPct = enemy.maxHp ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : 1;

  if (needsUpload) {
    return (
      <div className="endRoot">
        <div className="endStage" style={stageStyle}>
          <img className="arenaBg" src={arena} alt="" draggable="false" />

          <div className="endUploadCard">
            <div className="endUploadTitle">Upload Study File</div>
            <div className="endUploadSub">PDF / DOCX / PPTX • Generates 100 questions for this run.</div>

            <label className="endUploadBtn">
              <input
                type="file"
                accept=".pdf,.docx,.pptx"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadStudyFile(f);
                  e.target.value = "";
                }}
              />
              {uploading ? "Generating." : "Choose File"}
            </label>

            {uploading && (
              <div className="endProgWrap">
                <div className="endProgLabel">{progress.label} ({Math.floor(progress.pct)}%)</div>
                <div className="endProgTrack">
                  <div className="endProgFill" style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%` }} />
                </div>
              </div>
            )}

            {uploadErr && <div className="endUploadErr">{uploadErr}</div>}

            <button className="endBackBtn" onClick={onBackToMenu} type="button">
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="endHud">
          <div className="endHudRow">
            <img className="endHudCoinIcon" src={COIN_PNG} alt="" draggable="false" />
            <span className="endHudCoinsNum">{coinsEarned}</span>
          </div>
          <div>Kills: {kills}</div>

          {coinPop && (
            <div className="endCoinPop" style={{ left: 145, top: 8 }}>
              +{coinPop.amount}
            </div>
          )}
        </div>

        <div className="endMusicDock">
          <button type="button" className="endMusicBtn" onClick={toggleMusic}>
            {musicPlaying ? "Pause" : "Play"}
          </button>

          <label className="endMusicLabel">
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

        <button className="endMenuBtn" onClick={onBackToMenu}>Menu</button>

        {coinDrops.map((c) => (
          <img
            key={c.id}
            className="endCoinDrop"
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

        <AnimatedCharacter
          folderName={heroFolder}
          facing="back"
          action={heroAction}
          className={heroQuake ? "endHeroSprite quake" : "endHeroSprite"}
          alt="Hero"
          draggable={false}
        />

        <img
          className={enemyQuake ? "endEnemySprite quake" : "endEnemySprite"}
          src={enemy.src}
          alt={enemy.name}
          draggable="false"
        />

        <div className="endEnemyBar">
          <img className="endBarFrame" src={UI.ENEMY_BAR} alt="" draggable="false" />
          <div className="endEnemyBarName">{enemy.name}</div>
          <div className="endEnemyBarFill" style={{ transform: `scaleX(${enemyPct})` }} />
        </div>

        <div className="endHeroBar">
          <img className="endBarFrame" src={UI.HERO_BAR} alt="" draggable="false" />
          <div className="endHeroBarName">{equippedLabel}</div>
          <div className="endHeroBarFill" style={{ transform: `scaleX(${heroPct})` }} />
        </div>

        <div className="endQuestionWrap">
          <img className="endQuestionFrame" src={UI.QUESTION_BOX} alt="" draggable="false" />
          <div className="endQuestionText">{question ? question.text : "Loading..."}</div>

          <button type="button" className="endAnswer endAnswer1" disabled={locked} onPointerDown={handlePick("a")}>
            <span>{question?.a ?? ""}</span>
          </button>
          <button type="button" className="endAnswer endAnswer2" disabled={locked} onPointerDown={handlePick("b")}>
            <span>{question?.b ?? ""}</span>
          </button>
          <button type="button" className="endAnswer endAnswer3" disabled={locked} onPointerDown={handlePick("c")}>
            <span>{question?.c ?? ""}</span>
          </button>
          <button type="button" className="endAnswer endAnswer4" disabled={locked} onPointerDown={handlePick("d")}>
            <span>{question?.d ?? ""}</span>
          </button>
        </div>
      </div>
    </div>
  );
}