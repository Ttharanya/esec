import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
// Hardcode your Groq API key here to avoid using environment variables
// Replace the placeholder string with your real key
const HARDCODED_GROQ_KEY = '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';
const PORT = process.env.PORT || 5174;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Proxy to Groq or echo stub if no key
app.post('/api/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const groqKey = HARDCODED_GROQ_KEY || process.env.GROQ_API_KEY || '';
  // Try a list of supported models; first that works will be used
  const candidateModels = [
    'llama-3.3-70b-versatile',
    'llama-3.3-8b-instant',
    'mixtral-8x7b-32768',
    'llama-guard-3-8b',
    'whisper-large-v3-turbo' // in case user asks for audio/text; harmless to try last
  ];

  if (!groqKey) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders?.();
    const last = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
    const reply = `No key configured. Set HARDCODED_GROQ_KEY in server/index.js. You said: ${last}`;
    res.write(reply);
    return res.end();
  }

  let streamStarted = false;
  try {
    let response = null;
    let lastErrorText = '';
    for (const model of candidateModels) {
      const attempt = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ model, messages, stream: true, temperature: 0.2 })
      });
      if (attempt.ok && attempt.body) {
        response = attempt;
        break;
      } else {
        try {
          lastErrorText = await attempt.text();
        } catch {}
      }
    }

    if (!response) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.write(`All models failed. Last error: ${lastErrorText || 'Groq request failed'}`);
      return res.end();
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders?.();
    streamStarted = true;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Groq streams Server-Sent-Events; pull delta content lines
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content || '';
            if (delta) res.write(delta);
          } catch {}
        }
      }
      return res.end();
    } catch (streamErr) {
      if (streamStarted) {
        try { res.write(`\n[stream error] ${String(streamErr?.message || streamErr)}`); } catch {}
        return res.end();
      }
      throw streamErr;
    }
  } catch (e) {
    if (streamStarted) {
      try { res.write(`\n[error] ${String(e?.message || e)}`); } catch {}
      return res.end();
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(500).send(`Proxy error: ${String(e?.message || e)}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


