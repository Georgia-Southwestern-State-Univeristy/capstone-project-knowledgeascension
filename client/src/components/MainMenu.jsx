import React, { useEffect, useMemo, useRef, useState } from "react";
import "./menu.css";
import trackLobby from "../assets/audio/track_lobby.mp3";
import { useAuth } from "../auth/AuthContext.jsx";

export default function MainMenu({
  onStartEndless,
  onOpenShop,
  onOpenCoop,
  onOpen1v1,
  onOpenDailyTasks,
}) {
  const { loading, username, profile, signup, login, logout } = useAuth();
  const DESKTOP_STAGE = { width: 1920, height: 1080 };
  const TABLET_STAGE = { width: 1024, height: 1366 };
  const PHONE_STAGE = { width: 430, height: 932 };

  const [selected, setSelected] = useState("1V1");

  const [scale, setScale] = useState(1);
  const [layoutMode, setLayoutMode] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 620
      ? "phone"
      : typeof window !== "undefined" && window.innerWidth <= 1180
        ? "tablet"
        : "desktop"
  );

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const nextLayoutMode = width <= 620 ? "phone" : width <= 1180 ? "tablet" : "desktop";
      const stage =
        nextLayoutMode === "phone"
          ? PHONE_STAGE
          : nextLayoutMode === "tablet"
            ? TABLET_STAGE
            : DESKTOP_STAGE;
      const fitScale = Math.min(1, Math.min(width / stage.width, height / stage.height));

      setLayoutMode(nextLayoutMode);
      setScale(fitScale);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const stageStyle = useMemo(
    () => ({ transform: `translate(-50%, -50%) scale(${scale})` }),
    [scale]
  );

  const audioRef = useRef(null);
  const [musicOn, setMusicOn] = useState(false);
  const [volume, setVolume] = useState(0.6);

  useEffect(() => {
    const a = new Audio(trackLobby);
    a.loop = true;
    a.volume = volume;
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
    };
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

  useEffect(() => {
    const order = ["1V1", "COOP", "ENDLESS"];
    const onKey = (e) => {
      const k = (e.key || "").toLowerCase();

      if (k === "arrowdown" || k === "s") {
        setSelected((cur) => order[(order.indexOf(cur) + 1) % order.length]);
      }

      if (k === "arrowup" || k === "w") {
        setSelected((cur) => order[(order.indexOf(cur) - 1 + order.length) % order.length]);
      }

      if (k === "enter") {
        if (selected === "ENDLESS") onStartEndless?.();
        if (selected === "COOP") onOpenCoop?.();
        if (selected === "1V1") onOpen1v1?.();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, onStartEndless, onOpenCoop, onOpen1v1]);

  const Btn = ({ imgSrc, alt }) => (
    <div className="btnWrap">
      <div className="goldGlow" />
      <img src={imgSrc} alt={alt} draggable="false" />
    </div>
  );

  const [mode, setMode] = useState("login");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    try {
      if (mode === "signup") {
        await signup(u, p);
        setMsg("Account created");
      } else {
        await login(u, p);
        setMsg("Logged in");
      }
      setU("");
      setP("");
    } catch (e) {
      setMsg(e?.message || "Error");
    }
  };

  return (
    <div className="menuRoot">
      <video className="menuBg" src="/assets/menu/bg.mp4" autoPlay loop muted playsInline />

      <div
        className={`menuStage ${layoutMode === "phone" ? "phoneLayout" : ""} ${layoutMode === "tablet" ? "tabletLayout" : ""}`}
        style={stageStyle}
      >
          <div className="loginPanel">
            {loading ? (
              <div className="loginTitle">Loading</div>
            ) : username ? (
              <>
                <div className="loginTitle">Account</div>
                <div className="loginRow"><b>User:</b> {username}</div>
                <div className="loginRow"><b>Brains:</b> {profile?.coins ?? 0}</div>
                <div className="loginRow"><b>Equipped:</b> {profile?.equippedCharacter ?? "knight"}</div>
                <button className="loginBtn" onClick={logout}>Logout</button>
              </>
            ) : (
              <>
                <div className="loginTitle">{mode === "signup" ? "Create Account" : "Login"}</div>

                <input
                  className="loginInput"
                  placeholder="Username"
                  value={u}
                  onChange={(e) => setU(e.target.value)}
                />
                <input
                  className="loginInput"
                  placeholder="Password"
                  type="password"
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                />

                <button className="loginBtn" onClick={submit}>
                  {mode === "signup" ? "Sign Up" : "Login"}
                </button>

                <button
                  className="loginLink"
                  onClick={() => {
                    setMode(mode === "signup" ? "login" : "signup");
                    setMsg("");
                  }}
                >
                  {mode === "signup" ? "Have an account? Login" : "New? Create account"}
                </button>

                {msg && <div className="loginMsg">{msg}</div>}
              </>
            )}
          </div>

          <img
            className="menuTitle"
            src="/assets/menu/title.png"
            alt="Knowledge Ascension"
            draggable="false"
          />

          <button className="imgBtn shopBtn" onClick={() => onOpenShop?.()}>
            <Btn imgSrc="/assets/menu/btn_shop.png" alt="Shop" />
          </button>

          <button
            className="imgBtn dailyBtn"
            onClick={() => onOpenDailyTasks?.()}
          >
            <div className="btnWrap dailyBtnWrap">
              <div className="goldGlow" />
              <div className="dailyBtnPlate">Daily Tasks</div>
            </div>
          </button>

          <button
            className={`imgBtn modeBtn btn1 ${selected === "1V1" ? "selected" : ""}`}
            onMouseEnter={() => setSelected("1V1")}
            onClick={() => onOpen1v1?.()}
          >
            <Btn imgSrc="/assets/menu/btn_1v1.png" alt="1v1" />
          </button>

          <button
            className={`imgBtn modeBtn btn2 ${selected === "COOP" ? "selected" : ""}`}
            onMouseEnter={() => setSelected("COOP")}
            onClick={() => onOpenCoop?.()}
          >
            <Btn imgSrc="/assets/menu/btn_coop.png" alt="Co-op Boss" />
          </button>

          <button
            className={`imgBtn modeBtn btn3 ${selected === "ENDLESS" ? "selected" : ""}`}
            onMouseEnter={() => setSelected("ENDLESS")}
            onClick={() => onStartEndless?.()}
          >
            <Btn imgSrc="/assets/menu/btn_endless.png" alt="Endless" />
          </button>

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
