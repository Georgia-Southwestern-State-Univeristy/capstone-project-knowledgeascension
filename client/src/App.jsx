import React, { useState } from "react";
import MainMenu from "./components/MainMenu.jsx";
import EndlessMode from "./components/EndlessMode.jsx";
import Shop from "./components/Shop.jsx";
import CoopLobby from "./components/CoopLobby.jsx";
import CoopMode from "./components/CoopMode.jsx";

import OneVOneLobby from "./components/OneVOneLobby.jsx";
import OneVOneMode from "./components/OneVOneMode.jsx";

import DailyTasks from "./components/DailyTasks.jsx";

export default function App() {
  const [screen, setScreen] = useState("menu");
  const [coopRoom, setCoopRoom] = useState(null);
  const [v1Room, setV1Room] = useState(null);

  if (screen === "endless") {
    return <EndlessMode onBackToMenu={() => setScreen("menu")} />;
  }

  if (screen === "shop") {
    return <Shop onBackToMenu={() => setScreen("menu")} />;
  }

  if (screen === "daily_tasks") {
    return <DailyTasks onBackToMenu={() => setScreen("menu")} />;
  }

  if (screen === "coop_lobby") {
    return (
      <CoopLobby
        onBackToMenu={() => setScreen("menu")}
        onEnterGame={(roomInfo) => {
          setCoopRoom(roomInfo);
          setScreen("coop_game");
        }}
      />
    );
  }

  if (screen === "coop_game") {
    return (
      <CoopMode
        room={coopRoom}
        onBackToMenu={() => {
          setCoopRoom(null);
          setScreen("menu");
        }}
      />
    );
  }

  if (screen === "v1_lobby") {
    return (
      <OneVOneLobby
        onBackToMenu={() => setScreen("menu")}
        onEnterGame={(roomInfo) => {
          setV1Room(roomInfo);
          setScreen("v1_game");
        }}
      />
    );
  }

  if (screen === "v1_game") {
    return (
      <OneVOneMode
        room={v1Room}
        onBackToMenu={() => {
          setV1Room(null);
          setScreen("menu");
        }}
      />
    );
  }

  return (
    <MainMenu
      onStartEndless={() => setScreen("endless")}
      onOpenShop={() => setScreen("shop")}
      onOpenCoop={() => setScreen("coop_lobby")}
      onOpen1v1={() => setScreen("v1_lobby")}
      onOpenDailyTasks={() => setScreen("daily_tasks")}
    />
  );
}