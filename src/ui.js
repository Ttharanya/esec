const STORAGE_KEY = 'esec.chat.sessions.v1';

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function createId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getFirstLine(text) {
  const line = text.trim().split('\n')[0] || 'New chat';
  return line.slice(0, 40);
}

export function createChatUI(root) {
  const state = {
    sessions: loadSessions(),
    activeId: null,
    sending: false
  };

  // Ensure at least one session exists
  if (!Object.keys(state.sessions).length) {
    const id = createId();
    state.sessions[id] = { id, title: 'New chat', messages: [] };
    state.activeId = id;
    saveSessions(state.sessions);
  } else {
    state.activeId = Object.keys(state.sessions)[0];
  }

  function setActive(id) {
    state.activeId = id;
    render();
    scrollToBottom();
  }

  function newChat() {
    const id = createId();
    state.sessions[id] = { id, title: 'New chat', messages: [] };
    saveSessions(state.sessions);
    setActive(id);
  }

  function deleteChat(id) {
    delete state.sessions[id];
    if (state.activeId === id) {
      const first = Object.keys(state.sessions)[0];
      if (first) state.activeId = first; else newChat();
    }
    saveSessions(state.sessions);
    render();
  }

  function currentSession() {
    return state.sessions[state.activeId];
  }

  function scrollToBottom() {
    const box = root.querySelector('.messages');
    if (box) box.scrollTop = box.scrollHeight;
  }

  async function sendMessage(text) {
    const session = currentSession();
    if (!text.trim() || state.sending) return;
    state.sending = true;
    session.messages.push({ role: 'user', content: text });
    if (session.title === 'New chat') session.title = getFirstLine(text);
    saveSessions(state.sessions);
    render();
    scrollToBottom();

    const controller = new AbortController();
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: session.id, messages: session.messages }),
      signal: controller.signal
    });

    if (!res.ok && !res.body) {
      const text = await res.text().catch(() => 'Request failed');
      session.messages.push({ role: 'assistant', content: `Error: ${text}` });
      state.sending = false;
      saveSessions(state.sessions);
      render();
      scrollToBottom();
      return;
    }

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let assistantIndex = session.messages.push({ role: 'assistant', content: '' }) - 1;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      session.messages[assistantIndex].content += chunk;
      saveSessions(state.sessions);
      render();
      scrollToBottom();
    }

    state.sending = false;
    saveSessions(state.sessions);
    render();
    scrollToBottom();
  }

  function renderMessage(msg) {
    const who = msg.role === 'assistant' ? 'role-assistant' : 'role-user';
    return `
      <div class="bubble ${who}">
        <div class="avatar">${msg.role === 'assistant' ? 'AI' : 'You'}</div>
        <div class="bubble-body">${escapeHtml(msg.content).replace(/\n/g, '<br/>')}</div>
      </div>
    `;
  }

  function render() {
    const session = currentSession();
    const sessionsList = Object.values(state.sessions).map(s => `
      <div class="session-item ${s.id === state.activeId ? 'active' : ''}" data-id="${s.id}">
        <div class="session-title">${escapeHtml(s.title)}</div>
        <button class="btn btn-small" data-del="${s.id}">✕</button>
      </div>
    `).join('');

    root.innerHTML = `
      <div class="layout">
        <div class="navbar">
          <div class="brand">
            <img class="brand-logo" src="/logo/clg_logo.png" alt="College Logo" />
            <div class="brand-title">ERODE SENGUNTHAR ENGINEERING COLLEGE (Autonomous)</div>
          </div>
          <div class="nav-right-title">DEPARTMENT OF ARTIFICAL INTELLIGENCE AND DATA SCIENCE</div>
          <div class="actions">
            <button class="btn" id="new-chat">New chat</button>
          </div>
        </div>
        <div class="content">
          <aside class="sidebar">
            <div class="session-header">Chats</div>
            <div class="session-list">${sessionsList}</div>
          </aside>
          <main class="chat">
            <div class="messages">
              ${session.messages.length ? session.messages.map(renderMessage).join('') : `<div class="empty-state">Ask me anything...</div>`}
            </div>
            <div class="composer">
              <div class="composer-inner">
                <textarea class="input" id="prompt" placeholder="Message..." rows="1"></textarea>
                <div class="send">
                  <button class="btn" id="mic" title="Voice input">🎤</button>
                  <button class="btn" id="toggle-sidebar" title="Show chats">☰</button>
                  <button class="btn" id="send">Send</button>
                </div>
              </div>
              
            </div>
          </main>
        </div>
        <div class="backdrop" id="backdrop"></div>
        <div class="footer">Built with ♥ for Groq APIs</div>
      </div>
    `;

    // events
    root.querySelector('#new-chat').onclick = () => newChat();
    root.querySelectorAll('.session-item').forEach(el => {
      el.onclick = (e) => {
        const id = el.getAttribute('data-id');
        setActive(id);
      };
    });
    root.querySelectorAll('[data-del]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        deleteChat(el.getAttribute('data-del'));
      };
    });
    const textarea = root.querySelector('#prompt');
    const sendBtn = root.querySelector('#send');
    const micBtn = root.querySelector('#mic');
    const toggleSidebarBtn = root.querySelector('#toggle-sidebar');
    const layout = root.querySelector('.layout');
    const backdrop = root.querySelector('#backdrop');
    const submit = () => {
      const text = textarea.value;
      textarea.value = '';
      sendMessage(text);
    };
    sendBtn.onclick = submit;
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });

    // mobile sidebar toggle
    const openSidebar = () => layout.classList.add('sidebar-open');
    const closeSidebar = () => layout.classList.remove('sidebar-open');
    toggleSidebarBtn.onclick = () => {
      if (layout.classList.contains('sidebar-open')) closeSidebar(); else openSidebar();
    };
    backdrop.onclick = closeSidebar;

    // Voice input via Web Speech API (Chrome/Edge support)
    let recognition = null;
    let recognizing = false;
    function getRecognition() {
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R) return null;
      const rec = new R();
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.continuous = false;
      return rec;
    }

    function startVoice() {
      if (recognizing) return;
      recognition = getRecognition();
      if (!recognition) {
        alert('Voice input not supported in this browser. Try Chrome or Edge.');
        return;
      }
      recognizing = true;
      micBtn.classList.add('recording');
      micBtn.textContent = '⏺';
      let finalTranscript = '';
      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalTranscript += res[0].transcript;
          else interim += res[0].transcript;
        }
        textarea.value = (finalTranscript + interim).trim();
      };
      recognition.onerror = () => {
        stopVoice();
      };
      recognition.onend = () => {
        if (recognizing) stopVoice();
        // Auto-send if we have something
        const text = textarea.value.trim();
        if (text) submit();
      };
      recognition.start();
    }

    function stopVoice() {
      if (!recognizing) return;
      recognizing = false;
      micBtn.classList.remove('recording');
      micBtn.textContent = '🎤';
      try { recognition && recognition.stop(); } catch {}
    }

    micBtn.onclick = () => {
      if (recognizing) stopVoice(); else startVoice();
    };
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  render();
}


