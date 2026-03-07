import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import { pool } from "../db.js";
import { generateQuestionsFromText } from "../services/questionGenerator.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const data = await pdfParse(req.file.buffer);
    const extractedText = (data.text || "").trim();

    if (!extractedText) {
      return res.status(400).json({ error: "Could not extract text from PDF." });
    }

    const title = req.body.title || req.file.originalname;

    const docResult = await pool.query(
      `
      INSERT INTO documents (title, original_filename, extracted_text)
      VALUES ($1, $2, $3)
      RETURNING id, title
      `,
      [title, req.file.originalname, extractedText]
    );

    const document = docResult.rows[0];

    const generatedQuestions = await generateQuestionsFromText(extractedText);

    for (const q of generatedQuestions) {
      await pool.query(
        `
        INSERT INTO questions
        (document_id, question_text, option_a, option_b, option_c, option_d, correct_answer)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          document.id,
          q.question_text,
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
          q.correct_answer,
        ]
      );
    }

    res.status(201).json({
      message: "Document uploaded and questions generated.",
      document,
      questionsCreated: generatedQuestions.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to upload and process document." });
  }
});

export default router;