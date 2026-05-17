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
const IMAGE_EXTS      = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];
const RECEIPTS_DIR    = path.join(__dirname, 'receipts');

// ─── API-anrop ────────────────────────────────────────────────────────────────

const SHARED_PROMPT = `Analysera kvittot i bilden. Extrahera alla enskilda varor, priser och rabatter.
Returnera ENBART giltig JSON utan kodblock, utan förklaringar:
{"items":[{"name":"Varunamn","price":12.50,"confidence":"high"}],"receipt_totals":[125.00]}
- price: tal med decimalpunkt
- confidence: "high"/"medium"/"low" — hur tydlig texten/siffran är i bilden
- Inkludera BARA enskilda varor och rabattrader — exkludera totalsummor, delsummor, momsrader
- Rabatter inkluderas med negativt price
- Om ett pris är oklart, uppskatta rimligt`;

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

function parseJson(text, label) {
  if (!text) throw new Error(`Tomt svar från ${label}`);
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Kunde inte tolka JSON från ${label}`);
    return JSON.parse(m[0]);
  }
}

// ─── Jämförelselogik ──────────────────────────────────────────────────────────

function normalize(name) {
  return String(name).toLowerCase().trim().replace(/\s+/g, ' ');
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

  const model = GEMINI_KEY ? 'Gemini 2.5 Flash' : 'Claude Haiku';
  console.log(`Kör ${jsonFiles.length} testfall mot ${model}…`);

  let passed = 0, failed = 0, skipped = 0;

  for (const jsonFile of jsonFiles) {
    const base     = path.basename(jsonFile, '.json');
    const expected = JSON.parse(fs.readFileSync(path.join(RECEIPTS_DIR, jsonFile), 'utf8'));

    // Hitta bildfil
    let imagePath = null, mime = 'image/jpeg';
    for (const ext of IMAGE_EXTS) {
      const cand = path.join(RECEIPTS_DIR, base + ext);
      if (fs.existsSync(cand)) {
        imagePath = cand;
        mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        break;
      }
    }

    if (!imagePath) {
      console.log(`\n── ${base} ${Y}⚠ SKIP${X} ── Ingen bild hittad (lägg till ${base}.jpg)`);
      skipped++;
      continue;
    }

    const b64 = fs.readFileSync(imagePath).toString('base64');

    try {
      const got        = GEMINI_KEY ? await callGemini(b64, mime) : await callClaude(b64, mime);
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
