import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Simple background music manager.
 * Browsers require a user gesture to start audio.
 */
export function useBgm() {
  const tracks = useMemo(
    () => ({
      lobby: "/assets/audio/track_lobby.mp3",
      battle: "/assets/audio/track_battle.mp3",
      results: "/assets/audio/track_results.mp3"
    }),
    []
  );

  const audioRef = useRef(null);
  const [trackKey, setTrackKey] = useState("lobby");
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.6);

  // create audio element once
  useEffect(() => {
    const a = new Audio(tracks.lobby);
    a.loop = true;
    a.volume = volume;
    audioRef.current = a;

    return () => {
      a.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // change track source (does not auto-play unless already playing)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const wasPlaying = !a.paused;
    a.src = tracks[trackKey];
    a.load();
    if (enabled && wasPlaying) {
      a.play().catch(() => {});
    }
  }, [trackKey, tracks, enabled]);

  const play = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (!enabled) return;
    try {
      await a.play();
    } catch {
      // needs user gesture — handled by calling play() on click
    }
  };

  const pause = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
  };

  const toggle = async () => {
    if (!enabled) {
      setEnabled(true);
      setTimeout(() => play(), 0);
    } else {
      setEnabled(false);
      pause();
    }
  };

  return {
    trackKey,
    setTrackKey,
    enabled,
    toggle,
    volume,
    setVolume,
    play,
    pause
  };
}
