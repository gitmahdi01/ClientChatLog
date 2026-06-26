/* ─── ClientChatLog — app.js ─────────────────────────────────
   State, Supabase persistence, rendering & actions for the
   chat log tool. Requires auth.js to have set `currentUser`
   before any of these functions are called.
──────────────────────────────────────────────────────────────*/

// ─── STATE ────────────────────────────────────────────────────
let state = {
  sessions: [],        // [{ id, name, colorIdx, createdAt, messages: [] }]
  activeId: null,      // currently viewed session id
  pendingAction: null  // function to call on modal confirm
};

const SESSION_COLORS = ['#C9A84C','#5B8DB8','#3D7A5F','#9B6B9B','#C07A50','#4A8FA8'];

// ─── PERSISTENCE (Supabase) ────────────────────────────────────
async function loadFromSupabase() {
  if (!currentUser) return;

  const { data: sessionRows, error: sessErr } = await supabaseClient
    .from('sessions')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (sessErr) {
    console.error('Failed to load sessions', sessErr);
    state.sessions = [];
    return;
  }

  const { data: msgRows, error: msgErr } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('logged_at', { ascending: true });

  if (msgErr) console.error('Failed to load messages', msgErr);

  state.sessions = (sessionRows || []).map(s => ({
    id: s.id,
    name: s.name,
    colorIdx: s.color_idx,
    createdAt: s.created_at,
    messages: (msgRows || [])
      .filter(m => m.session_id === s.id)
      .map(m => ({
        id: m.id,
        parent: m.parent,
        date: m.date,
        channel: m.channel,
        text: m.text,
        loggedAt: m.logged_at
      }))
  }));

  if (state.activeId && !state.sessions.find(s => s.id === state.activeId)) {
    state.activeId = null;
  }
}

async function persistNewSession(session) {
  const { error } = await supabaseClient.from('sessions').insert({
    id: session.id,
    user_id: currentUser.id,
    name: session.name,
    color_idx: session.colorIdx,
    created_at: session.createdAt
  });
  if (error) console.error('Failed to save session', error);
}

async function persistDeleteSession(sessionId) {
  const { error } = await supabaseClient.from('sessions').delete().eq('id', sessionId);
  if (error) console.error('Failed to delete session', error);
}

async function persistNewMessage(sessionId, entry) {
  const { error } = await supabaseClient.from('messages').insert({
    id: entry.id,
    session_id: sessionId,
    user_id: currentUser.id,
    parent: entry.parent,
    date: entry.date,
    channel: entry.channel,
    text: entry.text,
    logged_at: entry.loggedAt
  });
  if (error) console.error('Failed to save message', error);
}

async function persistDeleteMessage(msgId) {
  const { error } = await supabaseClient.from('messages').delete().eq('id', msgId);
  if (error) console.error('Failed to delete message', error);
}

async function persistClearAll() {
  const { error: e1 } = await supabaseClient.from('sessions').delete().eq('user_id', currentUser.id);
  if (e1) console.error('Failed to clear sessions', e1);
}

// ─── HELPERS ──────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
       + ' · ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

function activeSession() {
  return state.sessions.find(s => s.id === state.activeId) || null;
}

function colorClass(idx) {
  return `border-c${idx % SESSION_COLORS.length}`;
}

// ─── SESSION ACTIONS ──────────────────────────────────────────
async function newSession() {
  const name = `Session — ${new Date().toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric'
  })}`;
  const colorIdx = state.sessions.length % SESSION_COLORS.length;
  const session = {
    id: uid(),
    name,
    colorIdx,
    createdAt: Date.now(),
    messages: []
  };
  state.sessions.unshift(session);
  state.activeId = session.id;
  render();
  await persistNewSession(session);
  setTimeout(() => document.getElementById('parentName').focus(), 80);
}

function selectSession(id) {
  state.activeId = id;
  render();
  document.getElementById('sidebar').classList.remove('open');
}

function deleteSession() {
  const session = activeSession();
  if (!session) return;
  openModal(
    'Delete Session',
    `Delete "${session.name}" and all its entries? This cannot be undone.`,
    async () => {
      const id = state.activeId;
      state.sessions = state.sessions.filter(s => s.id !== id);
      state.activeId = state.sessions.length ? state.sessions[0].id : null;
      render();
      await persistDeleteSession(id);
    }
  );
}

function confirmClearAll() {
  if (!state.sessions.length) return;
  openModal(
    'Clear All Data',
    'This will permanently delete all sessions and communication records. Are you sure?',
    async () => {
      state.sessions = [];
      state.activeId = null;
      render();
      await persistClearAll();
    }
  );
}

// ─── MESSAGE ACTIONS ──────────────────────────────────────────
async function logMessage() {
  const session = activeSession();
  if (!session) return;

  const parent  = document.getElementById('parentName').value.trim();
  const date    = document.getElementById('logDate').value;
  const channel = document.getElementById('channel').value;
  const text    = document.getElementById('messageInput').value.trim();

  if (!text) {
    flashInput('messageInput');
    return;
  }

  const entry = {
    id: uid(),
    parent: parent || 'Unnamed',
    date,
    channel,
    text,
    loggedAt: Date.now()
  };

  session.messages.push(entry);

  document.getElementById('messageInput').value = '';

  renderMessages(session);
  updateSessionList();
  scrollChatBottom();

  await persistNewMessage(session.id, entry);
}

async function deleteMessage(sessionId, msgId) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;
  session.messages = session.messages.filter(m => m.id !== msgId);
  renderMessages(session);
  updateSessionList();
  await persistDeleteMessage(msgId);
}

function flashInput(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#B84040';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 1200);
}

// ─── PDF EXPORT ───────────────────────────────────────────────
function exportPDF() {
  const session = activeSession();
  if (!session || !session.messages.length) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 210, marginX = 18, lineH = 6;
  let y = 20;

  // Header
  doc.setFillColor(15, 28, 46);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(240, 237, 232);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ClientChatLog', marginX, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(201, 168, 76);
  doc.text('School Fee Communications Record', marginX, 20);
  doc.setTextColor(150, 160, 175);
  doc.text(`Exported: ${new Date().toLocaleDateString('en-ZA', {
    day:'2-digit', month:'long', year:'numeric'
  })}`, W - marginX, 20, { align: 'right' });

  y = 40;
  doc.setTextColor(15, 28, 46);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(session.name, marginX, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 110, 120);
  doc.text(`${session.messages.length} communication${session.messages.length !== 1 ? 's' : ''} · Created ${new Date(session.createdAt).toLocaleDateString('en-ZA')}`, marginX, y);
  y += 10;

  // Divider
  doc.setDrawColor(200, 195, 185);
  doc.line(marginX, y, W - marginX, y);
  y += 10;

  session.messages.forEach((msg, i) => {
    const textLines = doc.splitTextToSize(msg.text, W - marginX * 2 - 4);
    const blockH = 26 + textLines.length * lineH;

    if (y + blockH > 270) {
      doc.addPage();
      y = 20;
    }

    // Card background
    doc.setFillColor(250, 249, 247);
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(marginX, y, W - marginX * 2, blockH, 2, 2, 'FD');

    // Accent bar
    const col = SESSION_COLORS[session.colorIdx % SESSION_COLORS.length];
    const r = parseInt(col.slice(1,3),16);
    const g = parseInt(col.slice(3,5),16);
    const b = parseInt(col.slice(5,7),16);
    doc.setFillColor(r,g,b);
    doc.rect(marginX, y, 3, blockH, 'F');

    // Meta row
    const mx = marginX + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 28, 46);
    doc.text(msg.parent, mx, y + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 110, 120);
    doc.text(`${msg.channel}`, mx + doc.getTextWidth(msg.parent) + 5, y + 9);
    doc.text(formatDate(msg.date), W - marginX - 4, y + 9, { align: 'right' });

    // Message text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 35, 42);
    doc.text(textLines, mx, y + 18);

    y += blockH + 7;
  });

  // Footer on last page
  doc.setFontSize(8);
  doc.setTextColor(160, 165, 175);
  doc.text('Generated by ClientChatLog', marginX, 290);
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, W - marginX, 290, { align: 'right' });

  const filename = session.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
  doc.save(filename);
}

// ─── MODAL ────────────────────────────────────────────────────
function openModal(title, body, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  state.pendingAction = onConfirm;
  document.getElementById('modalOverlay').classList.add('visible');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('visible');
  state.pendingAction = null;
}

document.getElementById('modalConfirmBtn').addEventListener('click', () => {
  if (typeof state.pendingAction === 'function') state.pendingAction();
  closeModal();
});

// ─── SIDEBAR TOGGLE (mobile) ──────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── RENDERING ────────────────────────────────────────────────
function render() {
  updateSessionList();
  renderActiveSession();
}

function updateSessionList() {
  const list = document.getElementById('sessionList');
  if (!state.sessions.length) {
    list.innerHTML = '<li style="padding:12px 10px;font-size:12px;color:#718096;text-align:center">No sessions yet</li>';
    return;
  }
  list.innerHTML = state.sessions.map(s => {
    const active = s.id === state.activeId ? 'active' : '';
    const dot = SESSION_COLORS[s.colorIdx % SESSION_COLORS.length];
    const count = s.messages.length;
    return `
      <li class="session-item ${active}" onclick="selectSession('${s.id}')">
        <span class="session-dot" style="background:${dot}"></span>
        <div class="session-info">
          <div class="session-name">${escHtml(s.name)}</div>
          <div class="session-count">${count} entr${count !== 1 ? 'ies' : 'y'}</div>
        </div>
      </li>`;
  }).join('');
}

function renderActiveSession() {
  const session = activeSession();
  const hasSession = !!session;

  // Topbar
  document.getElementById('sessionTitle').textContent = session
    ? session.name : 'Select or start a session';
  document.getElementById('sessionMeta').textContent = session
    ? `${session.messages.length} entr${session.messages.length !== 1 ? 'ies' : 'y'} · Created ${new Date(session.createdAt).toLocaleDateString('en-ZA')}` : '';

  // Buttons
  document.getElementById('btnExport').disabled = !hasSession || !session?.messages.length;
  document.getElementById('btnDelete').disabled = !hasSession;

  // Input area
  const inputArea = document.getElementById('inputArea');
  if (hasSession) inputArea.classList.remove('disabled');
  else inputArea.classList.add('disabled');

  // Set today's date as default
  if (!document.getElementById('logDate').value) {
    document.getElementById('logDate').valueAsDate = new Date();
  }

  // Empty state vs messages
  const empty = document.getElementById('emptyState');
  const wrap  = document.getElementById('messagesWrap');

  if (!hasSession) {
    empty.style.display = 'flex';
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }

  empty.style.display = 'none';
  wrap.style.display = 'flex';
  renderMessages(session);
}

function renderMessages(session) {
  const wrap = document.getElementById('messagesWrap');
  if (!session.messages.length) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:40px 0;color:#A0AEC0">
        <div style="font-size:32px;margin-bottom:10px">📝</div>
        <div style="font-size:14px">No entries yet — log your first communication below.</div>
      </div>`;
    return;
  }
  wrap.innerHTML = session.messages.map(msg => buildCard(msg, session)).join('');

  // Update export button
  document.getElementById('btnExport').disabled = !session.messages.length;
}

function buildCard(msg, session) {
  const cls = colorClass(session.colorIdx);
  return `
    <div class="message-card ${cls}" id="card-${msg.id}">
      <div class="card-header">
        <div class="card-meta">
          <span class="card-parent">${escHtml(msg.parent)}</span>
          <span class="card-channel">${escHtml(msg.channel)}</span>
        </div>
        <div class="card-actions">
          <span class="card-date">📅 ${formatDate(msg.date)}</span>
          <button class="btn-card-del" title="Delete this entry"
            onclick="deleteMessage('${session.id}','${msg.id}')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.5 3.5h11M5 3.5V2h4v1.5M4.5 3.5l.5 8h4l.5-8"
                stroke="currentColor" stroke-width="1.3"
                stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="card-message">${escHtml(msg.text)}</div>
    </div>`;
}

function scrollChatBottom() {
  const area = document.getElementById('chatArea');
  area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
}

// ─── SECURITY ─────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// ─── KEYBOARD SHORTCUT ────────────────────────────────────────
document.getElementById('messageInput').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    logMessage();
  }
});

// ─── NOTE ─────────────────────────────────────────────────────
// No init call here — auth.js's initAuth() drives the initial
// loadFromSupabase() + render() once a user is confirmed signed in.