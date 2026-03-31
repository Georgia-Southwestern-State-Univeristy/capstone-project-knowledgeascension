import express from "express";
import { pool } from "../db.js";
import { getCachedQuestions, setCachedQuestions } from "../services/questionCache.js";

const router = express.Router();

router.get("/room/:roomCode/questions", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const cacheKey = `room_questions_${roomCode}`;

    const cached = getCachedQuestions(cacheKey);
    if (cached) {
      return res.json({ source: "cache", questions: cached });
    }

    const result = await pool.query(`
      SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer
      FROM questions
      ORDER BY RANDOM()
      LIMIT 20
    `);

    setCachedQuestions(cacheKey, result.rows);

    return res.json({ source: "database", questions: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load room questions." });
  }
});

export default router;