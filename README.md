# Kvittodelare

PWA för att fotografera kvitton och dela upp kostnader mellan flera personer med hjälp av Google Gemini AI.

## Skaffa en gratis Gemini API-nyckel

1. Gå till [Google AI Studio](https://ai.google.dev)
2. Logga in med ditt Google-konto
3. Klicka på **API Keys** i vänstermenyn
4. Klicka **Create API key** och välj ett projekt (eller skapa ett nytt)
5. Kopiera nyckeln (börjar med `AIzaSy…`)

Gratis-nivån ger ~15 requests/minut och 1 500 requests/dag — mer än tillräckligt för privat bruk.

## Kör lokalt

Appen är en ren statisk HTML/CSS/JS-app utan byggsteg.

### Alternativ 1 — Node.js (rekommenderas, krävs för PWA-installation)

```bash
npx serve .
# Öppna http://localhost:3000
```

### Alternativ 2 — Python

```bash
python -m http.server 8080
# Öppna http://localhost:8080
```

### Alternativ 3 — VS Code

Installera tillägget **Live Server** och klicka **Go Live**.

> **Obs:** Öppnar du `index.html` direkt som fil (`file://`) fungerar Service Worker inte och appen kan inte installeras som PWA.

## Installera som PWA på mobilen

Appen måste köras via HTTPS för att kunna installeras på hemskärmen.

### Android (Chrome)

1. Öppna appen i Chrome
2. Tryck på menyknappen (⋮) → **Lägg till på startskärmen**

### iPhone/iPad (Safari)

1. Öppna appen i Safari
2. Tryck på dela-knappen (□↑) → **Lägg till på hemskärmen**

### Gratis hosting-alternativ

- [Netlify Drop](https://app.netlify.com/drop) — dra och släpp projektmappen
- [Vercel](https://vercel.com) — `npx vercel`
- GitHub Pages — pusha till ett repo och aktivera Pages

## Användarflöde

1. **Importera** — välj en eller flera kvittobilder
2. **Varor** — granska och redigera varor och priser från AI-tolkningen
3. **Personer** — lägg till namnen på dem som ska dela (minst 2)
4. **Fördela** — välj vem som ska betala vad för varje vara
5. **Summering** — se varje persons totalkostnad

## Teknikstack

- Vanilla HTML/CSS/JavaScript — inget byggsteg krävs
- Google Gemini 2.0 Flash API för bildtolkning
- PWA: Service Worker + Web App Manifest
