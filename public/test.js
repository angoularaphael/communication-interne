const API = '/api/v1/messages';

const $ = (sel) => document.querySelector(sel);
const logEl = $('#log-output');

function log(msg, type = 'info') {
  const time = new Date().toLocaleTimeString('fr-FR');
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${type}">${msg}</span>`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function showResult(boxId, jsonId, data) {
  const box = $(boxId);
  box.style.display = 'block';
  $(jsonId).textContent = JSON.stringify(data, null, 2);
}

function getAuthHeaders() {
  const token = $('#auth-token').value.trim();
  if (!token) {
    log('Veuillez entrer un access token', 'warn');
    return null;
  }
  return { 'Authorization': `Bearer ${token}` };
}

async function apiCall(method, path, body = null, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  const data = await res.json();

  if (!res.ok) {
    log(`${method} ${path} → ${res.status} : ${data.error}`, 'err');
    throw data;
  }
  log(`${method} ${path} → ${res.status}`, 'ok');
  return data;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('fr-FR');
}

function renderMessages(messages, containerId, currentUserId) {
  const container = $(containerId);
  if (!messages || messages.length === 0) {
    container.innerHTML = '<p style="color:#8b949e;padding:12px">Aucun message</p>';
    return;
  }

  container.innerHTML = messages.map(m => {
    const isSent = m.sender_id === currentUserId;
    return `
      <div class="message-bubble ${isSent ? 'sent' : 'received'}">
        <div>${esc(m.content)}</div>
        <div class="msg-meta">${formatDate(m.created_at)} ${m.is_read ? '✓ Lu' : ''}</div>
      </div>
    `;
  }).join('');
}

function renderInbox(threads, containerId) {
  const container = $(containerId);
  if (!threads || threads.length === 0) {
    container.innerHTML = '<p style="color:#8b949e;padding:12px">Aucune conversation</p>';
    return;
  }

  container.innerHTML = threads.map(t => `
    <div class="thread-card" onclick="document.getElementById('thread-code').value='${esc(t.thread_code)}';document.getElementById('btn-thread').click();">
      <div class="thread-header">
        <span class="thread-code">${esc(t.thread_code)}</span>
        ${t.unread_count > 0 ? `<span class="unread-badge">${t.unread_count} non lu(s)</span>` : ''}
      </div>
      <div class="last-msg">${esc(t.last_message?.content || '')}</div>
      <div class="meta">Ad: ${esc(t.ad_id)} · ${t.total_messages} message(s) · ${formatDate(t.last_message?.created_at)}</div>
    </div>
  `).join('');
}

/* ─── Health check ─── */
(async function () {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    $('#health-status').innerHTML =
      '<span class="status-dot ok"></span><span style="font-size:13px">Connecté</span>';
    log(`Health: ${data.status} — ${data.service}`, 'ok');
  } catch {
    $('#health-status').innerHTML =
      '<span class="status-dot err"></span><span style="font-size:13px">Hors ligne</span>';
    log('Messaging Service inaccessible', 'err');
  }
})();

/* ─── SEND MESSAGE ─── */
$('#btn-send').addEventListener('click', async () => {
  const auth = getAuthHeaders();
  if (!auth) return;
  const adId = $('#send-ad-id').value.trim();
  if (!adId) { log('Entrez un Ad ID', 'warn'); return; }
  const content = $('#send-content').value.trim();
  if (!content) { log('Entrez un contenu', 'warn'); return; }
  try {
    const data = await apiCall('POST', `${API}/${adId}`, { content }, auth);
    showResult('#send-result', '#send-json', data);
    log(`Message envoyé dans le fil ${data.message.thread_code}`, 'ok');
  } catch (_e) { /* logged */ }
});

/* ─── UNREAD COUNT ─── */
$('#btn-unread').addEventListener('click', async () => {
  const auth = getAuthHeaders();
  if (!auth) return;
  try {
    const data = await apiCall('GET', `${API}/unread/count`, null, auth);
    showResult('#unread-result', '#unread-json', data);
    log(`${data.unread_count} message(s) non lu(s)`, 'ok');
  } catch (_e) { /* logged */ }
});

/* ─── INBOX ─── */
$('#btn-inbox').addEventListener('click', async () => {
  const auth = getAuthHeaders();
  if (!auth) return;
  const page = $('#inbox-page').value || 1;
  try {
    const data = await apiCall('GET', `${API}/inbox?page=${page}`, null, auth);
    renderInbox(data.threads, '#inbox-threads');
    showResult('#inbox-result', '#inbox-json', { pagination: data.pagination });
    log(`${data.threads.length} conversation(s), page ${data.pagination.page}/${data.pagination.pages}`, 'ok');
  } catch (_e) { /* logged */ }
});

/* ─── AD MESSAGES ─── */
$('#btn-ad-messages').addEventListener('click', async () => {
  const auth = getAuthHeaders();
  if (!auth) return;
  const adId = $('#ad-msg-id').value.trim();
  if (!adId) { log('Entrez un Ad ID', 'warn'); return; }
  try {
    const data = await apiCall('GET', `${API}/${adId}`, null, auth);
    const token = $('#auth-token').value.trim();
    let userId = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub || payload.id || '';
    } catch (_e) { /* ignore */ }
    renderMessages(data.messages, '#ad-messages-chat', userId);
    showResult('#ad-msg-result', '#ad-msg-json', { thread_code: data.thread_code, count: data.messages.length });
    log(`${data.messages.length} message(s) pour l'annonce ${adId}`, 'ok');
  } catch (_e) { /* logged */ }
});

/* ─── THREAD ─── */
$('#btn-thread').addEventListener('click', async () => {
  const auth = getAuthHeaders();
  if (!auth) return;
  const threadCode = $('#thread-code').value.trim();
  if (!threadCode) { log('Entrez un thread code', 'warn'); return; }
  try {
    const data = await apiCall('GET', `${API}/thread/${threadCode}`, null, auth);
    const token = $('#auth-token').value.trim();
    let userId = '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub || payload.id || '';
    } catch (_e) { /* ignore */ }
    renderMessages(data.messages, '#thread-chat', userId);
    showResult('#thread-result', '#thread-json', { thread_code: data.thread_code, count: data.messages.length });
    log(`${data.messages.length} message(s) dans le fil ${threadCode}`, 'ok');
  } catch (_e) { /* logged */ }
});

/* ─── MARK READ ─── */
$('#btn-mark-read').addEventListener('click', async () => {
  const auth = getAuthHeaders();
  if (!auth) return;
  const msgId = $('#mark-msg-id').value.trim();
  if (!msgId) { log('Entrez un Message ID', 'warn'); return; }
  try {
    const data = await apiCall('PUT', `${API}/${msgId}/read`, null, auth);
    showResult('#mark-result', '#mark-json', data);
    log('Message marqué comme lu', 'ok');
  } catch (_e) { /* logged */ }
});

/* ─── INTERNAL: COUNT ─── */
$('#btn-internal-count').addEventListener('click', async () => {
  const key = $('#service-key').value.trim();
  if (!key) { log('Collez la clé INTER_SERVICE_KEY', 'warn'); return; }
  const adId = $('#internal-ad-id').value.trim();
  if (!adId) { log('Entrez un Ad ID', 'warn'); return; }
  try {
    const data = await apiCall('GET', `/internal/messages/ad/${adId}/count`, null, { 'X-Service-Key': key });
    showResult('#internal-result', '#internal-json', data);
    log(`${data.count} message(s) pour l'annonce ${adId}`, 'ok');
  } catch (_e) { /* logged */ }
});

/* ─── INTERNAL: DELETE ─── */
$('#btn-internal-delete').addEventListener('click', async () => {
  const key = $('#service-key').value.trim();
  if (!key) { log('Collez la clé INTER_SERVICE_KEY', 'warn'); return; }
  const adId = $('#internal-ad-id').value.trim();
  if (!adId) { log('Entrez un Ad ID', 'warn'); return; }
  try {
    const data = await apiCall('DELETE', `/internal/messages/ad/${adId}`, null, { 'X-Service-Key': key });
    showResult('#internal-result', '#internal-json', data);
    log(`${data.deleted_count} message(s) supprimé(s) pour l'annonce ${adId}`, 'ok');
  } catch (_e) { /* logged */ }
});
