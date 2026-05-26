'use strict';

const APP_VERSION = '1.3.0';

// ─── i18n ─────────────────────────────────────────────────────────────────────

const LANG = (navigator.language || '').startsWith('sv') ? 'sv' : 'en';

const STRINGS = {
  en: {
    appTitle: '🧾 Receipt Splitter',
    settingsTitle: 'API Key',
    step1Title: 'Import Receipts',
    step2Title: 'Review Items',
    step3Title: 'Add People',
    step4Title: 'Split Costs',
    step5Title: 'Summary',
    analyzeBtn: '✨ Analyze Receipt',
    step2Next: 'Add People →',
    step3Next: 'Split Costs →',
    step4Next: 'View Summary →',
    backBtn: '← Back',
    shareBtn: '📤 Share Summary',
    resetBtn: '🔄 Start Over',
    loadingDefault: 'Analyzing receipt with Gemini AI…<br>This takes a few seconds.',
    loadingAnalyzing: 'Analyzing receipts…',
    loadingAnalyzingBatch: ({ current, total }) => `Analyzing receipts… (${current}/${total})`,
    loadingGeminiRetry: ({ n }) => `Gemini: high demand — retrying in ${n} s…`,
    loadingRecheckReceipts: ({ n }) => `Rechecking ${n} receipt${n !== 1 ? 's' : ''}…`,
    loadingClaude: ({ n }) => `Trying Claude Haiku for ${n} receipt${n !== 1 ? 's' : ''}…`,
    errInvalidApiKey: 'Invalid API key. Check the key in settings.',
    errEmptyGemini: 'Empty response from Gemini.',
    errParseGemini: 'Could not parse the response from Gemini.',
    errFormatGemini: 'Unexpected format in response from Gemini.',
    errEmptyClaude: 'Empty response from Claude.',
    errParseClaude: 'Could not parse response from Claude.',
    errFormatClaude: 'Unexpected format from Claude.',
    errGeminiUnavailable: 'Gemini unavailable and no Claude key configured.',
    errNoApiKey: 'No API key configured.',
    errAtLeastOneKey: 'Enter at least one API key.',
    errGeminiQuota: 'Gemini quota exceeded and no Claude key configured.',
    errRerunFailed: ({ msg }) => `Re-analysis error: ${msg}`,
    errRerunClaudeFailed: ({ msg }) => `Re-analysis error with Claude: ${msg}`,
    fileDropText: 'Tap to select images',
    fileDropSub: 'Camera roll or take a new photo',
    imagesSelected: ({ n }) => `${n} image${n !== 1 ? 's' : ''} selected — tap to add more`,
    noItemsCard: 'No items — add manually below',
    noItemsForReceipt: 'No items for this receipt',
    addItemBtn: '+ Add Item',
    totalLine: ({ amount }) => `Total: ${amount} kr`,
    itemNamePlaceholder: 'Item name',
    unknownReceipt: 'Unknown Receipt',
    confBadgeLow: 'Uncertain',
    confBadgeMedium: 'Check',
    confBadgeLowTitle: 'Uncertain reading — please verify',
    confBadgeMediumTitle: 'Small price discrepancy between readings',
    rerunTitle: 'Re-run OCR for this receipt',
    rerunSpinnerTitle: 'Analyzing…',
    rghMismatch: ({ expected, found, diff }) => `${expected} kr expected · ${found} kr found · <strong>Diff: ${diff} kr</strong>`,
    rghOk: ({ amount }) => `${amount} kr · matches`,
    rghEnterTotal: ({ amount }) => `Items: ${amount} kr · Enter total:`,
    rchkNoTotal: 'No total found on the receipt',
    rchkVerifyAgainst: 'Verify against:',
    rchkTotalPlaceholder: '0.00',
    rchkOkTitle: 'Matches the receipt total',
    rchkOkSub: ({ receipt, items }) => `Receipt: ${receipt} kr · Found items: ${items} kr`,
    rchkUnderTitle: 'Possible items missing',
    rchkOverTitle: 'Items total more than the receipt',
    rchkReceiptTotal: 'Receipt total',
    rchkFoundItems: 'Found items',
    rchkDiff: 'Difference',
    rchkHintUnder: 'Some items may be missing, or a discount is not included as a separate line.',
    rchkHintOver: 'Check that discounts are included as separate lines with a negative price.',
    noPeopleYet: 'No people added yet',
    personNamePlaceholder: 'Name, e.g. Anna',
    minTwoPeople: 'At least 2 people required to split',
    step4Hint: 'Tap a name to include or exclude a person from an item.',
    cannotRemoveLast: 'Cannot remove the last person',
    perPerson: ({ price, share }) => `${price} kr · ${share} kr/person`,
    unnamedItem: 'Unnamed item',
    grandTotal: 'Total to pay',
    showDetails: 'Show details',
    shareText: ({ lines, total }) => `🧾 Receipt Split\n\n${lines}\n\nTotal: ${total} kr`,
    copied: '✓ Copied!',
    copyPrompt: 'Copy the text:',
    unknownItem: 'Unknown item',
    receiptName: ({ n }) => `Receipt ${n}`,
    apiSplashSub: 'Split receipt costs with AI',
    apiKeysTitle: 'API Keys',
    geminiLabel: 'Gemini 2.5 Flash',
    geminiTag: 'Free · Primary',
    geminiInfo: 'ai.google.dev → API Keys → Create API key',
    claudeLabel: 'Claude Haiku',
    claudeTag: 'Backup · ~0.02 kr/receipt',
    claudeInfo: 'console.anthropic.com → API Keys',
    saveAndContinue: 'Save and continue',
    cancel: 'Cancel',
    debugTitle: ({ model }) => `🔍 Debug info (${model})`,
    debugImages: 'Images',
    debugApiResponse: 'API Response',
    debugHeicWarning: 'HEIC – limited API support',
    debugError: ({ msg }) => `Error: ${msg}`,
    debugItems: ({ n }) => `${n} item${n !== 1 ? 's' : ''}`,
    debugShowRaw: 'Show raw JSON',
    debugExport: '💾 Save as test case',
    rerunNoTotal: 'No receipt total to compare against — enter the total manually and try again.',
    rerunNoImprovement: ({ model, newDiff, oldDiff }) => `Re-analysis (${model}): no improvement — diff ${newDiff} kr vs ${oldDiff} kr.`,
    rerunUpdated: ({ n, model, oldDiff, newDiff }) => `Receipt ${n} updated (${model}) — diff decreased from ${oldDiff} to ${newDiff} kr.`,
    ariaRemoveImage: 'Remove image',
    ariaRemoveItem: 'Remove',
    ariaRemovePerson: ({ name }) => `Remove ${name}`,
    ariaAddPerson: 'Add person',
    addItemNewReceipt: '+ Add to new receipt',
    linkImagesBtn: '🔗 Group images',
    linkConfirmBtn: ({ n }) => `Group ${n}`,
    unlinkImageBtn: 'Unlink',
    clearAllPeople: 'Clear all',
  },
  sv: {
    appTitle: '🧾 Kvittodelare',
    settingsTitle: 'API-nyckel',
    step1Title: 'Importera kvitton',
    step2Title: 'Granska varor',
    step3Title: 'Lägg till personer',
    step4Title: 'Fördela kostnader',
    step5Title: 'Summering',
    analyzeBtn: '✨ Analysera kvitto',
    step2Next: 'Lägg till personer →',
    step3Next: 'Fördela kostnader →',
    step4Next: 'Visa summering →',
    backBtn: '← Tillbaka',
    shareBtn: '📤 Dela summering',
    resetBtn: '🔄 Börja om',
    loadingDefault: 'Analyserar kvittot med Gemini AI…<br>Det tar några sekunder.',
    loadingAnalyzing: 'Analyserar kvitton…',
    loadingAnalyzingBatch: ({ current, total }) => `Analyserar kvitton… (${current}/${total})`,
    loadingGeminiRetry: ({ n }) => `Gemini: hög belastning — försöker om ${n} s…`,
    loadingRecheckReceipts: ({ n }) => `Kontrollerar ${n} kvitto${n > 1 ? 'n' : ''} igen…`,
    loadingClaude: ({ n }) => `Provar Claude Haiku för ${n} kvitto${n > 1 ? 'n' : ''}…`,
    errInvalidApiKey: 'Ogiltig API-nyckel. Kontrollera nyckeln i inställningarna.',
    errEmptyGemini: 'Tomt svar från Gemini.',
    errParseGemini: 'Kunde inte tolka svaret från Gemini.',
    errFormatGemini: 'Oväntat format i svar från Gemini.',
    errEmptyClaude: 'Tomt svar från Claude.',
    errParseClaude: 'Kunde inte tolka svar från Claude.',
    errFormatClaude: 'Oväntat format från Claude.',
    errGeminiUnavailable: 'Gemini otillgänglig och ingen Claude-nyckel konfigurerad.',
    errNoApiKey: 'Ingen API-nyckel konfigurerad.',
    errAtLeastOneKey: 'Ange minst en API-nyckel.',
    errGeminiQuota: 'Gemini-kvot slut och ingen Claude-nyckel konfigurerad.',
    errRerunFailed: ({ msg }) => `Fel vid omanalys: ${msg}`,
    errRerunClaudeFailed: ({ msg }) => `Fel vid omanalys med Claude: ${msg}`,
    fileDropText: 'Tryck för att välja bilder',
    fileDropSub: 'Kamerarulle eller ta ny bild',
    imagesSelected: ({ n }) => `${n} bild${n > 1 ? 'er' : ''} vald${n > 1 ? 'a' : ''} — klicka för att lägga till fler`,
    noItemsCard: 'Inga varor – lägg till manuellt nedan',
    noItemsForReceipt: 'Inga varor för detta kvitto',
    addItemBtn: '+ Lägg till vara',
    totalLine: ({ amount }) => `Totalt: ${amount} kr`,
    itemNamePlaceholder: 'Varunamn',
    unknownReceipt: 'Okänt kvitto',
    confBadgeLow: 'Osäker',
    confBadgeMedium: 'Kontrollera',
    confBadgeLowTitle: 'Osäker läsning — verifiera',
    confBadgeMediumTitle: 'Liten prisskillnad mellan tolkningarna',
    rerunTitle: 'Kör om OCR för detta kvitto',
    rerunSpinnerTitle: 'Analyserar…',
    rghMismatch: ({ expected, found, diff }) => `${expected} kr förväntat · ${found} kr funna · <strong>Diff: ${diff} kr</strong>`,
    rghOk: ({ amount }) => `${amount} kr · stämmer`,
    rghEnterTotal: ({ amount }) => `Varor: ${amount} kr · Ange total:`,
    rchkNoTotal: 'Ingen totalsumma hittades på kvittot',
    rchkVerifyAgainst: 'Verifiera mot:',
    rchkTotalPlaceholder: '0,00',
    rchkOkTitle: 'Stämmer med kvittots totalsumma',
    rchkOkSub: ({ receipt, items }) => `Kvitto: ${receipt} kr · Hittade varor: ${items} kr`,
    rchkUnderTitle: 'Möjliga varor saknas',
    rchkOverTitle: 'Varorna summerar mer än kvittot',
    rchkReceiptTotal: 'Kvittots totalsumma',
    rchkFoundItems: 'Hittade varor',
    rchkDiff: 'Differens',
    rchkHintUnder: 'Det kan saknas varor, eller en rabatt är ej inkluderad som en egen rad.',
    rchkHintOver: 'Kontrollera att rabatter är inkluderade som egna rader med negativt pris.',
    noPeopleYet: 'Inga personer tillagda ännu',
    personNamePlaceholder: 'Namn, t.ex. Anna',
    minTwoPeople: 'Minst 2 personer krävs för att dela',
    step4Hint: 'Tryck på ett namn för att inkludera eller exkludera en person från en vara.',
    cannotRemoveLast: 'Kan ej ta bort sista personen',
    perPerson: ({ price, share }) => `${price} kr · ${share} kr/pers`,
    unnamedItem: 'Namnlös vara',
    grandTotal: 'Totalt att betala',
    showDetails: 'Visa detaljer',
    shareText: ({ lines, total }) => `🧾 Kvittodelning\n\n${lines}\n\nTotalt: ${total} kr`,
    copied: '✓ Kopierat!',
    copyPrompt: 'Kopiera texten:',
    unknownItem: 'Okänd vara',
    receiptName: ({ n }) => `Kvitto ${n}`,
    apiSplashSub: 'Dela upp kvittokostnader med AI',
    apiKeysTitle: 'API-nycklar',
    geminiLabel: 'Gemini 2.5 Flash',
    geminiTag: 'Gratis · Primär',
    geminiInfo: 'ai.google.dev → API Keys → Create API key',
    claudeLabel: 'Claude Haiku',
    claudeTag: 'Reserv · ~0,02 kr/kvitto',
    claudeInfo: 'console.anthropic.com → API Keys',
    saveAndContinue: 'Spara och fortsätt',
    cancel: 'Avbryt',
    debugTitle: ({ model }) => `🔍 Diagnosinfo (${model})`,
    debugImages: 'Bilder',
    debugApiResponse: 'API-svar',
    debugHeicWarning: 'HEIC – begränsat API-stöd',
    debugError: ({ msg }) => `Fel: ${msg}`,
    debugItems: ({ n }) => `${n} vara${n !== 1 ? 'r' : ''}`,
    debugShowRaw: 'Visa rådata JSON',
    debugExport: '💾 Spara som testfall',
    rerunNoTotal: 'Ingen kvittototal att jämföra mot — ange totalen manuellt och försök igen.',
    rerunNoImprovement: ({ model, newDiff, oldDiff }) => `Omanalys (${model}): inget bättre resultat — diff ${newDiff} kr vs ${oldDiff} kr.`,
    rerunUpdated: ({ n, model, oldDiff, newDiff }) => `Kvitto ${n} uppdaterat (${model}) — diff minskade från ${oldDiff} till ${newDiff} kr.`,
    ariaRemoveImage: 'Ta bort bild',
    ariaRemoveItem: 'Ta bort',
    ariaRemovePerson: ({ name }) => `Ta bort ${name}`,
    ariaAddPerson: 'Lägg till person',
    addItemNewReceipt: '+ Lägg till i nytt kvitto',
    linkImagesBtn: '🔗 Gruppera bilder',
    linkConfirmBtn: ({ n }) => `Gruppera ${n}`,
    unlinkImageBtn: 'Dela upp',
    clearAllPeople: 'Rensa alla',
  },
};

function t(key, vars = {}) {
  const s = STRINGS[LANG]?.[key] ?? STRINGS.en?.[key] ?? key;
  return typeof s === 'function'
    ? s(vars)
    : Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);
}

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  step: 1,
  apiKey: localStorage.getItem('gemini_api_key') || '',
  claudeApiKey: localStorage.getItem('claude_api_key') || '',
  showApiKeyScreen: false,
  images: [],         // [{id, file, dataUrl}]
  items: [],          // [{id, name, price, confidence, receiptIdx}]
  receipts: [],       // [{name, total}] – one per receipt, total=null if not visible
  people: [],         // [{id, name}]
  assignments: {},    // {itemId: Set<personId>}
  loading: false,
  loadingMessage: '',
  error: null,
  debugData: null,
  rerunningReceiptIdx: null,
  rerunMessage: null, // {text, ok} or null
  imageGroups: [],      // string[][] — image IDs grouped by receipt
  linkingMode: false,
  linkSelection: new Set(),
};

if (!state.apiKey && !state.claudeApiKey) state.showApiKeyScreen = true;

let _nextId = 1;
const uid = () => String(_nextId++);

const SAVED_PEOPLE_KEY = 'saved_people';

function loadSavedPeople() {
  try {
    const raw = localStorage.getItem(SAVED_PEOPLE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(p => typeof p?.name === 'string' && p.name.trim())
      .map(p => ({ id: uid(), name: p.name.trim() }));
  } catch {
    return [];
  }
}

state.people = loadSavedPeople();

let _cancelRequested = false;

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
    if (res.status === 400 && msg.includes('API key')) throw new Error(t('errInvalidApiKey'));
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(t('errEmptyGemini'));

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(t('errParseGemini'));
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed.items)) throw new Error(t('errFormatGemini'));
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
  if (!text) throw new Error(t('errEmptyClaude'));

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(t('errParseClaude'));
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed.items)) throw new Error(t('errFormatClaude'));
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
      if (--pending === 0) {
        const newGroups = newImgs.map(img => [img.id]);
        setState({
          images: [...state.images, ...newImgs],
          imageGroups: [...state.imageGroups, ...newGroups],
          error: null,
        });
      }
    };
    reader.readAsDataURL(file);
  });
}

function removeImage(id) {
  const newGroups = state.imageGroups
    .map(g => g.filter(imgId => imgId !== id))
    .filter(g => g.length > 0);
  setState({
    images: state.images.filter(img => img.id !== id),
    imageGroups: newGroups,
    linkSelection: new Set([...state.linkSelection].filter(sid => sid !== id)),
  });
}

function rebuildImageGroups(assignments) {
  // assignments: Map<imgId → groupKey> — rebuilds groups ordered by first image appearance
  const groupMap = new Map();
  const seenGroups = [];
  for (const img of state.images) {
    const key = assignments.get(img.id) ?? img.id;
    if (!groupMap.has(key)) { groupMap.set(key, []); seenGroups.push(key); }
    groupMap.get(key).push(img.id);
  }
  return seenGroups.map(key => groupMap.get(key));
}

function toggleLinkSelection(imgId) {
  const sel = new Set(state.linkSelection);
  if (sel.has(imgId)) sel.delete(imgId); else sel.add(imgId);
  setState({ linkSelection: sel });
}

function linkImages() {
  if (state.linkSelection.size < 2) return;
  const assignments = new Map();
  for (const group of state.imageGroups) {
    for (const id of group) assignments.set(id, group[0]);
  }
  const firstSelected = state.images.find(img => state.linkSelection.has(img.id))?.id;
  if (!firstSelected) return;
  for (const id of state.linkSelection) assignments.set(id, firstSelected);
  setState({ imageGroups: rebuildImageGroups(assignments), linkingMode: false, linkSelection: new Set() });
}

function unlinkImage(imgId) {
  const assignments = new Map();
  for (const group of state.imageGroups) {
    for (const id of group) assignments.set(id, group[0]);
  }
  assignments.set(imgId, imgId);
  setState({ imageGroups: rebuildImageGroups(assignments) });
}

async function handleAnalyze() {
  if (!state.images.length) return;
  _cancelRequested = false;
  setState({ loading: true, error: null, loadingMessage: t('loadingAnalyzing') });

  const BATCH1 = 4;
  const BATCH2 = 2;
  const THRESHOLD = 1.0;

  // Use imageGroups if available, otherwise one group per image
  const groups = state.imageGroups.length > 0
    ? state.imageGroups
    : state.images.map(img => [img.id]);
  const G = groups.length;

  const imagesMeta = state.images.map(img => ({
    name: img.file.name, size: img.file.size, type: img.file.type || 'image/jpeg',
  }));

  const slots = Array.from({ length: G }, (_, i) => ({ i, items: [], total: null, model: null }));

  // Chunk group indices keeping total images per batch ≤ maxImages
  function chunkGroups(groupIdxs, maxImages) {
    const batches = [];
    let current = [];
    let count = 0;
    for (const gi of groupIdxs) {
      const n = groups[gi].length;
      if (current.length > 0 && count + n > maxImages) { batches.push(current); current = []; count = 0; }
      current.push(gi);
      count += n;
    }
    if (current.length) batches.push(current);
    return batches;
  }

  async function runBatch(groupIdxs, callFn, apiKey, modelName) {
    // Build flat image list and image-position → local group index mapping
    const batchImages = [];
    const posToLocalJ = [];
    for (let j = 0; j < groupIdxs.length; j++) {
      for (const imgId of groups[groupIdxs[j]]) {
        const img = state.images.find(i => i.id === imgId);
        if (img) { batchImages.push(img); posToLocalJ.push(j); }
      }
    }

    const raw = await callFn(batchImages, apiKey);

    for (const gi of groupIdxs) { slots[gi].items = []; slots[gi].total = null; slots[gi].model = modelName; }

    for (const it of (raw.items || [])) {
      const pos = typeof it.receipt_idx === 'number' ? it.receipt_idx : 0;
      const localJ = posToLocalJ[pos] ?? 0;
      const gi = groupIdxs[localJ];
      if (gi !== undefined) slots[gi].items.push({ ...it, receipt_idx: gi });
    }

    if (Array.isArray(raw.receipt_totals)) {
      const groupLastTotal = {};
      raw.receipt_totals.forEach((total, pos) => {
        if (total !== null && total !== undefined) {
          const localJ = posToLocalJ[pos];
          if (localJ !== undefined) groupLastTotal[localJ] = total;
        }
      });
      for (let j = 0; j < groupIdxs.length; j++) {
        if (groupLastTotal[j] !== undefined) slots[groupIdxs[j]].total = groupLastTotal[j];
      }
    }
  }

  const isMismatch = gi => {
    const { total, items } = slots[gi];
    if (total === null) return false;
    return Math.abs(items.reduce((s, it) => s + parsePrice(it.price), 0) - total) > THRESHOLD;
  };

  async function runGeminiBatch(groupIdxs, label) {
    const DELAYS = [5, 10, 20];
    for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
      try {
        if (label && attempt === 0) setState({ loadingMessage: label });
        await runBatch(groupIdxs, callGemini, state.apiKey, 'Gemini');
        return 'ok';
      } catch (e) {
        const isHighDemand = e.message.toLowerCase().includes('high demand');
        const isQuota = e.message.includes('429') || e.message.toLowerCase().includes('quota');
        if (isQuota) return 'quota';
        if (!isHighDemand || attempt === DELAYS.length) throw e;
        const d = DELAYS[attempt];
        for (let s = d; s > 0; s--) {
          if (_cancelRequested) return 'cancelled';
          setState({ loadingMessage: t('loadingGeminiRetry', { n: s }) });
          await sleep(1000);
        }
        if (_cancelRequested) return 'cancelled';
      }
    }
  }

  const toClaudeSet = new Set();

  if (state.apiKey) {
    const batches = chunkGroups(Array.from({ length: G }, (_, i) => i), BATCH1);
    let abortAt = batches.length;

    for (let bi = 0; bi < batches.length; bi++) {
      const label = batches.length > 1
        ? t('loadingAnalyzingBatch', { current: bi + 1, total: batches.length })
        : t('loadingAnalyzing');
      try {
        const result = await runGeminiBatch(batches[bi], label);
        if (result === 'cancelled') return;
        if (result === 'quota') { abortAt = bi; break; }
      } catch { abortAt = bi; break; }
    }
    if (_cancelRequested) return;
    batches.slice(abortAt).flat().forEach(gi => toClaudeSet.add(gi));

    const mismatched = Array.from({ length: G }, (_, i) => i)
      .filter(gi => !toClaudeSet.has(gi) && isMismatch(gi));

    if (mismatched.length) {
      setState({ loadingMessage: t('loadingRecheckReceipts', { n: mismatched.length }) });
      for (const batch of chunkGroups(mismatched, BATCH2)) {
        if (_cancelRequested) return;
        try {
          const result = await runGeminiBatch(batch, null);
          if (result === 'cancelled') return;
          if (result === 'quota') batch.forEach(gi => toClaudeSet.add(gi));
          else batch.filter(isMismatch).forEach(gi => toClaudeSet.add(gi));
        } catch { batch.forEach(gi => toClaudeSet.add(gi)); }
      }
    }
  } else {
    Array.from({ length: G }, (_, i) => i).forEach(gi => toClaudeSet.add(gi));
  }

  if (_cancelRequested) return;

  if (toClaudeSet.size > 0) {
    if (!state.claudeApiKey) {
      if (slots.every(s => !s.items.length)) {
        setState({ loading: false, loadingMessage: '', error: t('errGeminiUnavailable') });
        return;
      }
    } else {
      const claudeIdxs = [...toClaudeSet];
      setState({ loadingMessage: t('loadingClaude', { n: claudeIdxs.length }) });
      for (const batch of chunkGroups(claudeIdxs, BATCH2)) {
        if (_cancelRequested) return;
        try {
          await runBatch(batch, callClaude, state.claudeApiKey, 'Claude');
        } catch { /* slots remain empty — UI shows mismatch warning */ }
      }
    }
  }

  if (_cancelRequested) return;

  const allRawItems = slots.flatMap(s => s.items);
  const receipts = slots.map((s, i) => ({ name: t('receiptName', { n: i + 1 }), total: s.total }));
  if (!receipts.length) receipts.push({ name: t('receiptName', { n: 1 }), total: null });

  const items = allRawItems.map(it => ({
    id: uid(),
    name: String(it.name || t('unknownItem')).trim(),
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

  const groupImgIds = state.imageGroups[ri] || [];
  const groupImages = groupImgIds.map(id => state.images.find(img => img.id === id)).filter(Boolean);
  if (!groupImages.length) return;

  const currentTotal = state.receipts[ri]?.total ?? null;
  if (currentTotal === null) {
    setState({ rerunMessage: { text: t('rerunNoTotal'), ok: false } });
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
        newRaw = await callGemini(groupImages, state.apiKey);
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
    if (otherError) { setState({ rerunningReceiptIdx: null, error: t('errRerunFailed', { msg: otherError.message }) }); return; }
    if (quotaError) {
      if (!state.claudeApiKey) { setState({ rerunningReceiptIdx: null, error: t('errGeminiQuota') }); return; }
      try { newRaw = await callClaude(groupImages, state.claudeApiKey); usedModel = 'Claude'; }
      catch (e) { setState({ rerunningReceiptIdx: null, error: t('errRerunClaudeFailed', { msg: e.message }) }); return; }
    }
  } else if (state.claudeApiKey) {
    try { newRaw = await callClaude(groupImages, state.claudeApiKey); usedModel = 'Claude'; }
    catch (e) { setState({ rerunningReceiptIdx: null, error: t('errRerunFailed', { msg: e.message }) }); return; }
  } else {
    setState({ rerunningReceiptIdx: null, error: t('errNoApiKey') });
    return;
  }

  const newItems = (newRaw.items || []).map(it => ({
    id: uid(),
    name: String(it.name || t('unknownItem')).trim(),
    price: parsePrice(it.price),
    confidence: it.confidence || 'high',
    receiptIdx: ri,
  }));

  const newTotal = Array.isArray(newRaw.receipt_totals)
    ? (newRaw.receipt_totals.filter(v => v !== null && v !== undefined).pop() ?? null)
    : null;
  const newSum = newItems.reduce((s, it) => s + it.price, 0);
  const newDiff = Math.abs(newSum - currentTotal);

  if (newDiff >= currentDiff) {
    setState({
      rerunningReceiptIdx: null,
      rerunMessage: { text: t('rerunNoImprovement', { model: usedModel, newDiff: fmt(newDiff), oldDiff: fmt(currentDiff) }), ok: false },
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
    rerunMessage: { text: t('rerunUpdated', { n: ri + 1, model: usedModel, oldDiff: fmt(currentDiff), newDiff: fmt(newDiff) }), ok: true },
  });
  setTimeout(() => setState({ rerunMessage: null }), 4000);
}

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
    if (state.receipts[idx]) state.receipts[idx].name = input.value || t('receiptName', { n: idx + 1 });
  });
  document.querySelectorAll('[data-rcpt-total]').forEach(input => {
    const idx = +input.dataset.rcptTotal;
    if (state.receipts[idx]) {
      const v = parseFloat(input.value);
      state.receipts[idx].total = isNaN(v) ? null : v;
    }
  });
}

function addItem(receiptIdx) {
  collectItems();
  collectReceipts();
  const newId = uid();
  let targetIdx;
  if (receiptIdx !== undefined) {
    targetIdx = receiptIdx;
  } else {
    // Create a new standalone receipt (no associated image)
    state.receipts.push({ name: t('receiptName', { n: state.receipts.length + 1 }), total: null });
    targetIdx = state.receipts.length - 1;
  }
  setState({ items: [...state.items, { id: newId, name: '', price: 0, receiptIdx: targetIdx }] });
  setTimeout(() => document.querySelector(`[data-name-id="${newId}"]`)?.focus(), 50);
}

function removeItem(id) {
  collectItems();
  collectReceipts();
  const assignments = { ...state.assignments };
  delete assignments[id];
  setState({ items: state.items.filter(it => it.id !== id), assignments });
}

function savePeople(people) {
  localStorage.setItem(SAVED_PEOPLE_KEY, JSON.stringify(people.map(p => ({ name: p.name }))));
}

function addPerson(name) {
  const n = name.trim();
  if (!n) return;
  const people = [...state.people, { id: uid(), name: n }];
  savePeople(people);
  setState({ people });
}

function removePerson(id) {
  const people = state.people.filter(p => p.id !== id);
  savePeople(people);
  setState({ people, assignments: {} });
}

function clearAllPeople() {
  localStorage.removeItem(SAVED_PEOPLE_KEY);
  setState({ people: [], assignments: {} });
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
    if (set.size <= 1) return;
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
  const text = t('shareText', { lines, total: fmt(grand) });

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
    if (btn) { btn.textContent = t('copied'); btn.disabled = true; }
    setTimeout(() => render(), 2000);
  } catch {
    prompt(t('copyPrompt'), text);
  }
}

function saveApiKeys(geminiKey, claudeKey) {
  const g = geminiKey.trim();
  const c = claudeKey.trim();
  if (!g && !c) { alert(t('errAtLeastOneKey')); return; }
  if (g) localStorage.setItem('gemini_api_key', g); else localStorage.removeItem('gemini_api_key');
  if (c) localStorage.setItem('claude_api_key', c); else localStorage.removeItem('claude_api_key');
  setState({ apiKey: g, claudeApiKey: c, showApiKeyScreen: false, error: null });
}

function cancelAnalysis() {
  _cancelRequested = true;
  setState({ loading: false, loadingMessage: '' });
}

function reset() {
  _cancelRequested = false;
  Object.assign(state, {
    step: 1, images: [], items: [], receipts: [], people: loadSavedPeople(), assignments: {}, loading: false,
    loadingMessage: '', error: null, debugData: null, rerunningReceiptIdx: null, rerunMessage: null,
    imageGroups: [], linkingMode: false, linkSelection: new Set(),
  });
  render();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return LANG === 'sv' ? n.toFixed(2).replace('.', ',') : n.toFixed(2);
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
  else document.getElementById('cancel-analysis-btn')?.addEventListener('click', cancelAnalysis);
}

function renderHeader() {
  return `
    <header class="app-header">
      <h1>${t('appTitle')}</h1>
      <div class="header-right">
        <span class="app-version">v${APP_VERSION}</span>
        <button class="btn-icon" id="settings-btn" title="${t('settingsTitle')}">⚙️</button>
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
  const msg = state.loadingMessage || t('loadingDefault');
  return `<div class="loading-overlay">
    <div class="spinner"></div>
    <p class="loading-text">${msg}</p>
    <button class="btn btn-secondary btn-cancel-loading" id="cancel-analysis-btn">${t('cancel')}</button>
  </div>`;
}

function renderCurrentStep() {
  return [null, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5][state.step]?.() ?? '';
}

function renderActionBar() {
  let html = '<div class="action-bar">';

  if (state.step > 1 && state.step <= 5) {
    html += `<button class="btn btn-secondary" id="back-btn" style="padding:14px 16px">${t('backBtn')}</button>`;
  }

  switch (state.step) {
    case 1:
      html += `<button class="btn btn-primary" id="analyze-btn" ${!state.images.length ? 'disabled' : ''}>${t('analyzeBtn')}</button>`;
      break;
    case 2:
      html += `<button class="btn btn-primary" id="next-btn" ${!state.items.length ? 'disabled' : ''}>${t('step2Next')}</button>`;
      break;
    case 3:
      html += `<button class="btn btn-primary" id="next-btn" ${state.people.length < 2 ? 'disabled' : ''}>${t('step3Next')}</button>`;
      break;
    case 4:
      html += `<button class="btn btn-primary" id="next-btn">${t('step4Next')}</button>`;
      break;
    case 5:
      html += `<button class="btn btn-primary" id="share-btn">${t('shareBtn')}</button>`;
      break;
  }

  return html + '</div>';
}

// ─── Step renderers ───────────────────────────────────────────────────────────

function renderStep1() {
  const numImages = state.images.length;

  // Map imgId → group index
  const imgGroupIdx = new Map();
  state.imageGroups.forEach((g, gi) => g.forEach(id => imgGroupIdx.set(id, gi)));

  const thumbs = state.images.map(img => {
    const gi = imgGroupIdx.get(img.id);
    const isInGroup = gi !== undefined && (state.imageGroups[gi]?.length ?? 0) > 1;
    const isSelected = state.linkingMode && state.linkSelection.has(img.id);

    const groupBadge = isInGroup
      ? `<span class="img-group-badge" data-gi="${gi % 5}">🔗 ${gi + 1}<button class="img-unlink-btn" data-unlink="${img.id}" aria-label="${t('unlinkImageBtn')}">×</button></span>`
      : '';

    const selectMark = state.linkingMode
      ? `<div class="img-select-mark${isSelected ? ' selected' : ''}"></div>`
      : '';

    return `
      <div class="image-thumb-wrap${isSelected ? ' img-selected' : ''}"${state.linkingMode ? ` data-link-select="${img.id}"` : ''}>
        <img class="image-thumb" src="${img.dataUrl}" alt="Receipt">
        ${!state.linkingMode ? `<button class="image-thumb-remove" data-remove-img="${img.id}" aria-label="${t('ariaRemoveImage')}">×</button>` : ''}
        ${groupBadge}${selectMark}
      </div>`;
  }).join('');

  const linkBar = numImages >= 2 ? `
    <div class="link-bar">
      ${state.linkingMode
        ? `<button class="btn-link-cancel" id="link-cancel-btn">${t('cancel')}</button>
           ${state.linkSelection.size >= 2
             ? `<button class="btn-link-confirm" id="link-confirm-btn">${t('linkConfirmBtn', { n: state.linkSelection.size })}</button>`
             : `<span class="link-hint">${LANG === 'sv' ? 'Välj minst 2 bilder' : 'Select 2+ images'}</span>`}`
        : `<button class="btn-link" id="link-mode-btn">${t('linkImagesBtn')}</button>`}
    </div>` : '';

  return `
    <h2 class="section-title">${t('step1Title')}</h2>
    ${state.linkingMode
      ? `<div class="link-mode-hint"><span>📎</span><span>${LANG === 'sv' ? 'Tryck på bilderna som tillhör samma kvitto' : 'Tap the images that belong to the same receipt'}</span></div>`
      : `<label class="file-drop" for="file-input">
          <span class="file-drop-icon">📷</span>
          <span class="file-drop-text">${t('fileDropText')}</span>
          <span class="file-drop-sub">${t('fileDropSub')}</span>
        </label>
        <input type="file" id="file-input" accept="image/*" multiple style="display:none">`}
    ${numImages ? `<div class="image-grid">${thumbs}</div>` : ''}
    ${numImages && !state.linkingMode ? `<p class="hint">${t('imagesSelected', { n: numImages })}</p>` : ''}
    ${linkBar}`;
}

function renderItemRow(item, isWarned) {
  const conf = item.confidence || 'high';
  const confClass = conf !== 'high' ? ` item-row--conf-${conf}` : '';
  const confBadge = conf === 'low'
    ? `<span class="conf-badge conf-badge--low" title="${t('confBadgeLowTitle')}">${t('confBadgeLow')}</span>`
    : conf === 'medium'
    ? `<span class="conf-badge conf-badge--medium" title="${t('confBadgeMediumTitle')}">${t('confBadgeMedium')}</span>`
    : '';
  return `
    <div class="item-row${confClass}${isWarned ? ' item-row--warn' : ''}">
      <input class="item-name-input" type="text" value="${esc(item.name)}"
        data-name-id="${item.id}" placeholder="${t('itemNamePlaceholder')}" inputmode="text">
      <input class="item-price-input" type="number" value="${item.price || ''}"
        data-price-id="${item.id}" placeholder="0" step="0.01" inputmode="decimal">
      ${confBadge}
      <button class="btn btn-danger" data-remove-item="${item.id}" aria-label="${t('ariaRemoveItem')}">🗑</button>
    </div>`;
}

function renderReceiptGroupHeader(receipt, idx, itemSum, isMismatch) {
  const hasTotal = receipt.total !== null;
  const statusClass = !hasTotal ? 'rgh--unknown' : isMismatch ? 'rgh--warn' : 'rgh--ok';
  const icon = !hasTotal ? '❓' : isMismatch ? '⚠️' : '✓';

  let totalInfo;
  if (hasTotal) {
    const diff = itemSum - receipt.total;
    const diffStr = `${diff > 0 ? '+' : ''}${fmt(diff)}`;
    totalInfo = isMismatch
      ? t('rghMismatch', { expected: fmt(receipt.total), found: fmt(itemSum), diff: diffStr })
      : t('rghOk', { amount: fmt(receipt.total) });
  } else {
    totalInfo = `${t('rghEnterTotal', { amount: fmt(itemSum) })}
      <input class="rgh-total-input" type="number" data-rcpt-total="${idx}"
        value="${receipt.total !== null ? receipt.total : ''}" placeholder="?" step="0.01" inputmode="decimal"> kr`;
  }

  const isRerunning = state.rerunningReceiptIdx === idx;
  const canRerun = (state.imageGroups[idx]?.length > 0) && state.rerunningReceiptIdx === null && hasTotal;
  const rerunBtn = isRerunning
    ? `<span class="rgh-spinner" title="${t('rerunSpinnerTitle')}">⟳</span>`
    : `<button class="btn-rerun" data-rerun-idx="${idx}" ${!canRerun ? 'disabled' : ''} title="${t('rerunTitle')}">🔄</button>`;

  return `<div class="receipt-group-header ${statusClass}">
    <span class="rgh-icon">${icon}</span>
    <div class="rgh-content">
      <input class="rgh-name-input" type="text" value="${esc(receipt.name)}" data-rcpt-name="${idx}" placeholder="${t('receiptName', { n: idx + 1 })}">
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
        <div class="rchk-title">${t('rchkNoTotal')}</div>
        <div class="rchk-verify-row">
          <span>${t('rchkVerifyAgainst')}</span>
          <input class="rchk-total-input" type="number" data-rcpt-total="0"
            value="" placeholder="${t('rchkTotalPlaceholder')}" step="0.01" inputmode="decimal">
          <span>kr</span>
        </div>
      </div>
    </div>`;
  }

  const diff = itemSum - receipt.total;
  if (Math.abs(diff) <= TOLERANCE) {
    return `<div class="receipt-check receipt-check--ok">
      <span class="rchk-icon">✓</span>
      <div><div class="rchk-title">${t('rchkOkTitle')}</div>
      <div class="rchk-sub">${t('rchkOkSub', { receipt: fmt(receipt.total), items: fmt(itemSum) })}</div></div>
    </div>`;
  }

  const isUnder = diff < 0;
  return `<div class="receipt-check receipt-check--warn">
    <span class="rchk-icon">⚠️</span>
    <div class="rchk-body">
      <div class="rchk-title">${isUnder ? t('rchkUnderTitle') : t('rchkOverTitle')}</div>
      <table class="rchk-table">
        <tr><td>${t('rchkReceiptTotal')}</td><td>${fmt(receipt.total)} kr</td></tr>
        <tr><td>${t('rchkFoundItems')}</td><td>${fmt(itemSum)} kr</td></tr>
        <tr class="rchk-diff-row"><td>${t('rchkDiff')}</td><td>${diff > 0 ? '+' : ''}${fmt(diff)} kr</td></tr>
      </table>
      <div class="rchk-hint">${isUnder ? t('rchkHintUnder') : t('rchkHintOver')}</div>
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
      ? ` <span class="debug-tag debug-tag--warn">${t('debugHeicWarning')}</span>` : '';
    return `<div class="debug-img-row">
      <span class="debug-img-name">${esc(m.name)}</span>
      <span class="debug-img-detail">${esc(m.type)} · ${sizeStr}${heicTag}</span>
    </div>`;
  }).join('');

  const count = raw.items?.length;
  const total = raw.receipt_totals?.[0];
  const countStr = count != null ? t('debugItems', { n: count }) : '–';
  const summary = raw.error
    ? t('debugError', { msg: esc(raw.error) })
    : `${countStr}${total != null ? ' · ' + fmt(total) + ' kr' : ''}`;

  return `
    <details class="debug-panel">
      <summary>${t('debugTitle', { model: esc(model) })}</summary>
      <div class="debug-content">
        <div class="debug-section">
          <div class="debug-label">${t('debugImages')}</div>
          ${metaHtml}
        </div>
        <div class="debug-section">
          <div class="debug-label">${t('debugApiResponse')}</div>
          <div class="debug-call${raw.error ? ' debug-call--err' : ''}">
            <div>${summary}</div>
          </div>
        </div>
        <details class="debug-raw-wrap">
          <summary>${t('debugShowRaw')}</summary>
          <pre class="debug-raw">${esc(JSON.stringify(raw, null, 2))}</pre>
        </details>
        <button class="btn-debug-export" id="export-test-btn">${t('debugExport')}</button>
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

  const receiptItemSums = Array(Math.max(numReceipts, 1)).fill(0);
  for (const item of state.items) {
    const ri = Math.min(item.receiptIdx ?? 0, receiptItemSums.length - 1);
    receiptItemSums[ri] += item.price;
  }

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
      ${rows || `<p class="text-sec" style="padding:12px 14px">${t('noItemsCard')}</p>`}
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
          ${rows || `<p class="text-sec" style="padding:12px 14px">${t('noItemsForReceipt')}</p>`}
        </div>
        <button class="btn btn-add btn-add-in-receipt" data-add-item-to="${ri}">${t('addItemBtn')}</button>
      </div>`;
    }).join('');

    const orphans = state.items.filter(it => (it.receiptIdx ?? 0) >= numReceipts);
    if (orphans.length) {
      const rows = orphans.map(it => renderItemRow(it, false)).join('');
      itemsHtml += `<div class="receipt-group">
        <div class="receipt-group-header rgh--unknown"><span class="rgh-icon">❓</span><span>${t('unknownReceipt')}</span></div>
        <div class="card">${rows}</div>
      </div>`;
    }
  }

  const total = state.items.reduce((s, it) => s + it.price, 0);

  return `
    <h2 class="section-title">${t('step2Title')}</h2>
    ${state.rerunMessage ? `<div class="rerun-banner rerun-banner--${state.rerunMessage.ok ? 'ok' : 'warn'}">${esc(state.rerunMessage.text)}</div>` : ''}
    ${itemsHtml}
    ${state.items.length ? `<p class="total-line" id="total-display">${t('totalLine', { amount: fmt(total) })}</p>` : ''}
    ${numReceipts <= 1 ? renderReceiptCheck() : ''}
    ${numReceipts <= 1
      ? `<button class="btn btn-add" data-add-item-to="0">${t('addItemBtn')}</button>`
      : `<button class="btn btn-add" id="add-item-btn">${t('addItemNewReceipt')}</button>`}
    ${renderDebugPanel()}`;
}

function renderStep3() {
  const badges = state.people.map(p => `
    <div class="person-badge">
      ${esc(p.name)}
      <button data-remove-person="${p.id}" aria-label="${t('ariaRemovePerson', { name: esc(p.name) })}">×</button>
    </div>`).join('');

  return `
    <h2 class="section-title">${t('step3Title')}</h2>
    ${state.people.length
      ? `<div class="people-list">${badges}</div>
         <button class="btn-clear-people" id="clear-people-btn">${t('clearAllPeople')}</button>`
      : `<p class="text-sec" style="margin-bottom:16px">${t('noPeopleYet')}</p>`}
    <div class="add-person-row">
      <input class="add-person-input" type="text" id="person-input"
        placeholder="${t('personNamePlaceholder')}" maxlength="30" autocomplete="off">
      <button class="add-person-btn" id="add-person-btn" aria-label="${t('ariaAddPerson')}">+</button>
    </div>
    ${state.people.length < 2 ? `<p class="hint" style="margin-top:14px">${t('minTwoPeople')}</p>` : ''}`;
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
        ${isOnly ? `title="${t('cannotRemoveLast')}"` : ''}>${esc(p.name)}</button>`;
    }).join('');

    return `
      <div class="dist-item">
        <div class="dist-item-header">
          <span class="dist-item-name">${esc(item.name) || `<em>${t('unnamedItem')}</em>`}</span>
          <span class="dist-item-meta">${t('perPerson', { price: fmt(item.price), share })}</span>
        </div>
        <div class="dist-people">${toggles}</div>
      </div>`;
  }).join('');

  return `
    <h2 class="section-title">${t('step4Title')}</h2>
    <p class="text-sec" style="margin-bottom:14px">${t('step4Hint')}</p>
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
            <summary>${t('showDetails')}</summary>
            <div class="summary-items">${itemRows}</div>
          </details>` : ''}
      </div>`;
  }).join('');

  return `
    <h2 class="section-title">${t('step5Title')}</h2>
    <div class="summary-grand-total">
      <span>${t('grandTotal')}</span>
      <strong>${fmt(grand)} kr</strong>
    </div>
    ${cards}
    <button class="btn btn-secondary" id="reset-btn" style="margin-top:8px;width:100%">${t('resetBtn')}</button>`;
}

function renderApiKeyScreen() {
  const hasAny = state.apiKey || state.claudeApiKey;
  return `
    <div class="api-splash">
      <h1>${t('appTitle')}</h1>
      <p>${t('apiSplashSub')}</p>
    </div>
    <div class="api-key-body">
      <h2 class="section-title">${t('apiKeysTitle')}</h2>

      <div class="api-key-section">
        <div class="api-key-label">${t('geminiLabel')} <span class="api-key-tag">${t('geminiTag')}</span></div>
        <div class="api-key-info">${t('geminiInfo')}</div>
        <input class="api-key-input" type="text" id="gemini-key-input"
          placeholder="AIzaSy…" autocomplete="off" spellcheck="false"
          value="${esc(state.apiKey)}">
      </div>

      <div class="api-key-section">
        <div class="api-key-label">${t('claudeLabel')} <span class="api-key-tag">${t('claudeTag')}</span></div>
        <div class="api-key-info">${t('claudeInfo')}</div>
        <input class="api-key-input" type="text" id="claude-key-input"
          placeholder="sk-ant-…" autocomplete="off" spellcheck="false"
          value="${esc(state.claudeApiKey)}">
      </div>

      <button class="btn btn-primary" id="api-key-save-btn">${t('saveAndContinue')}</button>
      ${hasAny ? `<button class="btn btn-secondary" id="api-key-cancel-btn">${t('cancel')}</button>` : ''}
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

  // Step 1 — link mode
  el('link-mode-btn')?.addEventListener('click', () => setState({ linkingMode: true, linkSelection: new Set() }));
  el('link-cancel-btn')?.addEventListener('click', () => setState({ linkingMode: false, linkSelection: new Set() }));
  el('link-confirm-btn')?.addEventListener('click', linkImages);
  document.querySelectorAll('[data-link-select]').forEach(wrap =>
    wrap.addEventListener('click', () => toggleLinkSelection(wrap.dataset.linkSelect))
  );
  document.querySelectorAll('[data-unlink]').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); unlinkImage(btn.dataset.unlink); })
  );

  // Step 2 — delete uses pointerdown to fire before blur
  document.querySelectorAll('[data-remove-item]').forEach(btn =>
    btn.addEventListener('pointerdown', e => { e.preventDefault(); removeItem(btn.dataset.removeItem); })
  );
  // Per-receipt add item (single-receipt also uses data-add-item-to="0")
  document.querySelectorAll('[data-add-item-to]').forEach(btn =>
    btn.addEventListener('pointerdown', e => { e.preventDefault(); addItem(parseInt(btn.dataset.addItemTo, 10)); })
  );
  // Multi-receipt: add to new receipt
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
  el('clear-people-btn')?.addEventListener('click', clearAllPeople);

  // Step 4
  document.querySelectorAll('[data-ti]').forEach(btn =>
    btn.addEventListener('click', () => toggleAssignment(btn.dataset.ti, btn.dataset.tp))
  );
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

document.documentElement.lang = LANG;
document.title = LANG === 'sv' ? 'Kvittodelare' : 'Receipt Splitter';

render();
