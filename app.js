'use strict';

const APP_VERSION = '1.2.0';

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  step: 1,
  apiKey: localStorage.getItem('gemini_api_key') || '',
  claudeApiKey: localStorage.getItem('claude_api_key') || '',
  showApiKeyScreen: false,
  images: [],         // [{id, file, dataUrl}]
  items: [],          // [{id, name, price}]
  receipts: [],      // [{name, total}] – one per receipt, total=null if not visible
  people: [],         // [{id, name}]
  assignments: {},    // {itemId: Set<personId>}
  loading: false,
  loadingMessage: '',
  error: null,
  debugData: null,
  rerunningReceiptIdx: null,
  rerunMessage: null, // {text, ok} or null
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
  const prompt = `Analysera kvittot/kvittona i bilden/bilderna. Extrahera alla enskilda varor, priser och rabatter.
Returnera ENBART giltig JSON utan kodblock, utan förklaringar, precis i detta format:
{"items":[{"name":"Varunamn","price":12.50,"confidence":"high","receipt_idx":0}],"receipt_totals":[125.00]}
Regler:
- price ska vara ett tal (inte en sträng), med decimalpunkt
- confidence ska vara "high", "medium" eller "low" beroende på hur tydlig texten/siffran är i bilden
- Inkludera BARA enskilda varor och rabattrader i items – exkludera totalsummor, delsummor och momsrader
- Rabatter som visas som separata rader (t.ex. "Rabatt -10 kr") ska inkluderas med negativt price
- Bilderna är numrerade från 0 i den ordning de bifogas
- receipt_idx: 0-baserat heltal som anger vilken bild (i bifogningsordningen) varan hittades i
- receipt_totals: ett värde per bifogad bild i exakt bildordningen — slutbeloppet (efter rabatter) för den bildens kvitto, eller null om det inte syns
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
  return parsed;
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
    text: `Analysera kvittot/kvittona i bilderna. Extrahera alla enskilda varor, priser och rabatter.
Returnera ENBART giltig JSON utan kodblock:
{"items":[{"name":"Varunamn","price":12.50,"confidence":"high","receipt_idx":0}],"receipt_totals":[125.00]}
- price ska vara ett tal med decimalpunkt
- confidence ska vara "high", "medium" eller "low" beroende på hur tydlig texten/siffran är i bilden
- Inkludera BARA enskilda varor och rabattrader i items – exkludera totalsummor, delsummor och momsrader
- Rabatter som visas som separata rader inkluderas med negativt price
- Bilderna är numrerade från 0 i den ordning de bifogas
- receipt_idx: 0-baserat heltal för vilken bild (i bifogningsordningen) varan hittades i
- receipt_totals: ett värde per bifogad bild i exakt bildordningen, null om ej synlig
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
  return parsed;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

function handleImageFiles(files) {
  const arr = Array.from(files);
  if (!arr.length) return;
  let pending = arr.length;
  const newImgs = new Array(arr.length).fill(null);
  arr.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = e => {
      newImgs[idx] = { id: uid(), file, dataUrl: e.target.result };
      if (--pending === 0) setState({ images: [...state.images, ...newImgs], error: null });
    };
    reader.readAsDataURL(file);
  });
}

function removeImage(id) {
  setState({ images: state.images.filter(img => img.id !== id) });
}


async function handleAnalyze() {
  if (!state.images.length) return;
  setState({ loading: true, error: null, loadingMessage: 'Analyserar kvitton…' });

  const BATCH1 = 4;       // Fas 1: Gemini batchstorlek
  const BATCH2 = 2;       // Fas 2+: batchstorlek vid retry
  const THRESHOLD = 1.0;  // kr — tillåten diff mellan varorsumma och kvittots totalsumma
  const N = state.images.length;

  const imagesMeta = state.images.map(img => ({
    name: img.file.name, size: img.file.size, type: img.file.type || 'image/jpeg',
  }));

  // Ett slot per bild — fylls i allt eftersom
  const slots = Array.from({ length: N }, (_, i) => ({ i, items: [], total: null, model: null }));

  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  // Kör ett anrop och fyll relevanta slots. receipt_idx i svaret antas motsvara bildposition i batchen.
  async function runBatch(globalIdxs, callFn, apiKey, modelName) {
    const raw = await callFn(globalIdxs.map(i => state.images[i]), apiKey);
    for (let j = 0; j < globalIdxs.length; j++) {
      const gi = globalIdxs[j];
      slots[gi].items = (raw.items || [])
        .filter(it => (typeof it.receipt_idx === 'number' ? it.receipt_idx : 0) === j)
        .map(it => ({ ...it, receipt_idx: gi }));
      slots[gi].total = Array.isArray(raw.receipt_totals) ? (raw.receipt_totals[j] ?? null) : null;
      slots[gi].model = modelName;
    }
  }

  const isMismatch = gi => {
    const { total, items } = slots[gi];
    if (total === null) return false;
    return Math.abs(items.reduce((s, it) => s + parsePrice(it.price), 0) - total) > THRESHOLD;
  };

  // Kör Gemini-batch med retry vid hög belastning. Returnerar 'ok' eller 'quota', kastar vid annan fel.
  async function runGeminiBatch(globalIdxs, label) {
    const DELAYS = [5, 10, 20];
    for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
      try {
        if (label && attempt === 0) setState({ loadingMessage: label });
        await runBatch(globalIdxs, callGemini, state.apiKey, 'Gemini');
        return 'ok';
      } catch (e) {
        const isHighDemand = e.message.toLowerCase().includes('high demand');
        const isQuota = e.message.includes('429') || e.message.toLowerCase().includes('quota');
        if (isQuota) return 'quota';
        if (!isHighDemand || attempt === DELAYS.length) throw e;
        const d = DELAYS[attempt];
        for (let s = d; s > 0; s--) {
          setState({ loadingMessage: `Gemini: hög belastning — försöker om ${s} s…` });
          await sleep(1000);
        }
      }
    }
  }

  const toClaudeSet = new Set();

  // ── Fas 1: Gemini i batchar om BATCH1 ────────────────────────────────────────
  if (state.apiKey) {
    const batches = chunk(Array.from({ length: N }, (_, i) => i), BATCH1);
    let abortAt = batches.length;

    for (let bi = 0; bi < batches.length; bi++) {
      const label = batches.length > 1
        ? `Analyserar kvitton… (${bi + 1}/${batches.length})`
        : 'Analyserar kvitton…';
      try {
        if (await runGeminiBatch(batches[bi], label) === 'quota') { abortAt = bi; break; }
      } catch { abortAt = bi; break; }
    }
    batches.slice(abortAt).flat().forEach(gi => toClaudeSet.add(gi));

    // ── Fas 2: Gemini retry för mismatchar i batchar om BATCH2 ───────────────────
    const mismatched = Array.from({ length: N }, (_, i) => i)
      .filter(gi => !toClaudeSet.has(gi) && isMismatch(gi));

    if (mismatched.length) {
      setState({ loadingMessage: `Kontrollerar ${mismatched.length} kvitto${mismatched.length > 1 ? 'n' : ''} igen…` });
      for (const batch of chunk(mismatched, BATCH2)) {
        try {
          if (await runGeminiBatch(batch, null) === 'quota') batch.forEach(gi => toClaudeSet.add(gi));
          else batch.filter(isMismatch).forEach(gi => toClaudeSet.add(gi));
        } catch { batch.forEach(gi => toClaudeSet.add(gi)); }
      }
    }
  } else {
    Array.from({ length: N }, (_, i) => i).forEach(gi => toClaudeSet.add(gi));
  }

  // ── Fas 3: Claude för kvarvarande ────────────────────────────────────────────
  if (toClaudeSet.size > 0) {
    if (!state.claudeApiKey) {
      if (slots.every(s => !s.items.length)) {
        setState({ loading: false, loadingMessage: '', error: 'Gemini otillgänglig och ingen Claude-nyckel konfigurerad.' });
        return;
      }
      // Delvis resultat — fortsätt med vad vi har, tomma slots syns som tomma kvittogrupper
    } else {
      const claudeIdxs = [...toClaudeSet];
      setState({ loadingMessage: `Provar Claude Haiku för ${claudeIdxs.length} kvitto${claudeIdxs.length > 1 ? 'n' : ''}…` });
      for (const batch of chunk(claudeIdxs, BATCH2)) {
        try {
          await runBatch(batch, callClaude, state.claudeApiKey, 'Claude');
        } catch { /* slots förblir tomma — UI visar mismatch-varning */ }
      }
    }
  }

  // ── Kombinera alla slots ──────────────────────────────────────────────────────
  const allRawItems = slots.flatMap(s => s.items);
  const receipts = slots.map((s, i) => ({ name: `Kvitto ${i + 1}`, total: s.total }));
  if (!receipts.length) receipts.push({ name: 'Kvitto 1', total: null });

  const items = allRawItems.map(it => ({
    id: uid(),
    name: String(it.name || 'Okänd vara').trim(),
    price: parsePrice(it.price),
    confidence: it.confidence || 'high',
    receiptIdx: typeof it.receipt_idx === 'number' ? it.receipt_idx : 0,
  }));

  const modelsUsed = [...new Set(slots.map(s => s.model).filter(Boolean))].join(' + ') || 'Gemini';
  setState({
    loading: false, loadingMessage: '', items, receipts, step: 2,
    debugData: {
      imagesMeta,
      raw: { items: allRawItems, receipt_totals: slots.map(s => s.total) },
      model: modelsUsed,
    },
  });
}

async function reanalyzeReceipt(ri) {
  if (state.rerunningReceiptIdx !== null) return;
  collectItems();
  collectReceipts();

  const image = state.images[ri];
  if (!image) return;

  const currentTotal = state.receipts[ri]?.total ?? null;
  if (currentTotal === null) {
    setState({ rerunMessage: { text: 'Ingen kvittototal att jämföra mot — ange totalen manuellt och försök igen.', ok: false } });
    return;
  }

  const currentSum = state.items.filter(it => (it.receiptIdx ?? 0) === ri).reduce((s, it) => s + it.price, 0);
  const currentDiff = Math.abs(currentSum - currentTotal);

  setState({ rerunningReceiptIdx: ri, rerunMessage: null, error: null });

  let newRaw = null;
  let usedModel = null;

  if (state.apiKey) {
    const DELAYS = [5, 10, 20];
    let quotaError = false;
    let otherError = null;
    for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
      try {
        newRaw = await callGemini([image], state.apiKey);
        usedModel = 'Gemini';
        break;
      } catch (e) {
        const isQuota = e.message.includes('429') || e.message.toLowerCase().includes('quota');
        const isHighDemand = e.message.toLowerCase().includes('high demand');
        if (isQuota) { quotaError = true; break; }
        if (!isHighDemand || attempt === DELAYS.length) { otherError = e; break; }
        const d = DELAYS[attempt];
        for (let s = d; s > 0; s--) { setState({ rerunningReceiptIdx: ri }); await sleep(1000); }
      }
    }
    if (otherError) { setState({ rerunningReceiptIdx: null, error: `Fel vid omanalys: ${otherError.message}` }); return; }
    if (quotaError) {
      if (!state.claudeApiKey) { setState({ rerunningReceiptIdx: null, error: 'Gemini-kvot slut och ingen Claude-nyckel konfigurerad.' }); return; }
      try { newRaw = await callClaude([image], state.claudeApiKey); usedModel = 'Claude'; }
      catch (e) { setState({ rerunningReceiptIdx: null, error: `Fel vid omanalys med Claude: ${e.message}` }); return; }
    }
  } else if (state.claudeApiKey) {
    try { newRaw = await callClaude([image], state.claudeApiKey); usedModel = 'Claude'; }
    catch (e) { setState({ rerunningReceiptIdx: null, error: `Fel vid omanalys: ${e.message}` }); return; }
  } else {
    setState({ rerunningReceiptIdx: null, error: 'Ingen API-nyckel konfigurerad.' });
    return;
  }

  const newItems = (newRaw.items || [])
    .filter(it => (typeof it.receipt_idx === 'number' ? it.receipt_idx : 0) === 0)
    .map(it => ({
      id: uid(),
      name: String(it.name || 'Okänd vara').trim(),
      price: parsePrice(it.price),
      confidence: it.confidence || 'high',
      receiptIdx: ri,
    }));

  const newTotal = Array.isArray(newRaw.receipt_totals) ? (newRaw.receipt_totals[0] ?? null) : null;
  const newSum = newItems.reduce((s, it) => s + it.price, 0);
  const newDiff = Math.abs(newSum - currentTotal);

  if (newDiff >= currentDiff) {
    setState({
      rerunningReceiptIdx: null,
      rerunMessage: { text: `Omanalys (${usedModel}): inget bättre resultat — diff ${fmt(newDiff)} kr vs ${fmt(currentDiff)} kr.`, ok: false },
    });
    return;
  }

  const otherItems = state.items.filter(it => (it.receiptIdx ?? 0) !== ri);
  const updatedReceipts = [...state.receipts];
  if (newTotal !== null) updatedReceipts[ri] = { ...updatedReceipts[ri], total: newTotal };

  setState({
    items: [...otherItems, ...newItems],
    receipts: updatedReceipts,
    rerunningReceiptIdx: null,
    rerunMessage: { text: `Kvitto ${ri + 1} uppdaterat (${usedModel}) — diff minskade från ${fmt(currentDiff)} till ${fmt(newDiff)} kr.`, ok: true },
  });
  setTimeout(() => setState({ rerunMessage: null }), 4000);
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

function collectReceipts() {
  document.querySelectorAll('[data-rcpt-name]').forEach(input => {
    const idx = +input.dataset.rcptName;
    if (state.receipts[idx]) state.receipts[idx].name = input.value || `Kvitto ${idx + 1}`;
  });
  document.querySelectorAll('[data-rcpt-total]').forEach(input => {
    const idx = +input.dataset.rcptTotal;
    if (state.receipts[idx]) {
      const v = parseFloat(input.value);
      state.receipts[idx].total = isNaN(v) ? null : v;
    }
  });
}

function addItem() {
  collectItems();
  collectReceipts();
  const newId = uid();
  const lastReceiptIdx = Math.max(0, state.receipts.length - 1);
  setState({ items: [...state.items, { id: newId, name: '', price: 0, receiptIdx: lastReceiptIdx }] });
  setTimeout(() => {
    document.querySelector(`[data-name-id="${newId}"]`)?.focus();
  }, 50);
}

function removeItem(id) {
  collectItems();
  collectReceipts();
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
    step: 1, images: [], items: [], receipts: [], people: [], assignments: {}, loading: false,
    loadingMessage: '', error: null, debugData: null, rerunningReceiptIdx: null, rerunMessage: null,
  });
  render();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parsePrice(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).replace(',', '.');
  const neg = s.trimStart().startsWith('-');
  const abs = parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  return neg ? -abs : abs;
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
      <div class="header-right">
        <span class="app-version">v${APP_VERSION}</span>
        <button class="btn-icon" id="settings-btn" title="API-nyckel">⚙️</button>
      </div>
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

function renderItemRow(item, isWarned) {
  const conf = item.confidence || 'high';
  const confClass = conf !== 'high' ? ` item-row--conf-${conf}` : '';
  const confBadge = conf === 'low'
    ? `<span class="conf-badge conf-badge--low" title="Osäker läsning — verifiera">Osäker</span>`
    : conf === 'medium'
    ? `<span class="conf-badge conf-badge--medium" title="Liten prisskillnad mellan tolkningarna">Kontrollera</span>`
    : '';
  return `
    <div class="item-row${confClass}${isWarned ? ' item-row--warn' : ''}">
      <input class="item-name-input" type="text" value="${esc(item.name)}"
        data-name-id="${item.id}" placeholder="Varunamn" inputmode="text">
      <input class="item-price-input" type="number" value="${item.price || ''}"
        data-price-id="${item.id}" placeholder="0" step="0.01" inputmode="decimal">
      ${confBadge}
      <button class="btn btn-danger" data-remove-item="${item.id}" aria-label="Ta bort">🗑</button>
    </div>`;
}

function renderReceiptGroupHeader(receipt, idx, itemSum, isMismatch) {
  const hasTotal = receipt.total !== null;
  const statusClass = !hasTotal ? 'rgh--unknown' : isMismatch ? 'rgh--warn' : 'rgh--ok';
  const icon = !hasTotal ? '❓' : isMismatch ? '⚠️' : '✓';

  let totalInfo;
  if (hasTotal) {
    const diff = itemSum - receipt.total;
    totalInfo = isMismatch
      ? `${fmt(receipt.total)} kr förväntat · ${fmt(itemSum)} kr funna · <strong>Diff: ${diff > 0 ? '+' : ''}${fmt(diff)} kr</strong>`
      : `${fmt(receipt.total)} kr · stämmer`;
  } else {
    totalInfo = `Varor: ${fmt(itemSum)} kr · Ange total:
      <input class="rgh-total-input" type="number" data-rcpt-total="${idx}"
        value="${receipt.total !== null ? receipt.total : ''}" placeholder="?" step="0.01" inputmode="decimal"> kr`;
  }

  const isRerunning = state.rerunningReceiptIdx === idx;
  const canRerun = !!state.images[idx] && state.rerunningReceiptIdx === null && hasTotal;
  const rerunBtn = isRerunning
    ? `<span class="rgh-spinner" title="Analyserar…">⟳</span>`
    : `<button class="btn-rerun" data-rerun-idx="${idx}" ${!canRerun ? 'disabled' : ''} title="Kör om OCR för detta kvitto">🔄</button>`;

  return `<div class="receipt-group-header ${statusClass}">
    <span class="rgh-icon">${icon}</span>
    <div class="rgh-content">
      <input class="rgh-name-input" type="text" value="${esc(receipt.name)}" data-rcpt-name="${idx}" placeholder="Kvitto ${idx + 1}">
      <div class="rgh-info">${totalInfo}</div>
    </div>
    ${rerunBtn}
  </div>`;
}

function renderReceiptCheck() {
  if (!state.receipts.length) return '';
  const receipt = state.receipts[0];
  const itemSum = state.items.reduce((s, it) => s + it.price, 0);
  const TOLERANCE = 0.50;

  if (receipt.total === null) {
    return `<div class="receipt-check receipt-check--neutral">
      <span class="rchk-icon">ℹ️</span>
      <div class="rchk-body">
        <div class="rchk-title">Ingen totalsumma hittades på kvittot</div>
        <div class="rchk-verify-row">
          <span>Verifiera mot:</span>
          <input class="rchk-total-input" type="number" data-rcpt-total="0"
            value="" placeholder="0,00" step="0.01" inputmode="decimal">
          <span>kr</span>
        </div>
      </div>
    </div>`;
  }

  const diff = itemSum - receipt.total;
  if (Math.abs(diff) <= TOLERANCE) {
    return `<div class="receipt-check receipt-check--ok">
      <span class="rchk-icon">✓</span>
      <div><div class="rchk-title">Stämmer med kvittots totalsumma</div>
      <div class="rchk-sub">Kvitto: ${fmt(receipt.total)} kr · Hittade varor: ${fmt(itemSum)} kr</div></div>
    </div>`;
  }

  const isUnder = diff < 0;
  return `<div class="receipt-check receipt-check--warn">
    <span class="rchk-icon">⚠️</span>
    <div class="rchk-body">
      <div class="rchk-title">${isUnder ? 'Möjliga varor saknas' : 'Varorna summerar mer än kvittot'}</div>
      <table class="rchk-table">
        <tr><td>Kvittots totalsumma</td><td>${fmt(receipt.total)} kr</td></tr>
        <tr><td>Hittade varor</td><td>${fmt(itemSum)} kr</td></tr>
        <tr class="rchk-diff-row"><td>Differens</td><td>${diff > 0 ? '+' : ''}${fmt(diff)} kr</td></tr>
      </table>
      <div class="rchk-hint">${isUnder
        ? 'Det kan saknas varor, eller en rabatt är ej inkluderad som en egen rad.'
        : 'Kontrollera att rabatter är inkluderade som egna rader med negativt pris.'
      }</div>
    </div>
  </div>`;
}

function renderDebugPanel() {
  if (!state.debugData) return '';
  const { imagesMeta, raw, model } = state.debugData;

  const metaHtml = imagesMeta.map(m => {
    const sizeStr = m.size >= 1024 * 1024
      ? `${(m.size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(m.size / 1024)} KB`;
    const isHeic = /heic|heif/i.test(m.type) || /\.heic$/i.test(m.name);
    const heicTag = isHeic
      ? ` <span class="debug-tag debug-tag--warn">HEIC – begränsat API-stöd</span>` : '';
    return `<div class="debug-img-row">
      <span class="debug-img-name">${esc(m.name)}</span>
      <span class="debug-img-detail">${esc(m.type)} · ${sizeStr}${heicTag}</span>
    </div>`;
  }).join('');

  const count = raw.items?.length ?? '–';
  const total = raw.receipt_totals?.[0];
  const summary = raw.error
    ? `Fel: ${esc(raw.error)}`
    : `${count} varor${total != null ? ' · ' + total.toFixed(2) + ' kr' : ''}`;

  return `
    <details class="debug-panel">
      <summary>🔍 Diagnosinfo (${esc(model)})</summary>
      <div class="debug-content">
        <div class="debug-section">
          <div class="debug-label">Bilder</div>
          ${metaHtml}
        </div>
        <div class="debug-section">
          <div class="debug-label">API-svar</div>
          <div class="debug-call${raw.error ? ' debug-call--err' : ''}">
            <div>${summary}</div>
          </div>
        </div>
        <details class="debug-raw-wrap">
          <summary>Visa rådata JSON</summary>
          <pre class="debug-raw">${esc(JSON.stringify(raw, null, 2))}</pre>
        </details>
        <button class="btn-debug-export" id="export-test-btn">💾 Spara som testfall</button>
      </div>
    </details>`;
}

function exportTestCase() {
  collectItems();
  const items = state.items.map(it => ({ name: it.name.trim(), price: it.price }));
  const total = state.receipts[0]?.total ?? null;
  const data = total !== null ? { items, total } : { items };
  const json = JSON.stringify(data, null, 2);

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kvitto.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  state.images.forEach((img, i) => {
    const ext = img.file.name.includes('.') ? img.file.name.split('.').pop() : 'jpg';
    const name = state.images.length === 1 ? `kvitto.${ext}` : `kvitto_${i + 1}.${ext}`;
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = img.dataUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, (i + 1) * 300);
  });
}

function renderStep2() {
  const numReceipts = state.receipts.length;
  const TOLERANCE = 0.50;

  // Per-receipt item sums
  const receiptItemSums = Array(Math.max(numReceipts, 1)).fill(0);
  for (const item of state.items) {
    const ri = Math.min(item.receiptIdx ?? 0, receiptItemSums.length - 1);
    receiptItemSums[ri] += item.price;
  }

  // Which receipts mismatch?
  const mismatchedReceipts = new Set();
  state.receipts.forEach((r, i) => {
    if (r.total !== null && Math.abs((receiptItemSums[i] || 0) - r.total) > TOLERANCE) {
      mismatchedReceipts.add(i);
    }
  });

  let itemsHtml;
  if (numReceipts <= 1) {
    const warned = mismatchedReceipts.has(0);
    const rows = state.items.map(it => renderItemRow(it, warned)).join('');
    itemsHtml = `<div class="card">
      ${rows || '<p class="text-sec" style="padding:12px 14px">Inga varor – lägg till manuellt nedan</p>'}
    </div>`;
  } else {
    itemsHtml = state.receipts.map((r, ri) => {
      const receiptItems = state.items.filter(it => (it.receiptIdx ?? 0) === ri);
      const sum = receiptItemSums[ri] || 0;
      const isMismatch = mismatchedReceipts.has(ri);
      const rows = receiptItems.map(it => renderItemRow(it, isMismatch)).join('');
      return `<div class="receipt-group">
        ${renderReceiptGroupHeader(r, ri, sum, isMismatch)}
        <div class="card">
          ${rows || '<p class="text-sec" style="padding:12px 14px">Inga varor för detta kvitto</p>'}
        </div>
      </div>`;
    }).join('');

    // Items with receipt index outside known receipts
    const orphans = state.items.filter(it => (it.receiptIdx ?? 0) >= numReceipts);
    if (orphans.length) {
      const rows = orphans.map(it => renderItemRow(it, false)).join('');
      itemsHtml += `<div class="receipt-group">
        <div class="receipt-group-header rgh--unknown"><span class="rgh-icon">❓</span><span>Okänt kvitto</span></div>
        <div class="card">${rows}</div>
      </div>`;
    }
  }

  const total = state.items.reduce((s, it) => s + it.price, 0);

  return `
    <h2 class="section-title">Granska varor</h2>
    ${state.rerunMessage ? `<div class="rerun-banner rerun-banner--${state.rerunMessage.ok ? 'ok' : 'warn'}">${esc(state.rerunMessage.text)}</div>` : ''}
    ${itemsHtml}
    ${state.items.length ? `<p class="total-line" id="total-display">Totalt: <strong>${fmt(total)} kr</strong></p>` : ''}
    ${numReceipts <= 1 ? renderReceiptCheck() : ''}
    <button class="btn btn-add" id="add-item-btn">+ Lägg till vara</button>
    ${renderDebugPanel()}`;
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
    if (state.step === 2) { collectItems(); collectReceipts(); }
    setState({ step: state.step - 1, error: null });
  });

  el('next-btn')?.addEventListener('click', () => {
    if (state.step === 3) { initAssignments(); return; }
    if (state.step === 2) { collectItems(); collectReceipts(); }
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

  // Step 2 — receipt name/total inputs update validation on blur
  document.querySelectorAll('[data-rcpt-total], [data-rcpt-name]').forEach(input =>
    input.addEventListener('blur', () => { collectItems(); collectReceipts(); setState({}); })
  );
  document.querySelectorAll('[data-rerun-idx]').forEach(btn =>
    btn.addEventListener('click', () => reanalyzeReceipt(+btn.dataset.rerunIdx))
  );
  el('export-test-btn')?.addEventListener('click', exportTestCase);

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
