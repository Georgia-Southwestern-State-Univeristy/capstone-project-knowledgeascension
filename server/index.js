import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import uploadsRouter from "./routes/uploads.js";
import questionsRouter from "./routes/questions.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/uploads", uploadsRouter);
app.use("/api/questions", questionsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});