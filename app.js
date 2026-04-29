'use strict';

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  step: 1,
  apiKey: localStorage.getItem('gemini_api_key') || '',
  claudeApiKey: localStorage.getItem('claude_api_key') || '',
  showApiKeyScreen: false,
  images: [],      // [{id, file, dataUrl}]
  items: [],       // [{id, name, price}]
  people: [],      // [{id, name}]
  assignments: {}, // {itemId: Set<personId>}
  loading: false,
  loadingMessage: '',
  error: null,
};

if (!state.apiKey && !state.claudeApiKey) state.showApiKeyScreen = true;

let _nextId = 1;
const uid = () => String(_nextId++);

function setState(patch) {
  Object.assign(state, patch);
  render();
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

async function callGemini(images, apiKey) {
  const prompt = `Analysera kvittot/kvittona i bilden/bilderna. Extrahera alla enskilda varor och deras priser.
Returnera ENBART giltig JSON utan kodblock, utan förklaringar, precis i detta format:
{"items":[{"name":"Varunamn","price":12.50}]}
Regler:
- price ska vara ett tal (inte en sträng), med decimalpunkt
- Exkludera totalsummor, delsummor och momsrader – bara enskilda varor
- Om ett pris är oklart, uppskatta rimligt`;

  const parts = [{ text: prompt }];
  for (const img of images) {
    parts.push({
      inline_data: {
        mime_type: img.file.type || 'image/jpeg',
        data: img.dataUrl.split(',')[1],
      },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `HTTP ${res.status}`;
    if (res.status === 400 && msg.includes('API key')) throw new Error('Ogiltig API-nyckel. Kontrollera nyckeln i inställningarna.');
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Tomt svar från Gemini.');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Kunde inte tolka svaret från Gemini.');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed.items)) throw new Error('Oväntat format i svar från Gemini.');
  return parsed.items;
}

async function callClaude(images, apiKey) {
  const content = [];
  for (const img of images) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.file.type || 'image/jpeg', data: img.dataUrl.split(',')[1] },
    });
  }
  content.push({
    type: 'text',
    text: `Analysera kvittot/kvittona i bilderna. Extrahera alla enskilda varor och deras priser.
Returnera ENBART giltig JSON utan kodblock:
{"items":[{"name":"Varunamn","price":12.50}]}
- price ska vara ett tal med decimalpunkt
- Exkludera totalsummor, delsummor och momsrader
- Om pris är oklart, uppskatta`,
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Tomt svar från Claude.');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Kunde inte tolka svar från Claude.');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed.items)) throw new Error('Oväntat format från Claude.');
  return parsed.items;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function handleImageFiles(files) {
  const arr = Array.from(files);
  if (!arr.length) return;
  let pending = arr.length;
  const newImgs = [];
  arr.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      newImgs.push({ id: uid(), file, dataUrl: e.target.result });
      if (--pending === 0) setState({ images: [...state.images, ...newImgs], error: null });
    };
    reader.readAsDataURL(file);
  });
}

function removeImage(id) {
  setState({ images: state.images.filter(img => img.id !== id) });
}

function toItems(raw) {
  return raw.map(it => ({
    id: uid(),
    name: String(it.name || 'Okänd vara').trim(),
    price: parsePrice(it.price),
  }));
}

async function handleAnalyze() {
  if (!state.images.length) return;
  setState({ loading: true, error: null, loadingMessage: '' });

  // ── Gemini med retries ──
  if (state.apiKey) {
    const DELAYS = [5, 10, 20];
    let geminiError = null;

    for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
      try {
        const items = toItems(await callGemini(state.images, state.apiKey));
        setState({ loading: false, loadingMessage: '', items, step: 2 });
        return;
      } catch (e) {
        const isHighDemand = e.message.toLowerCase().includes('high demand');
        if (!isHighDemand || attempt === DELAYS.length) { geminiError = e; break; }
        const delay = DELAYS[attempt];
        for (let s = delay; s > 0; s--) {
          setState({ loadingMessage: `Gemini: hög belastning — försöker om ${s} s (försök ${attempt + 2}/${DELAYS.length + 1})` });
          await sleep(1000);
        }
      }
    }

    // Om Claude-nyckel finns, försök med den som fallback
    if (state.claudeApiKey) {
      setState({ loadingMessage: 'Gemini otillgänglig — provar Claude Haiku…' });
    } else {
      setState({ loading: false, loadingMessage: '', error: geminiError.message });
      return;
    }
  }

  // ── Claude-fallback ──
  try {
    const items = toItems(await callClaude(state.images, state.claudeApiKey));
    setState({ loading: false, loadingMessage: '', items, step: 2 });
  } catch (e) {
    setState({ loading: false, loadingMessage: '', error: `Claude: ${e.message}` });
  }
}

// Reads current item values from DOM inputs before any structural re-render
function collectItems() {
  document.querySelectorAll('[data-name-id]').forEach(input => {
    const item = state.items.find(it => it.id === input.dataset.nameId);
    if (item) item.name = input.value;
  });
  document.querySelectorAll('[data-price-id]').forEach(input => {
    const item = state.items.find(it => it.id === input.dataset.priceId);
    if (item) item.price = parsePrice(input.value);
  });
}

function addItem() {
  collectItems();
  setState({ items: [...state.items, { id: uid(), name: '', price: 0 }] });
  // Focus the new name input after render
  setTimeout(() => {
    const inputs = document.querySelectorAll('[data-name-id]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function removeItem(id) {
  collectItems();
  const assignments = { ...state.assignments };
  delete assignments[id];
  setState({ items: state.items.filter(it => it.id !== id), assignments });
}

function addPerson(name) {
  const n = name.trim();
  if (!n) return;
  setState({ people: [...state.people, { id: uid(), name: n }] });
}

function removePerson(id) {
  setState({ people: state.people.filter(p => p.id !== id), assignments: {} });
}

function initAssignments() {
  collectItems();
  const assignments = {};
  for (const item of state.items) {
    assignments[item.id] = new Set(state.people.map(p => p.id));
  }
  setState({ assignments, step: 4, error: null });
}

function toggleAssignment(itemId, personId) {
  const set = new Set(state.assignments[itemId] || []);
  if (set.has(personId)) {
    if (set.size <= 1) return; // prevent zero assignees
    set.delete(personId);
  } else {
    set.add(personId);
  }
  setState({ assignments: { ...state.assignments, [itemId]: set } });
}

function calculateTotals() {
  const totals = {};
  for (const p of state.people) totals[p.id] = { total: 0, items: [] };
  for (const item of state.items) {
    const pids = [...(state.assignments[item.id] || new Set())];
    if (!pids.length) continue;
    const share = item.price / pids.length;
    for (const pid of pids) {
      if (!totals[pid]) continue;
      totals[pid].total += share;
      totals[pid].items.push({ name: item.name, share });
    }
  }
  return totals;
}

async function shareResult() {
  const totals = calculateTotals();
  const grand = state.items.reduce((s, it) => s + it.price, 0);
  const lines = state.people.map(p => `${p.name}: ${fmt(totals[p.id].total)} kr`).join('\n');
  const text = `🧾 Kvittodelning\n\n${lines}\n\nTotalt: ${fmt(grand)} kr`;

  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  fallbackCopy(text);
}

async function fallbackCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    const btn = el('share-btn');
    if (btn) { btn.textContent = '✓ Kopierat!'; btn.disabled = true; }
    setTimeout(() => render(), 2000);
  } catch {
    prompt('Kopiera texten:', text);
  }
}

function saveApiKeys(geminiKey, claudeKey) {
  const g = geminiKey.trim();
  const c = claudeKey.trim();
  if (!g && !c) { alert('Ange minst en API-nyckel.'); return; }
  if (g) localStorage.setItem('gemini_api_key', g); else localStorage.removeItem('gemini_api_key');
  if (c) localStorage.setItem('claude_api_key', c); else localStorage.removeItem('claude_api_key');
  setState({ apiKey: g, claudeApiKey: c, showApiKeyScreen: false, error: null });
}

function reset() {
  Object.assign(state, {
    step: 1, images: [], items: [], people: [], assignments: {}, loading: false, error: null,
  });
  render();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parsePrice(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.max(0, val);
  return Math.max(0, parseFloat(String(val).replace(',', '.').replace(/[^0-9.]/g, '')) || 0);
}

function fmt(num) {
  const n = Math.round(num * 100) / 100;
  return n.toFixed(2).replace('.', ',');
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function el(id) { return document.getElementById(id); }

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');

  if (state.showApiKeyScreen) {
    app.innerHTML = renderApiKeyScreen();
    bindApiKeyScreen();
    return;
  }

  app.innerHTML = `
    ${renderHeader()}
    ${renderStepIndicator()}
    <div class="content">
      ${state.error ? `<div class="error-banner">⚠️ ${esc(state.error)}</div>` : ''}
      ${state.loading ? renderLoading() : renderCurrentStep()}
    </div>
    ${state.loading ? '' : renderActionBar()}
  `;

  if (!state.loading) bindStepEvents();
}

function renderHeader() {
  return `
    <header class="app-header">
      <h1>🧾 Kvittodelare</h1>
      <button class="btn-icon" id="settings-btn" title="API-nyckel">⚙️</button>
    </header>`;
}

function renderStepIndicator() {
  let html = '<div class="step-indicator">';
  for (let i = 1; i <= 5; i++) {
    const cls = i < state.step ? 'done' : i === state.step ? 'active' : '';
    html += `<div class="step-dot ${cls}">${i < state.step ? '✓' : i}</div>`;
    if (i < 5) html += `<div class="step-line ${i < state.step ? 'done' : ''}"></div>`;
  }
  return html + '</div>';
}

function renderLoading() {
  const msg = state.loadingMessage || 'Analyserar kvittot med Gemini AI…<br>Det tar några sekunder.';
  return `<div class="loading-overlay">
    <div class="spinner"></div>
    <p class="loading-text">${msg}</p>
  </div>`;
}

function renderCurrentStep() {
  return [null, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5][state.step]?.() ?? '';
}

function renderActionBar() {
  let html = '<div class="action-bar">';

  if (state.step > 1 && state.step <= 5) {
    html += `<button class="btn btn-secondary" id="back-btn" style="padding:14px 16px">← Tillbaka</button>`;
  }

  switch (state.step) {
    case 1:
      html += `<button class="btn btn-primary" id="analyze-btn" ${!state.images.length ? 'disabled' : ''}>✨ Analysera kvitto</button>`;
      break;
    case 2:
      html += `<button class="btn btn-primary" id="next-btn" ${!state.items.length ? 'disabled' : ''}>Lägg till personer →</button>`;
      break;
    case 3:
      html += `<button class="btn btn-primary" id="next-btn" ${state.people.length < 2 ? 'disabled' : ''}>Fördela kostnader →</button>`;
      break;
    case 4:
      html += `<button class="btn btn-primary" id="next-btn">Visa summering →</button>`;
      break;
    case 5:
      html += `<button class="btn btn-primary" id="share-btn">📤 Dela summering</button>`;
      break;
  }

  return html + '</div>';
}

// ─── Step renderers ───────────────────────────────────────────────────────────

function renderStep1() {
  const thumbs = state.images.map(img => `
    <div class="image-thumb-wrap">
      <img class="image-thumb" src="${img.dataUrl}" alt="Kvitto">
      <button class="image-thumb-remove" data-remove-img="${img.id}" aria-label="Ta bort bild">×</button>
    </div>`).join('');

  return `
    <h2 class="section-title">Importera kvitton</h2>
    <label class="file-drop" for="file-input">
      <span class="file-drop-icon">📷</span>
      <span class="file-drop-text">Tryck för att välja bilder</span>
      <span class="file-drop-sub">Kamerarulle eller ta ny bild</span>
    </label>
    <input type="file" id="file-input" accept="image/*" multiple style="display:none">
    ${state.images.length ? `<div class="image-grid">${thumbs}</div>` : ''}
    ${state.images.length ? `<p class="hint">${state.images.length} bild${state.images.length > 1 ? 'er' : ''} vald${state.images.length > 1 ? 'a' : ''} — klicka för att lägga till fler</p>` : ''}`;
}

function renderStep2() {
  const rows = state.items.map(item => `
    <div class="item-row">
      <input class="item-name-input" type="text" value="${esc(item.name)}"
        data-name-id="${item.id}" placeholder="Varunamn" inputmode="text">
      <input class="item-price-input" type="number" value="${item.price || ''}"
        data-price-id="${item.id}" placeholder="0" min="0" step="0.01" inputmode="decimal">
      <button class="btn btn-danger" data-remove-item="${item.id}" aria-label="Ta bort">🗑</button>
    </div>`).join('');

  const total = state.items.reduce((s, it) => s + it.price, 0);

  return `
    <h2 class="section-title">Granska varor</h2>
    <div class="card">
      ${rows || '<p class="text-sec" style="padding:12px 14px">Inga varor – lägg till manuellt nedan</p>'}
    </div>
    ${state.items.length ? `<p class="total-line" id="total-display">Totalt: <strong>${fmt(total)} kr</strong></p>` : ''}
    <button class="btn btn-add" id="add-item-btn">+ Lägg till vara</button>`;
}

function renderStep3() {
  const badges = state.people.map(p => `
    <div class="person-badge">
      ${esc(p.name)}
      <button data-remove-person="${p.id}" aria-label="Ta bort ${esc(p.name)}">×</button>
    </div>`).join('');

  return `
    <h2 class="section-title">Lägg till personer</h2>
    ${state.people.length
      ? `<div class="people-list">${badges}</div>`
      : '<p class="text-sec" style="margin-bottom:16px">Inga personer tillagda ännu</p>'}
    <div class="add-person-row">
      <input class="add-person-input" type="text" id="person-input"
        placeholder="Namn, t.ex. Anna" maxlength="30" autocomplete="off">
      <button class="add-person-btn" id="add-person-btn" aria-label="Lägg till person">+</button>
    </div>
    ${state.people.length < 2 ? '<p class="hint" style="margin-top:14px">Minst 2 personer krävs för att dela</p>' : ''}`;
}

function renderStep4() {
  const cards = state.items.map(item => {
    const assigned = state.assignments[item.id] || new Set();
    const count = assigned.size;
    const share = count > 0 ? fmt(item.price / count) : '–';

    const toggles = state.people.map(p => {
      const isActive = assigned.has(p.id);
      const isOnly = isActive && count === 1;
      return `<button class="person-toggle ${isActive ? 'active' : ''} ${isOnly ? 'only' : ''}"
        data-ti="${item.id}" data-tp="${p.id}"
        ${isOnly ? 'title="Kan ej ta bort sista personen"' : ''}>${esc(p.name)}</button>`;
    }).join('');

    return `
      <div class="dist-item">
        <div class="dist-item-header">
          <span class="dist-item-name">${esc(item.name) || '<em>Namnlös vara</em>'}</span>
          <span class="dist-item-meta">${fmt(item.price)} kr · ${share} kr/pers</span>
        </div>
        <div class="dist-people">${toggles}</div>
      </div>`;
  }).join('');

  return `
    <h2 class="section-title">Fördela kostnader</h2>
    <p class="text-sec" style="margin-bottom:14px">Tryck på ett namn för att inkludera eller exkludera en person från en vara.</p>
    ${cards}`;
}

function renderStep5() {
  const totals = calculateTotals();
  const grand = state.items.reduce((s, it) => s + it.price, 0);

  const cards = state.people.map(p => {
    const data = totals[p.id];
    const itemRows = data.items.map(it =>
      `<div class="summary-item-row"><span>${esc(it.name)}</span><span>${fmt(it.share)} kr</span></div>`
    ).join('');

    return `
      <div class="summary-card">
        <div class="summary-person-name">${esc(p.name)}</div>
        <div class="summary-total">${fmt(data.total)} <span>kr</span></div>
        ${data.items.length ? `
          <details class="summary-details">
            <summary>Visa detaljer</summary>
            <div class="summary-items">${itemRows}</div>
          </details>` : ''}
      </div>`;
  }).join('');

  return `
    <h2 class="section-title">Summering</h2>
    <div class="summary-grand-total">
      <span>Totalt att betala</span>
      <strong>${fmt(grand)} kr</strong>
    </div>
    ${cards}
    <button class="btn btn-secondary" id="reset-btn" style="margin-top:8px;width:100%">🔄 Börja om</button>`;
}

function renderApiKeyScreen() {
  const hasAny = state.apiKey || state.claudeApiKey;
  return `
    <div class="api-splash">
      <h1>🧾 Kvittodelare</h1>
      <p>Dela upp kvittokostnader med AI</p>
    </div>
    <div class="api-key-body">
      <h2 class="section-title">API-nycklar</h2>

      <div class="api-key-section">
        <div class="api-key-label">Gemini 2.5 Flash <span class="api-key-tag">Gratis · Primär</span></div>
        <div class="api-key-info">ai.google.dev → API Keys → Create API key</div>
        <input class="api-key-input" type="text" id="gemini-key-input"
          placeholder="AIzaSy…" autocomplete="off" spellcheck="false"
          value="${esc(state.apiKey)}">
      </div>

      <div class="api-key-section">
        <div class="api-key-label">Claude Haiku <span class="api-key-tag">Reserv · ~0,02 kr/kvitto</span></div>
        <div class="api-key-info">console.anthropic.com → API Keys</div>
        <input class="api-key-input" type="text" id="claude-key-input"
          placeholder="sk-ant-…" autocomplete="off" spellcheck="false"
          value="${esc(state.claudeApiKey)}">
      </div>

      <button class="btn btn-primary" id="api-key-save-btn">Spara och fortsätt</button>
      ${hasAny ? `<button class="btn btn-secondary" id="api-key-cancel-btn">Avbryt</button>` : ''}
    </div>`;
}

// ─── Event binding ────────────────────────────────────────────────────────────

function bindApiKeyScreen() {
  const save = () => saveApiKeys(
    el('gemini-key-input')?.value ?? '',
    el('claude-key-input')?.value ?? '',
  );
  el('api-key-save-btn')?.addEventListener('click', save);
  el('api-key-cancel-btn')?.addEventListener('click', () => setState({ showApiKeyScreen: false }));
}

function bindStepEvents() {
  el('settings-btn')?.addEventListener('click', () => setState({ showApiKeyScreen: true }));

  el('back-btn')?.addEventListener('click', () => {
    if (state.step === 2) collectItems();
    setState({ step: state.step - 1, error: null });
  });

  el('next-btn')?.addEventListener('click', () => {
    if (state.step === 3) { initAssignments(); return; }
    if (state.step === 2) collectItems();
    setState({ step: state.step + 1, error: null });
  });

  el('reset-btn')?.addEventListener('click', reset);
  el('share-btn')?.addEventListener('click', shareResult);

  // Step 1
  el('file-input')?.addEventListener('change', e => handleImageFiles(e.target.files));
  document.querySelectorAll('[data-remove-img]').forEach(btn =>
    btn.addEventListener('click', () => removeImage(btn.dataset.removeImg))
  );
  el('analyze-btn')?.addEventListener('click', handleAnalyze);

  // Step 2 — delete uses pointerdown to fire before blur
  document.querySelectorAll('[data-remove-item]').forEach(btn =>
    btn.addEventListener('pointerdown', e => { e.preventDefault(); removeItem(btn.dataset.removeItem); })
  );
  el('add-item-btn')?.addEventListener('pointerdown', e => { e.preventDefault(); addItem(); });

  // Step 3
  const doAddPerson = () => {
    const input = el('person-input');
    if (!input?.value.trim()) return;
    addPerson(input.value);
    input.value = '';
    input.focus();
  };
  el('add-person-btn')?.addEventListener('click', doAddPerson);
  el('person-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') doAddPerson(); });
  document.querySelectorAll('[data-remove-person]').forEach(btn =>
    btn.addEventListener('click', () => removePerson(btn.dataset.removePerson))
  );

  // Step 4
  document.querySelectorAll('[data-ti]').forEach(btn =>
    btn.addEventListener('click', () => toggleAssignment(btn.dataset.ti, btn.dataset.tp))
  );
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

render();
