'use strict';

// Kör: node test/run.js
// Kräver Node 18+ (inbyggd fetch). API-nycklar läses från .env i projektets rot.

const fs   = require('fs');
const path = require('path');

// ─── Ladda .env ───────────────────────────────────────────────────────────────

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k]) process.env[k] = v;
    }
  });
}

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const CLAUDE_KEY = process.env.CLAUDE_API_KEY  || '';

if (!GEMINI_KEY && !CLAUDE_KEY) {
  console.error('Fel: Ange GEMINI_API_KEY eller CLAUDE_API_KEY i .env i projektets rot.');
  process.exit(1);
}

// ─── Konstanter ───────────────────────────────────────────────────────────────

const PRICE_TOLERANCE = 0.50;   // kr — tillåten prisskillnad för att räknas som "rätt"
const IMAGE_EXTS      = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const EXT_TO_MIME     = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' };
const RECEIPTS_DIR    = path.join(__dirname, 'receipts');
const DUAL            = process.argv.includes('--dual');
const MULTI           = process.argv.includes('--multi');
const USE_CLAUDE      = process.argv.includes('--claude');
const BATCH_TEST      = process.argv.includes('--batch');

// ─── API-anrop ────────────────────────────────────────────────────────────────

// Exakt samma prompt som app.js för att tester ska spegla verkligt appbeteende
const SHARED_PROMPT = `Analysera kvittot/kvittona i bilden/bilderna. Extrahera alla enskilda varor, priser och rabatter.
Returnera ENBART giltig JSON utan kodblock, utan förklaringar, precis i detta format:
{"items":[{"name":"Varunamn","price":12.50,"confidence":"high","receipt_idx":0}],"receipt_totals":[125.00]}
Regler:
- price ska vara ett tal (inte en sträng), med decimalpunkt
- confidence ska vara "high", "medium" eller "low" beroende på hur tydlig texten/siffran är i bilden
- Inkludera BARA enskilda varor och rabattrader i items – exkludera totalsummor, delsummor och momsrader
- Rabatter som visas som separata rader (t.ex. "Rabatt -10 kr") ska inkluderas med negativt price
- Bilderna är numrerade från 0 i den ordning de bifogas
- receipt_idx: 0-baserat heltal som anger vilken bild (i bifogningsordningen) varan hittades i
- receipt_totals: ett värde per bifogad bild i exakt bildordningen — slutbeloppet (efter rabatter) eller null om det inte syns
- Om ett pris är oklart, uppskatta rimligt`;

// Exakt samma prompt som app.js använder för Claude
const CLAUDE_PROMPT = `Analysera kvittot/kvittona i bilderna. Extrahera alla enskilda varor, priser och rabatter.
Returnera ENBART giltig JSON utan kodblock:
{"items":[{"name":"Varunamn","price":12.50,"confidence":"high","receipt_idx":0}],"receipt_totals":[125.00]}
- price ska vara ett tal med decimalpunkt
- confidence ska vara "high", "medium" eller "low" beroende på hur tydlig texten/siffran är i bilden
- Inkludera BARA enskilda varor och rabattrader i items – exkludera totalsummor, delsummor och momsrader
- Rabatter som visas som separata rader inkluderas med negativt price
- Bilderna är numrerade från 0 i den ordning de bifogas
- receipt_idx: 0-baserat heltal för vilken bild (i bifogningsordningen) varan hittades i
- receipt_totals: ett värde per bifogad bild i exakt bildordningen, null om ej synlig
- Om pris är oklart, uppskatta`;

async function callGemini(b64, mime) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: SHARED_PROMPT },
          { inline_data: { mime_type: mime, data: b64 } },
        ]}],
        generationConfig: { temperature: 0 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini HTTP ${res.status}`);
  }
  const data = await res.json();
  return parseJson(data.candidates?.[0]?.content?.parts?.[0]?.text, 'Gemini');
}

async function callClaude(b64, mime) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
        { type: 'text', text: SHARED_PROMPT },
      ]}],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude HTTP ${res.status}`);
  }
  const data = await res.json();
  return parseJson(data.content?.[0]?.text, 'Claude');
}

async function callGeminiMulti(images) {
  const parts = [{ text: SHARED_PROMPT }];
  for (const img of images) {
    parts.push({ inline_data: { mime_type: img.mime, data: img.b64 } });
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
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
    throw new Error(err.error?.message || `Gemini HTTP ${res.status}`);
  }
  const data = await res.json();
  return parseJson(data.candidates?.[0]?.content?.parts?.[0]?.text, 'Gemini');
}

async function callClaudeMulti(images) {
  if (!CLAUDE_KEY) throw new Error('CLAUDE_API_KEY saknas i .env');
  const content = [];
  for (const img of images) {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.b64 } });
  }
  content.push({ type: 'text', text: CLAUDE_PROMPT });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude HTTP ${res.status}`);
  }
  const data = await res.json();
  return parseJson(data.content?.[0]?.text, 'Claude');
}

function parseJson(text, label) {
  if (!text) throw new Error(`Tomt svar från ${label}`);
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Kunde inte tolka JSON från ${label}`);
    return JSON.parse(m[0]);
  }
}

// ─── Dual-call (speglar app.js analyzeWithDual + diffResults) ────────────────

function parsePrice(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).replace(',', '.');
  const neg = s.trimStart().startsWith('-');
  const abs = parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  return neg ? -abs : abs;
}

const CONF_RANK = { high: 2, medium: 1, low: 0 };
function worstConf(...confs) {
  const rank = Math.min(...confs.map(c => CONF_RANK[c] ?? 2));
  return ['low', 'medium', 'high'][rank];
}

function normName(name) {
  return String(name).toLowerCase().trim().replace(/\s+/g, ' ');
}

function mergeResults(rawA, rawB) {
  const itemsA = rawA.items || [];
  const itemsB = rawB.items || [];
  const usedB = new Set();
  const result = [];

  for (const a of itemsA) {
    const nA = normName(a.name);
    let bestJ = -1, best = 0;
    itemsB.forEach((b, j) => {
      if (usedB.has(j)) return;
      const nB = normName(b.name);
      const s = nA === nB ? 2 : (nA.includes(nB) || nB.includes(nA)) ? 1 : 0;
      if (s > best) { best = s; bestJ = j; }
    });
    if (bestJ >= 0) {
      const b = itemsB[bestJ];
      usedB.add(bestJ);
      const pa = parsePrice(a.price), pb = parsePrice(b.price);
      const diff = Math.abs(pa - pb);
      const diffConf = diff <= 0.50 ? 'high' : diff <= 5.00 ? 'medium' : 'low';
      result.push({
        name: a.name,
        price: pa,
        confidence: worstConf(diffConf, a.confidence || 'high', b.confidence || 'high'),
        receipt_idx: a.receipt_idx ?? 0,
      });
    } else {
      result.push({ name: a.name, price: parsePrice(a.price), confidence: 'low', receipt_idx: a.receipt_idx ?? 0 });
    }
  }
  itemsB.forEach((b, j) => {
    if (!usedB.has(j)) result.push({ name: b.name, price: parsePrice(b.price), confidence: 'low', receipt_idx: b.receipt_idx ?? 0 });
  });
  return { items: result, receipt_totals: rawA.receipt_totals ?? rawB.receipt_totals };
}

async function dualCall(callFn, b64, mime) {
  const [a, b] = await Promise.allSettled([callFn(b64, mime), callFn(b64, mime)]);
  if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
  if (a.status === 'fulfilled' && b.status === 'fulfilled') return mergeResults(a.value, b.value);
  const raw = (a.status === 'fulfilled' ? a : b).value;
  return { items: (raw.items || []).map(it => ({ ...it, confidence: 'medium' })), receipt_totals: raw.receipt_totals };
}

// ─── Jämförelselogik ──────────────────────────────────────────────────────────

function normalize(name) {
  return String(name).toLowerCase().replace(/[.:!?]/g, '').trim().replace(/\s+/g, ' ');
}

// Bigram-likhet 0–1 för fuzzy namnmatchning (stavfel, OCR-fel)
function bigramSim(a, b) {
  if (!a.length || !b.length) return 0;
  const bigrams = s => { const set = new Set(); for (let i = 0; i < s.length - 1; i++) set.add(s[i] + s[i+1]); return set; };
  const ba = bigrams(a), bb = bigrams(b);
  let inter = 0; ba.forEach(x => { if (bb.has(x)) inter++; });
  return inter / (ba.size + bb.size - inter || 1);
}

function compareResults(got, expected) {
  const gotItems  = got.items || [];
  const expItems  = expected.items || [];
  const matched   = new Set();
  const itemResults = [];

  for (const exp of expItems) {
    const normExp = normalize(exp.name);
    let best = null, bestScore = 0;

    for (const g of gotItems) {
      if (matched.has(g)) continue;
      const normG = normalize(g.name);
      const score = normExp === normG ? 2
                  : (normExp.includes(normG) || normG.includes(normExp)) ? 1
                  : bigramSim(normExp, normG) >= 0.5 ? 0.5
                  : 0;
      if (score > bestScore) { bestScore = score; best = g; }
    }

    if (best && bestScore > 0) {
      matched.add(best);
      const priceOk = Math.abs((best.price ?? 0) - exp.price) <= PRICE_TOLERANCE;
      itemResults.push({ status: priceOk ? 'ok' : 'wrong_price', expected: exp, got: best });
    } else {
      itemResults.push({ status: 'missing', expected: exp, got: null });
    }
  }

  for (const g of gotItems) {
    if (!matched.has(g)) itemResults.push({ status: 'extra', expected: null, got: g });
  }

  const gotTotal = (got.receipt_totals || [])[0] ?? null;
  const expTotal = expected.total ?? null;
  const totalOk  = expTotal == null || gotTotal == null
                 || Math.abs(gotTotal - expTotal) <= PRICE_TOLERANCE;

  return { itemResults, totalOk, gotTotal, expTotal };
}

// ─── Rapportering ─────────────────────────────────────────────────────────────

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', D = '\x1b[2m', X = '\x1b[0m';

function printReport(name, { itemResults, totalOk, gotTotal, expTotal }, verbose) {
  const ok         = itemResults.filter(r => r.status === 'ok');
  const wrongPrice = itemResults.filter(r => r.status === 'wrong_price');
  const missing    = itemResults.filter(r => r.status === 'missing');
  const extra      = itemResults.filter(r => r.status === 'extra');
  const allGood    = !wrongPrice.length && !missing.length && totalOk;

  console.log(`\n── ${name} ${allGood ? G + '✓' : R + '✗'}${X} ──`);
  console.log(`   Varor: ${G}${ok.length} ok${X}` +
    (wrongPrice.length ? `, ${R}${wrongPrice.length} fel pris${X}` : '') +
    (missing.length    ? `, ${R}${missing.length} saknas${X}` : '') +
    (extra.length      ? `, ${Y}${extra.length} extra${X}` : ''));

  if (verbose) {
    console.log(`   ${'─'.repeat(52)}`);
    for (const r of itemResults) {
      if (r.status === 'ok') {
        console.log(`   ${G}✓${X} ${r.expected.name.padEnd(30)} ${String(r.expected.price).padStart(7)} kr  conf: ${fmtConf(r.got.confidence)}`);
      } else if (r.status === 'wrong_price') {
        const diff = ((r.got.price ?? 0) - r.expected.price).toFixed(2);
        const sign = diff > 0 ? '+' : '';
        console.log(`   ${R}✗${X} ${r.expected.name.padEnd(30)} ${String(r.expected.price).padStart(7)} kr  →  AI: ${r.got.price} kr (${sign}${diff})  conf: ${fmtConf(r.got.confidence)}`);
        console.log(`     AI-namn: "${r.got.name}"`);
      } else if (r.status === 'missing') {
        console.log(`   ${R}–${X} ${r.expected.name.padEnd(30)} ${String(r.expected.price).padStart(7)} kr  SAKNAS`);
      } else if (r.status === 'extra') {
        console.log(`   ${Y}+${X} ${'(ej i facit)'.padEnd(30)} ${String(r.got.price).padStart(7)} kr  AI: "${r.got.name}"  conf: ${fmtConf(r.got.confidence)}`);
      }
    }
    console.log(`   ${'─'.repeat(52)}`);
  } else {
    for (const r of wrongPrice) {
      const diff = ((r.got.price ?? 0) - r.expected.price).toFixed(2);
      const sign = diff > 0 ? '+' : '';
      console.log(`   ${R}✗ Fel pris:${X} "${r.expected.name}"`);
      console.log(`       Förväntat ${r.expected.price} kr · Fick ${r.got.price} kr (${sign}${diff} kr) · Konfidens: ${fmtConf(r.got.confidence)}`);
    }
    for (const r of missing) {
      console.log(`   ${R}✗ Saknas:${X} "${r.expected.name}" (${r.expected.price} kr)`);
    }
    for (const r of extra) {
      console.log(`   ${Y}! Extra:${X}  "${r.got.name}" (${r.got.price} kr) · Konfidens: ${fmtConf(r.got.confidence)}`);
    }
  }

  if (expTotal != null) {
    const totalStr = `${expTotal} kr förväntat · ${gotTotal ?? '?'} kr fick`;
    console.log(`   Total: ${totalOk ? G + '✓' : R + '✗'}${X} ${totalStr}`);
  }

  // Konfidenskalibrering — var AI osäker på rätt saker?
  const lowConf      = itemResults.filter(r => r.got?.confidence === 'low');
  const lowConfWrong = lowConf.filter(r => r.status === 'wrong_price' || r.status === 'missing');
  const medConf      = itemResults.filter(r => r.got?.confidence === 'medium');
  const medConfWrong = medConf.filter(r => r.status === 'wrong_price');
  if (lowConf.length || medConf.length) {
    console.log(`   ${D}Konfidens: ${lowConf.length} low (${lowConfWrong.length} fel), ${medConf.length} medium (${medConfWrong.length} fel)${X}`);
  }
}

function fmtConf(c) {
  if (c === 'low')    return R + 'low'    + X;
  if (c === 'medium') return Y + 'medium' + X;
  return G + (c || 'high') + X;
}

// ─── Multi-receipt matchning ──────────────────────────────────────────────────

// Matcha Geminis receipt_idx-grupper mot facit via receipt_totals (primärt) eller item-summa (fallback)
function matchGroups(raw, expectedList) {
  const itemsByIdx = new Map();
  for (const item of (raw.items || [])) {
    const idx = typeof item.receipt_idx === 'number' ? item.receipt_idx : 0;
    if (!itemsByIdx.has(idx)) itemsByIdx.set(idx, []);
    itemsByIdx.get(idx).push(item);
  }

  const gotEntries = [...itemsByIdx.entries()].map(([idx, items]) => {
    const itemSum = items.reduce((s, it) => s + parsePrice(it.price), 0);
    const reportedTotal = Array.isArray(raw.receipt_totals) ? (raw.receipt_totals[idx] ?? null) : null;
    return { idx, items, itemSum, reportedTotal, matched: null };
  });

  const expEntries = expectedList.map(e => ({ ...e, used: false }));

  for (const got of gotEntries) {
    let bestExp = null, bestDiff = Infinity;
    // Primärt: matcha mot Geminis rapporterade receipt_totals[idx]
    const matchVal = got.reportedTotal ?? got.itemSum;
    for (const exp of expEntries) {
      if (exp.used || exp.expected.total == null) continue;
      const diff = Math.abs(matchVal - exp.expected.total);
      if (diff < bestDiff) { bestDiff = diff; bestExp = exp; }
    }
    if (bestExp) { bestExp.used = true; got.matched = bestExp; }
  }

  return { gotEntries, itemsByIdx };
}

async function runMultiTest(jsonFiles, verbose) {
  const modelName = USE_CLAUDE ? 'Claude Haiku' : 'Gemini 2.5 Flash';
  console.log(`\n${'═'.repeat(52)}`);
  console.log(`Multi-receipt — alla bilder i ett enda API-anrop (${modelName})`);
  console.log('═'.repeat(52));

  const expectedList = [];
  const images = [];

  for (const jsonFile of jsonFiles) {
    const base = path.basename(jsonFile, '.json');
    const expected = JSON.parse(fs.readFileSync(path.join(RECEIPTS_DIR, jsonFile), 'utf8'));

    let imagePath = null, mime = 'image/jpeg';
    for (const ext of IMAGE_EXTS) {
      const cand = path.join(RECEIPTS_DIR, base + ext);
      if (fs.existsSync(cand)) { imagePath = cand; mime = EXT_TO_MIME[ext] || 'image/jpeg'; break; }
    }
    if (!imagePath) { console.log(`${Y}⚠ Hoppar ${base} — ingen bild hittad${X}`); continue; }

    images.push({ b64: fs.readFileSync(imagePath).toString('base64'), mime, name: base });
    expectedList.push({ base, expected });
  }

  console.log(`\nSkickar ${images.length} bilder: ${images.map(i => i.name).join(', ')}`);

  try {
    const raw = USE_CLAUDE ? await callClaudeMulti(images) : await callGeminiMulti(images);
    const totalItems = raw.items?.length ?? 0;
    const idxSet = new Set((raw.items || []).map(it => typeof it.receipt_idx === 'number' ? it.receipt_idx : 0));
    const numGroups = idxSet.size;

    console.log(`Gemini returnerade ${totalItems} varor i ${numGroups} grupp${numGroups !== 1 ? 'er' : ''} ` +
      `(receipt_idx: ${[...idxSet].sort((a,b)=>a-b).join(', ')})`);
    if (raw.receipt_totals?.length) {
      console.log(`Gemini receipt_totals: [${raw.receipt_totals.map(t => t === null ? 'null' : t).join(', ')}]`);
    }

    const { gotEntries } = matchGroups(raw, expectedList);

    console.log(`\nMatchning Gemini → Facit:`);
    const PAD = 14;
    for (const got of gotEntries.sort((a, b) => a.idx - b.idx)) {
      const matchLabel = got.matched ? got.matched.base : `${R}ingen matchning${X}`;
      const geminiVal  = (got.reportedTotal ?? got.itemSum).toFixed(2);
      const facitVal   = got.matched?.expected?.total != null ? got.matched.expected.total.toFixed(2) : '?';
      const diff       = got.matched?.expected?.total != null
        ? Math.abs((got.reportedTotal ?? got.itemSum) - got.matched.expected.total)
        : Infinity;
      const sign       = diff <= PRICE_TOLERANCE ? G + '✓' + X : R + '✗' + X;
      console.log(`   receipt_idx ${got.idx}  →  ${matchLabel.padEnd(PAD)}` +
        `  Gemini: ${geminiVal.padStart(7)} kr · Facit: ${facitVal.padStart(7)} kr  ${sign}`);
    }

    let passed = 0, failed = 0;
    for (const got of gotEntries) {
      if (!got.matched) { failed++; continue; }
      const gotFormatted = {
        items: got.items,
        receipt_totals: [got.reportedTotal ?? got.itemSum],
      };
      const comparison = compareResults(gotFormatted, got.matched.expected);
      printReport(`${got.matched.base} [receipt_idx ${got.idx}]`, comparison, verbose);
      const allGood = comparison.itemResults.filter(r => r.status !== 'ok' && r.status !== 'extra').length === 0
                   && comparison.totalOk;
      if (allGood) passed++; else failed++;
    }

    for (const exp of expectedList) {
      if (!gotEntries.some(g => g.matched?.base === exp.base)) {
        console.log(`\n── ${exp.base} ${R}✗${X} ── Ingen Gemini-grupp matchade detta kvitto`);
        failed++;
      }
    }

    console.log(`\n${'═'.repeat(52)}`);
    console.log(`Multi-result: ${G}${passed} godkända${X}  ${failed ? R : ''}${failed} misslyckade${X}`);
    return { passed, failed };

  } catch (e) {
    console.log(`\n${R}ERROR${X} — ${e.message}`);
    return { passed: 0, failed: 1 };
  }
}

// ─── Batch-test (speglar handleAnalyze i app.js) ─────────────────────────────

async function runBatchTest(jsonFiles, verbose) {
  const BATCH1 = 4;
  const BATCH2 = 2;
  const THRESHOLD = 1.0;

  // Ladda alla testfall
  const cases = [];
  for (const jsonFile of jsonFiles) {
    const base = path.basename(jsonFile, '.json');
    const expected = JSON.parse(fs.readFileSync(path.join(RECEIPTS_DIR, jsonFile), 'utf8'));
    let imagePath = null, mime = 'image/jpeg';
    for (const ext of IMAGE_EXTS) {
      const cand = path.join(RECEIPTS_DIR, base + ext);
      if (fs.existsSync(cand)) { imagePath = cand; mime = EXT_TO_MIME[ext] || 'image/jpeg'; break; }
    }
    if (!imagePath) { console.log(`${Y}⚠ Hoppar ${base} — ingen bild${X}`); continue; }
    cases.push({ base, expected, b64: fs.readFileSync(imagePath).toString('base64'), mime });
  }

  const N = cases.length;
  const slots = Array.from({ length: N }, (_, i) => ({ i, items: [], total: null, model: '–' }));

  const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

  async function runBatch(globalIdxs, modelKey) {
    const imgs = globalIdxs.map(i => ({ b64: cases[i].b64, mime: cases[i].mime }));
    const raw = modelKey === 'claude' ? await callClaudeMulti(imgs) : await callGeminiMulti(imgs);
    for (let j = 0; j < globalIdxs.length; j++) {
      const gi = globalIdxs[j];
      slots[gi].items = (raw.items || [])
        .filter(it => (typeof it.receipt_idx === 'number' ? it.receipt_idx : 0) === j)
        .map(it => ({ ...it, receipt_idx: gi }));
      slots[gi].total = Array.isArray(raw.receipt_totals) ? (raw.receipt_totals[j] ?? null) : null;
      slots[gi].model = modelKey === 'claude' ? 'Claude' : 'Gemini';
    }
  }

  const isMismatch = gi => {
    const { total, items } = slots[gi];
    if (total === null) return false;
    return Math.abs(items.reduce((s, it) => s + parsePrice(it.price), 0) - total) > THRESHOLD;
  };

  const label = idxs => idxs.map(i => cases[i].base).join(', ');
  const toClaudeSet = new Set();

  console.log(`\n${'═'.repeat(52)}`);
  console.log('Batch-test — speglar app.js handleAnalyze-flödet');
  console.log('═'.repeat(52));

  // ── Fas 1: Gemini, batch om BATCH1 ───────────────────────────────────────────
  if (GEMINI_KEY) {
    const batches = chunk(Array.from({ length: N }, (_, i) => i), BATCH1);
    console.log(`\nFas 1 — Gemini, batch om ${BATCH1} (${batches.length} anrop)`);
    let abortAt = batches.length;

    for (let bi = 0; bi < batches.length; bi++) {
      if (bi > 0) await new Promise(r => setTimeout(r, 2000));
      process.stdout.write(`  [${label(batches[bi])}] … `);
      try {
        await runBatch(batches[bi], 'gemini');
        const mm = batches[bi].filter(isMismatch);
        console.log(mm.length ? `${Y}${mm.length} mismatch: ${label(mm)}${X}` : `${G}ok${X}`);
      } catch (e) {
        const isQuota = e.message.includes('429') || e.message.toLowerCase().includes('quota');
        console.log(`${R}${isQuota ? 'quota' : 'fel'}: ${e.message}${X}`);
        abortAt = bi; break;
      }
    }
    batches.slice(abortAt).flat().forEach(gi => toClaudeSet.add(gi));

    // ── Fas 2: Gemini retry för mismatchar ────────────────────────────────────
    const mismatched = Array.from({ length: N }, (_, i) => i).filter(gi => !toClaudeSet.has(gi) && isMismatch(gi));
    if (mismatched.length) {
      console.log(`\nFas 2 — Gemini retry, batch om ${BATCH2} (${mismatched.length} kvitton)`);
      for (const batch of chunk(mismatched, BATCH2)) {
        await new Promise(r => setTimeout(r, 2000));
        process.stdout.write(`  [${label(batch)}] … `);
        try {
          await runBatch(batch, 'gemini');
          const stillMm = batch.filter(isMismatch);
          if (stillMm.length) {
            console.log(`${Y}fortfarande mismatch: ${label(stillMm)} → Claude${X}`);
            stillMm.forEach(gi => toClaudeSet.add(gi));
          } else {
            console.log(`${G}ok${X}`);
          }
        } catch (e) {
          console.log(`${R}fel → Claude${X}`);
          batch.forEach(gi => toClaudeSet.add(gi));
        }
      }
    }
  } else {
    Array.from({ length: N }, (_, i) => i).forEach(gi => toClaudeSet.add(gi));
  }

  // ── Fas 3: Claude ─────────────────────────────────────────────────────────
  if (toClaudeSet.size > 0) {
    if (!CLAUDE_KEY) {
      console.log(`\n${Y}Fas 3 — ingen Claude-nyckel, ${toClaudeSet.size} kvitton saknar resultat${X}`);
    } else {
      const claudeIdxs = [...toClaudeSet];
      console.log(`\nFas 3 — Claude Haiku, batch om ${BATCH2} (${claudeIdxs.length} kvitton)`);
      for (const batch of chunk(claudeIdxs, BATCH2)) {
        await new Promise(r => setTimeout(r, 1500));
        process.stdout.write(`  [${label(batch)}] … `);
        try {
          await runBatch(batch, 'claude');
          console.log(`${G}ok${X}`);
        } catch (e) {
          console.log(`${R}fel: ${e.message}${X}`);
        }
      }
    }
  }

  // ── Resultat per kvitto ───────────────────────────────────────────────────
  let passed = 0, failed = 0;
  for (let gi = 0; gi < N; gi++) {
    const comparison = compareResults(
      { items: slots[gi].items, receipt_totals: [slots[gi].total] },
      cases[gi].expected,
    );
    printReport(`${cases[gi].base} [${slots[gi].model}]`, comparison, verbose);
    const allGood = comparison.itemResults.filter(r => r.status !== 'ok' && r.status !== 'extra').length === 0
                 && comparison.totalOk;
    if (allGood) passed++; else failed++;
  }

  console.log(`\n${'═'.repeat(52)}`);
  console.log(`Batch-result: ${G}${passed} godkända${X}  ${failed ? R : ''}${failed} misslyckade${X}`);
}

// ─── Huvudloop ────────────────────────────────────────────────────────────────

async function run() {
  const verbose  = process.argv.includes('--verbose') || process.argv.includes('-v');
  const jsonFiles = fs.readdirSync(RECEIPTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (!jsonFiles.length) {
    console.log('Inga testfall hittades i test/receipts/ (lägg till kvittoX.json + kvittoX.jpg)');
    return;
  }

  if (MULTI) {
    if (USE_CLAUDE && !CLAUDE_KEY) { console.error('--claude kräver CLAUDE_API_KEY i .env'); process.exit(1); }
    if (!USE_CLAUDE && !GEMINI_KEY) { console.error('--multi kräver GEMINI_API_KEY (eller lägg till --claude)'); process.exit(1); }
    await runMultiTest(jsonFiles, verbose);
    return;
  }

  if (BATCH_TEST) {
    await runBatchTest(jsonFiles, verbose);
    return;
  }

  const model = GEMINI_KEY ? 'Gemini 2.5 Flash' : 'Claude Haiku';
  console.log(`Kör ${jsonFiles.length} testfall mot ${model}${DUAL ? ' (dual-call)' : ''}…`);

  let passed = 0, failed = 0, skipped = 0, testIdx = 0;

  for (const jsonFile of jsonFiles) {
    const base     = path.basename(jsonFile, '.json');
    const expected = JSON.parse(fs.readFileSync(path.join(RECEIPTS_DIR, jsonFile), 'utf8'));

    // Hitta bildfil
    let imagePath = null, mime = 'image/jpeg';
    for (const ext of IMAGE_EXTS) {
      const cand = path.join(RECEIPTS_DIR, base + ext);
      if (fs.existsSync(cand)) {
        imagePath = cand;
        mime = EXT_TO_MIME[ext] || 'image/jpeg';
        break;
      }
    }

    if (!imagePath) {
      console.log(`\n── ${base} ${Y}⚠ SKIP${X} ── Ingen bild hittad (lägg till ${base}.jpg)`);
      skipped++;
      continue;
    }

    const b64 = fs.readFileSync(imagePath).toString('base64');

    if (testIdx++ > 0) await new Promise(r => setTimeout(r, DUAL ? 4000 : 1500));
    try {
      const callFn     = GEMINI_KEY ? callGemini : callClaude;
      const got        = DUAL ? await dualCall(callFn, b64, mime) : await callFn(b64, mime);
      const comparison = compareResults(got, expected);
      printReport(base, comparison, verbose);

      const allGood = comparison.itemResults.filter(r => r.status !== 'ok' && r.status !== 'extra').length === 0
                   && comparison.totalOk;
      if (allGood) passed++; else failed++;
    } catch (e) {
      console.log(`\n── ${base} ${R}ERROR${X} ── ${e.message}`);
      failed++;
    }
  }

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`${G}${passed} godkända${X}  ${failed ? R : ''}${failed} misslyckade${X}  ${skipped ? Y : ''}${skipped} hoppade över${X}`);
}

run().catch(err => { console.error(err); process.exit(1); });
