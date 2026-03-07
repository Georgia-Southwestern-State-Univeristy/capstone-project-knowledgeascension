import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/random", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer
      FROM questions
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No questions found." });
    }

    const q = result.rows[0];

    res.json({
      id: q.id,
      text: q.question_text,
      a: q.option_a,
      b: q.option_b,
      c: q.option_c,
      d: q.option_d,
      correct: q.correct_answer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load question." });
  }
});

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer
      FROM questions
      ORDER BY created_at DESC
    `);

    res.json(
      result.rows.map((q) => ({
        id: q.id,
        text: q.question_text,
        a: q.option_a,
        b: q.option_b,
        c: q.option_c,
        d: q.option_d,
        correct: q.correct_answer,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load questions." });
  }
});

export default router;