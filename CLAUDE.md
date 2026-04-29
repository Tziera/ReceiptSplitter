# Kvittodelare — PWA

## Projektbeskrivning
En PWA (Progressive Web App) för att fotografera kvitton och dela upp kostnader mellan flera personer. Appen ska fungera primärt på mobil.

## Teknikval
- **Frontend:** Vanilla HTML/CSS/JS eller React (välj det du känner dig bekväm med)
- **OCR/Bildtolkning:** Google Gemini Flash API (gratis nivå) via Google AI Studio
- **PWA:** Service Worker + Web App Manifest för installation på hemskärm

## Kärnfunktioner

### 1. Importera kvitton
- Användaren väljer en eller flera bilder från kamerarullen (eller tar en ny bild)
- Bilder visas som miniatyrer innan analys
- `<input type="file" accept="image/*" multiple>` — ingen live-kamera krävs

### 2. Bildtolkning med Gemini
- Bilderna skickas till Gemini Flash API
- Prompten ska be Gemini returnera en strukturerad JSON med varor och priser
- Exempel på önskat JSON-svar:
```json
{
  "items": [
    { "name": "Smör", "price": 80 },
    { "name": "Bröd", "price": 40 },
    { "name": "A-Fil", "price": 20 }
  ]
}
```
- Användaren ska kunna redigera namn och pris manuellt efter tolkning (OCR är aldrig perfekt)
- Användaren ska kunna lägga till och ta bort varor manuellt

### 3. Lägg till personer
- Användaren anger namn på de personer som ska dela (t.ex. J, A, L)
- Default: alla delar på alla varor
- Minst 2 personer krävs

### 4. Fördela kostnader
- För varje vara visas checkboxar eller toggles för varje person
- Default: alla bockar i för alla varor
- Användaren kan bocka ur enskilda personer per vara
- En vara kan inte ha noll personer

### 5. Summering
- Visar varje persons totalkostnad
- Uppdateras i realtid när man ändrar fördelningen
- Tydlig, lättläst layout

## UX-riktlinjer
- Mobilanpassad, touch-vänlig (stora knappar, tydliga ytor)
- Flöde: Importera bilder → Granska/redigera varor → Lägg till personer → Fördela → Summering
- Stega gärna upp i tydliga steg/screens snarare än en lång scrollsida

## API-nyckel
- Gemini API-nyckeln ska läsas från en `.env`-fil eller matas in av användaren i appen vid första start
- Spara nyckeln i `localStorage` så användaren inte behöver mata in den varje gång
- Dokumentera i README hur man skaffar en gratis nyckel via [Google AI Studio](https://ai.google.dev)

## Filstruktur (förslag)
```
/
├── index.html
├── manifest.json
├── service-worker.js
├── style.css
├── app.js (eller /src om React)
└── README.md
```

## README ska innehålla
1. Hur man skaffar Gemini API-nyckel (gratis via ai.google.dev)
2. Hur man kör appen lokalt
3. Hur man installerar den som PWA på mobilen
