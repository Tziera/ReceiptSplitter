# Testsvit

Verifierar att API:t tolkar kvitton korrekt mot manuellt verifierade facit.

## Förutsättningar

- Node.js 18+
- En `.env`-fil i projektets rot med minst en nyckel:

```
GEMINI_API_KEY=din_nyckel_här
CLAUDE_API_KEY=din_nyckel_här   # valfritt, används om Gemini saknas
```

## Lägg till testfall

1. Kopiera en kvittobild till `test/receipts/`, t.ex. `kvitto5.jpg`
2. Skapa en matchande `kvitto5.json` i samma mapp:

```json
{
  "items": [
    { "name": "Exakt namn från kvittot", "price": 29.90 },
    { "name": "Rabatt kampanj",          "price": -5.00 }
  ],
  "total": 24.90
}
```

**Regler för ground truth:**
- `name` — skriv exakt som det står på kvittot (AI:n matchas med fuzzy-logik, men exakt är bäst)
- `price` — exakt belopp med decimalpunkt; rabatter som negativt tal
- `total` — slutbeloppet att betala efter rabatter; utelämna fältet om det inte syns på kvittot

Kontrollera alltid att `items`-summan stämmer med `total` innan du kör testet.

## Kör

```
node test/run.js
```

## Tolka resultatet

| Symbol | Betydelse |
|--------|-----------|
| ✓ | Alla varor och priser inom tolerans (±0,50 kr) |
| ✗ fel pris | Varan hittades men priset avviker mer än 0,50 kr |
| ✗ saknas | Varan finns i ground truth men inte i API-svaret |
| ! extra | API:t hittade en vara som inte finns i ground truth |

Konfidensraden visar hur väl AI:ns egna `low`/`medium`-markeringar korrelerar med faktiska fel — ett tecken på att konfidensvärdet är kalibrerat.
