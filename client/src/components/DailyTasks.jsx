import React, { useEffect, useMemo, useState } from "react";
import "./dailyTasks.css";
import { useAuth } from "../auth/AuthContext.jsx";
import { claimDailyTask, getDailyTaskPack } from "../game/dailyTasks.js";

const ARENAS = [
  "/assets/arenas/forest.png",
  "/assets/arenas/desert.png",
  "/assets/arenas/temple.png",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function DailyTasks({ onBackToMenu }) {
  const { username, profile, addCoins } = useAuth();
  const [bg, setBg] = useState(() => pick(ARENAS));
  const [taskPack, setTaskPack] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setBg(pick(ARENAS));
  }, []);

  const refresh = () => {
    if (!username) return;
    setTaskPack(getDailyTaskPack(username));
  };

  useEffect(() => {
    refresh();
  }, [username]);

  const claimedCoins = useMemo(() => {
    if (!taskPack?.tasks) return 0;
    return taskPack.tasks
      .filter((t) => t.claimed)
      .reduce((sum, t) => sum + Number(t.reward || 0), 0);
  }, [taskPack]);

  const handleClaim = async (task) => {
    if (!username) return;

    setMsg("");

    const result = claimDailyTask(username, task.instanceId);
    if (!result.ok) {
      setMsg("That task is not ready to claim yet.");
      refresh();
      return;
    }

    try {
      await addCoins(result.reward);
      setMsg(`Claimed ${result.reward} coins.`);
    } catch {
      setMsg("Task was claimed, but coin sync failed.");
    }

    refresh();
  };

  return (
    <div className="dailyRoot">
      <img className="dailyBg" src={bg} alt="" draggable="false" />
      <div className="dailyOverlay" />

      <div className="dailyStage">
        <button className="dailyBackBtn" onClick={onBackToMenu}>
          Main Menu
        </button>

        <div className="dailyTopBar">
          <div className="dailyTitleBlock">
            <div className="dailyTitle">Daily Tasks</div>
            <div className="dailySub">Fresh objectives every day with randomized goals.</div>
          </div>

          <div className="dailyCoinsBlock">
            <div className="dailyCoinsRow">
              <img className="dailyCoinIcon" src="/assets/ui/coin.png" alt="Coin" draggable="false" />
              <span>{Number(profile?.coins || 0)}</span>
            </div>
            <div className="dailyMetaLine">Claimed today: {claimedCoins}</div>
          </div>
        </div>

        {!username ? (
          <div className="dailyPanel">
            <div className="dailyEmptyTitle">Login required</div>
            <div className="dailyEmptySub">Sign in to generate daily tasks and claim coin rewards.</div>
          </div>
        ) : (
          <div className="dailyPanel">
            <div className="dailyPanelHead">
              <div>
                <div className="dailyPanelTitle">Today’s Board</div>
                <div className="dailyPanelSub">
                  Date: {taskPack?.date || "—"} · Completed: {taskPack?.completedCount || 0} / {taskPack?.tasks?.length || 0}
                </div>
              </div>

              {msg ? <div className="dailyMsg">{msg}</div> : <div className="dailyMsg muted"> </div>}
            </div>

            <div className="dailyTaskList">
              {(taskPack?.tasks || []).map((task) => {
                const progress = Math.min(task.progress, task.target);
                const pct =
                  task.target > 0
                    ? Math.max(0, Math.min(100, Math.round((progress / task.target) * 100)))
                    : 0;

                return (
                  <div className="dailyTaskCard" key={task.instanceId}>
                    <div className="dailyTaskLeft">
                      <div className="dailyTaskText">{task.text}</div>
                      <div className="dailyTaskMeta">
                        Progress: {progress} / {task.target}
                      </div>

                      <div className="dailyBar">
                        <div className="dailyBarFill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="dailyTaskRight">
                      <div className="dailyRewardRow">
                        <img className="dailyCoinTiny" src="/assets/ui/coin.png" alt="Coin" draggable="false" />
                        <span>{task.reward}</span>
                      </div>

                      {task.claimed ? (
                        <button className="dailyClaimBtn claimed" disabled>
                          Claimed
                        </button>
                      ) : (
                        <button
                          className="dailyClaimBtn"
                          disabled={!task.complete}
                          onClick={() => handleClaim(task)}
                        >
                          {task.complete ? "Claim" : "In Progress"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}