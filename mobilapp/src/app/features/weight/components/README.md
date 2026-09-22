# Vægt – komponenter

Feature-specifikke komponenter til vægt-skærmen. De er rene visninger: data ind via `input()`,
ingen forretningslogik. Skærmen er delt op her, så ingen enkelt `.scss`-fil nærmer sig
budgettet på 8 kB.

| Mappe                                                 | Indhold                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| [`weight-scale-scene/`](weight-scale-scene/README.md) | Badevægten med figuren: display, humør, sved, vandpyt, damp og gnister. |
| [`weight-chart/`](weight-chart/README.md)             | Grafkortet: vægt, interval, kurve med gradient, mållinje og fodnote.    |
| [`weight-log-list/`](weight-log-list/README.md)       | "Seneste vejninger" med dato, klokkeslæt, forskel og vægt.              |
