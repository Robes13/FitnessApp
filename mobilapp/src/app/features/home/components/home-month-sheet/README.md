# HomeMonthSheet

"Åbn mere" på Hjem (`app-home-month-sheet`): et ark med de **seneste 30 dage** (use case 5.4
og 5.5, P15 i `plan-v2.md`). Én række pr. dag, nyeste øverst: dagen (`Tor. 24. sep`), kalorier
mod målet (`1.850 / 2.100 kcal`) og makroerne (`P 120 g · K 200 g · F 60 g`). En dag uden poster
viser `–` og ingen makrolinje.

Perioden ruller som ugens ringe (i dag − 29 … i dag) og har ingen månedsnavigation: med
kalendermåneden ville arket d. 1.–6. vise færre dage end ugen. Madloggen har 90 dage indlæst, så
arket kræver ingen ekstra kald.

Bygget på `app-ui-sheet` med en almindelig `<ul>`. Inputs `open` og `rows` (fra
`HomeSummaryService.dayRows()`); output `closed`, når arket lukkes – siden ejer `open`.
