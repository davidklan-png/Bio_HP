/**
 * kinokoholic.com Chat — Vanilla JS client
 *
 * Streams responses from /api/chat (Cloudflare Worker → Claude Sonnet).
 * Persists conversation in localStorage.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'kinokoholic-chat-history';
  const API_ENDPOINT = '/api/chat';
  const MAX_HISTORY_MESSAGES = 50;
  const MAX_INPUT_CHARS = 4000;
  const STREAM_TIMEOUT_MS = 60000;

  // ── State ───────────────────────────────────────────────────────────
  let messages = []; // { role: 'user'|'assistant', content: string }
  let isStreaming = false;
  let lastFailedUserText = '';

  // ── DOM refs ────────────────────────────────────────────────────────
  const container = document.getElementById('chat-app');
  if (!container) return;

  let messagesEl, inputEl, sendBtn, clearBtn, emptyEl;

  // ── Init ────────────────────────────────────────────────────────────
  function init() {
    // Load history
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) messages = sanitizeMessages(JSON.parse(saved));
    } catch {
      messages = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }

    // Build DOM
    container.innerHTML = `
      <div class="chat-wrapper">
        <div class="chat-header">
          <h1>Ask about David's work</h1>
          <button class="chat-clear-btn" aria-label="Clear chat history">Start over</button>
        </div>
        <div class="chat-messages" role="log" aria-live="polite" aria-label="Chat messages"></div>
        <div class="chat-input-area">
          <div class="chat-input-row">
            <textarea class="chat-input"
              rows="1"
              maxlength="${MAX_INPUT_CHARS}"
              placeholder="Ask me anything about David's work — projects, tradeoffs, scope, what he'd do differently."
              aria-label="Type your message"></textarea>
            <button class="chat-send-btn" aria-label="Send message">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    messagesEl = container.querySelector('.chat-messages');
    inputEl = container.querySelector('.chat-input');
    sendBtn = container.querySelector('.chat-send-btn');
    clearBtn = container.querySelector('.chat-clear-btn');

    // Event listeners
    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', handleKeydown);
    inputEl.addEventListener('input', autoResize);
    clearBtn.addEventListener('click', handleClear);

    // Render existing messages
    renderAll();
  }

  // ── Starter questions ────────────────────────────────────────────────
  const STARTER_GROUPS = [
    {
      label: 'Recruiter',
      questions: [
        "What's David's current availability and the type of roles he's open to?",
        "What's his strongest end-to-end project — from problem to production?",
        "How does his PM background change the way he builds AI systems?",
      ],
    },
    {
      label: 'Business partner',
      questions: [
        "What kind of engagements does David take on?",
        "How would he scope and approach a RAG or agentic workflow project?",
        "What's a realistic timeline and process for an AI-powered product MVP?",
      ],
    },
    {
      label: 'Startup founder',
      questions: [
        "Can you walk me through the -mon product family and what it's building toward?",
        "What would David build differently if he were starting the JTES project over?",
        "How does he decide when to ship vs. keep iterating?",
      ],
    },
  ];

  function renderStarterQuestions() {
    const wrap = document.createElement('div');
    wrap.className = 'chat-starters';
    wrap.innerHTML = `<p class="chat-starters__intro">Ask me anything about David's work, or pick a question below.</p>`;

    STARTER_GROUPS.forEach(group => {
      const section = document.createElement('div');
      section.className = 'chat-starters__group';
      section.innerHTML = `<span class="chat-starters__label">${escapeHtml(group.label)}</span>`;

      group.questions.forEach(q => {
        const btn = document.createElement('button');
        btn.className = 'chat-starter-btn';
        btn.textContent = q;
        btn.addEventListener('click', () => {
          inputEl.value = q;
          autoResize();
          handleSend();
        });
        section.appendChild(btn);
      });

      wrap.appendChild(section);
    });

    messagesEl.appendChild(wrap);
  }

  // ── Render ──────────────────────────────────────────────────────────
  function renderAll() {
    messagesEl.innerHTML = '';
    if (messages.length === 0) {
      renderStarterQuestions();
      return;
    }
    messages.forEach(msg => appendMessage(msg.role, msg.content));
    scrollToBottom();
  }

  function appendMessage(role, content) {
    const empty = messagesEl.querySelector('.chat-empty, .chat-starters');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.className = `chat-msg chat-msg--${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = renderMarkdown(content);

    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'chat-msg chat-msg--assistant';
    row.id = 'chat-typing-row';
    row.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(row);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const el = document.getElementById('chat-typing-row');
    if (el) el.remove();
  }

  function showError(text) {
    const err = document.createElement('div');
    err.className = 'chat-error';
    err.innerHTML = `${escapeHtml(text)} <button class="chat-error-retry" aria-label="Retry">Retry</button>`;
    err.querySelector('.chat-error-retry').addEventListener('click', retryLastMessage);
    messagesEl.appendChild(err);
    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // ── Send logic ──────────────────────────────────────────────────────
  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text || isStreaming) return;
    if (inputEl.value.length > MAX_INPUT_CHARS) {
      showError(`Message is too long. Keep it under ${MAX_INPUT_CHARS} characters.`);
      return;
    }

    // Add user message
    messages.push({ role: 'user', content: text });
    messages = sanitizeMessages(messages);
    lastFailedUserText = text;
    inputEl.value = '';
    autoResize();
    appendMessage('user', text);
    save();

    // Show typing
    isStreaming = true;
    sendBtn.disabled = true;
    showTypingIndicator();

    // Remove any previous error
    const prevErr = messagesEl.querySelector('.chat-error');
    if (prevErr) prevErr.remove();

    try {
      await streamResponse();
      lastFailedUserText = '';
    } catch (err) {
      removeTypingIndicator();
      showError(err.message || 'Something went wrong. Please try again.');
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  async function retryLastMessage() {
    if (isStreaming) return;

    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      messages.pop();
      save();
    }

    const err = messagesEl.querySelector('.chat-error');
    if (err) err.remove();

    if (messages.length === 0 && lastFailedUserText) {
      messages.push({ role: 'user', content: lastFailedUserText });
      save();
    }

    renderAll();
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      isStreaming = true;
      sendBtn.disabled = true;
      showTypingIndicator();
      try {
        await streamResponse();
        lastFailedUserText = '';
      } catch (retryErr) {
        removeTypingIndicator();
        showError(retryErr.message || 'Something went wrong. Please try again.');
      } finally {
        isStreaming = false;
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }
  }

  // ── Streaming ───────────────────────────────────────────────────────
  async function streamResponse() {
    const body = JSON.stringify({
      messages: messages.slice(-50), // limit history
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      clearTimeout(timeout);
      let errMsg = `Request failed (${response.status})`;
      try {
        const errData = await response.json();
        errMsg = errData.error || errMsg;
      } catch { /* use default */ }
      throw new Error(errMsg);
    }
    if (!response.body) {
      clearTimeout(timeout);
      throw new Error('The response stream was empty.');
    }

    removeTypingIndicator();
    const bubble = appendMessage('assistant', '');
    let fullText = '';

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              bubble.innerHTML = renderMarkdown(fullText);
              scrollToBottom();
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('The request timed out. Please try again.');
      }
      // If we have partial text, keep it
      if (fullText) {
        messages.push({ role: 'assistant', content: fullText });
        save();
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    // Save complete assistant message
    messages.push({ role: 'assistant', content: fullText });
    save();
    return bubble;
  }

  // ── Input handling ──────────────────────────────────────────────────
  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  }

  // ── Clear ───────────────────────────────────────────────────────────
  function handleClear() {
    if (isStreaming) return;
    messages = [];
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    inputEl.focus();
  }

  // ── Persistence ─────────────────────────────────────────────────────
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeMessages(messages).slice(-MAX_HISTORY_MESSAGES)));
    } catch { /* quota exceeded, ignore */ }
  }

  function sanitizeMessages(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter(msg =>
        msg &&
        typeof msg === 'object' &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string' &&
        msg.content.trim().length > 0
      )
      .map(msg => ({ role: msg.role, content: msg.content.slice(0, MAX_INPUT_CHARS) }))
      .slice(-MAX_HISTORY_MESSAGES);
  }

  // ── Markdown-lite renderer ──────────────────────────────────────────
  function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Bullet lists — tag with a sentinel so wrapping picks the right list type
    html = html.replace(/^(\s*)[-*]\s+(.+)$/gm, '$1<li data-list="ul">$2</li>');
    // Numbered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li data-list="ol">$1</li>');
    // Wrap consecutive <li>s of the same kind
    html = html.replace(/(?:<li data-list="ul">.*?<\/li>\n?)+/g, (block) =>
      `<ul>${block.replace(/ data-list="ul"/g, '')}</ul>`,
    );
    html = html.replace(/(?:<li data-list="ol">.*?<\/li>\n?)+/g, (block) =>
      `<ol>${block.replace(/ data-list="ol"/g, '')}</ol>`,
    );

    // Paragraphs (double newline)
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already block-level
    if (!html.startsWith('<')) {
      html = `<p>${html}</p>`;
    }

    return html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Boot ────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
