import React, { useEffect, useMemo, useState } from "react";

export default function AnimatedCharacter({
  folderName,
  facing = "front",   // "front" | "back"
  action = "idle",    // "idle" | "attack"
  className = "",
  alt = "",
  draggable = false,
}) {
  const [fallbackMode, setFallbackMode] = useState("video"); // video | image

  const attackSrc = useMemo(
    () => `/assets/characters/${folderName}/${facing}_attack.webm`,
    [folderName, facing]
  );

  const idleSrc = useMemo(
    () => `/assets/characters/${folderName}/${facing}_idle.webm`,
    [folderName, facing]
  );

  const pngSrc = useMemo(
    () => `/assets/characters/${folderName}/${facing}.png`,
    [folderName, facing]
  );

  const videoSrc = useMemo(() => {
    if (action === "attack") return attackSrc;
    return idleSrc;
  }, [action, attackSrc, idleSrc]);

  useEffect(() => {
    setFallbackMode("video");
  }, [videoSrc]);

  if (fallbackMode === "image") {
    return (
      <img
        className={className}
        src={pngSrc}
        alt={alt}
        draggable={draggable}
      />
    );
  }

  return (
    <video
      key={`${folderName}-${facing}-${action}-${videoSrc}`}
      className={className}
      src={videoSrc}
      autoPlay
      loop={action !== "attack"}
      muted
      playsInline
      preload="auto"
      draggable={draggable}
      onError={() => {
        if (action === "attack" && videoSrc !== idleSrc) {
          const test = document.createElement("video");
          test.src = idleSrc;
          test.onloadeddata = () => setFallbackMode("video");
          test.onerror = () => setFallbackMode("image");
        } else {
          setFallbackMode("image");
        }
      }}
    />
  );
}