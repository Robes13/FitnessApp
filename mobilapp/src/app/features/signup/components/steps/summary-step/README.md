# SummaryStep

Signup-trinnet `summary` (`app-summary-step`) — designets `s6`, "Tjek og **bekræft**".
Sidste trin i flowet: her hedder knappen nederst "Opret konto", og det er `SignupPage`, der
kalder `SignupStateService.submit()` (trinnet kender hverken spinner eller fejl).

## Indhold

1. **E-mail** — `UiTextInput` styret af en typet reactive form (`FormGroup<{ email }>`), der
   skriver videre til kladdens `email`-signal. Kanten bliver rød, så snart der står noget,
   der ikke ligner en e-mail — ikke i det tomme felt.
2. **Ni linjer** (`buildSummaryRows` i `summary-rows.ts`) i `UiRowButton` med
   `density="compact"`. Værdien for "Mål" er orange; resten er almindelig. Hver linje er en
   knap med `aria-label="Ret …"`, som kalder `jumpTo(step)` og dermed går i rette-tilstand:
   "Næste" hedder så "Gem" og fører tilbage hertil.
3. **Betingelserne** — et kort med flueben og teksten
   "Jeg accepterer Nutrifys servicevilkår og privatlivspolitik.". De to ord er understreget
   og orange, men de er **ikke** links: der findes ingen sider bag dem i designet.

Listen er selve scroll-området, så overskriften og figuren bliver stående.

## Figuren

Den lille figur til højre holder en kuglepen. Indtil betingelserne er accepteret, banker
pennen utålmodigt (`pentap`, humør 0,15); når fluebenet sættes, retter figuren sig op
(humør 1), pennen står stille, og tre gnister blinker (`glow`) omkring hovedet. Pennens
startpunkt er regnet ud som designets `sfig.penX/penY` og rammer derfor præcis figurens
højre hånd, uanset vægt og højde.

## Regler

Rækkebyggeren er en ren funktion med egen spec, fordi sammensætningen af "Mål" og "Træning"
har flere tilfælde (uden pace, uden målvægt ved "holde vægten", ingen faste træninger).
`SignupStateService.canContinue` kræver en gyldig e-mail **og** et flueben.

Figurens koordinater opdateres samlet gennem `animatedFigure`, så kropsdele og afledte
rekvisitter deler samme frame ved hurtige inputskift. Se fælles figur-dokumentation for
afbrydelse, tempo og reduceret bevægelse.
