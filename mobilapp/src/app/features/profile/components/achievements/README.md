# Achievements

`app-achievements` – gitteret med præstationer nederst på profilsiden. Fire kolonner, ét
badge pr. celle.

| Input          | Type                     | Beskrivelse                                      |
| -------------- | ------------------------ | ------------------------------------------------ |
| `achievements` | `readonly Achievement[]` | Færdigberegnede badges fra `AchievementsService` |

Komponenten er ren visning: den regner ikke selv på madlog eller vejninger. Det gør
[`services/achievements.ts`](../../services/achievements.ts).

## Farver

Hvert badge har en `tone` (`accent`, `positive`, `info`, `negative`, `neutral`). Tonen sættes
som to lokale variabler på badget — `--achievement-color` og `--achievement-fill` — så cirkel,
kant, ring og statustekst altid følges ad. Låste badges overskriver fyldet med den neutrale
flade og nedtoner hele badget.

## Ringen

Fremdriften tegnes med den fælles `app-ui-progress-ring` (56 px, 3 px streg, ingen skinne).
Ringen vises **kun**, når badget ikke er klaret. Det er designets `arcOp: 0`: er målet nået,
fortæller den farvede kant om cirklen det alene, og en fuld ring oven i den ville bare se ud
som en tykkere kant. Ringen er `aria-hidden`, fordi statusteksten under badget siger det
samme med ord.
