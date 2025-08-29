import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 5174;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// OpenAI API setup
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ✅ Root health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await response.json();
    const reply = data.choices[0].message.content;

    res.json({ reply });
  } catch (error) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================
// ✅ Serve Frontend (without dist)
// ============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from root (index.html) and src/
app.use(express.static(path.join(__dirname, "../")));
app.use(express.static(path.join(__dirname, "../src")));

// Fallback route → always serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
