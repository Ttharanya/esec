ESEC Chatbot (Groq-ready)

Minimal ChatGPT-like UI with black/white theme, navbar, chat sessions, and a Node proxy streaming from Groq.

Features
- Navbar, sidebar sessions, chat pane
- Black/white sleek theme
- Local sessions via localStorage
- Streaming via /api/chat
- Vite frontend, Express proxy

Setup
1) Install deps: npm install
2) Run dev: npm run dev
   - Frontend: http://localhost:5173
   - API: http://localhost:5174

Key handling
- The API key is hardcoded on the server. Edit `server/index.js` and set `HARDCODED_GROQ_KEY`.
- The client only sends the selected model via `x-groq-model`.

Build
- npm run build
- npm run preview

Notes
- Client reads text chunks from the proxy.
- Proxy adapts Groq SSE to plain text streaming.
- Model is selected automatically on the server from supported Groq chat models.
- Voice input: Click the mic. Uses Web Speech API (Chrome/Edge). Auto-sends when you stop speaking.


