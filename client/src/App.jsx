import React, { useState } from "react";
import MainMenu from "./components/MainMenu";
import EndlessMode from "./components/EndlessMode";

export default function App() {
  const [screen, setScreen] = useState("menu"); // "menu" | "endless"

  return (
    <>
      {screen === "menu" && (
        <MainMenu
          onStartEndless={() => setScreen("endless")}
        />
      )}

      {screen === "endless" && (
        <EndlessMode
          onBackToMenu={() => setScreen("menu")}
        />
      )}
    </>
  );
}
