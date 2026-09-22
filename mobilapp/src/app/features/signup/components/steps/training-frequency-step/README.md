# TrainingFrequencyStep

Signup-trinnet `training-frequency` (`app-training-frequency-step`): "Hvor ofte **træner du?**".

## Indhold

- Antallet af valgte træningsdage som stort tal, teksten "planlagte træninger om ugen" og
  en pille med rytmen (`Ingen faste træninger` / `Let rytme` / `God rytme` / `Høj frekvens` /
  `Hver dag`). Underoverskriften følger samme tærskler.
- Scenen: figuren tager biceps-curl. Vip og curl deler tempo, der bliver hurtigere pr.
  træningsdag (1,8 − dage × 0,16 s, mindst 0,6 s) og står stille uden træningsdage. Fra seks
  dage kommer der en svededråbe.
- Syv dagsknapper (M, Ti, O, To, F, L, S – mandag først) med `aria-pressed` og det fulde
  dagsnavn som `aria-label`, plus hjælpeteksten "Tryk på de dage, du typisk træner."

## Beslutninger

- Kroppen er `FigureBody` (`shaded`), mens højre arm og håndvægten tegnes her, fordi de skal
  rotere om skulderen i deres egen `curl`-gruppe. Gruppen tegnes efter kroppen, hvor designet
  lægger den før hovedet – forskellen er ikke synlig, da armen løftes uden for hovedet.
- Dagene skiftes med `SignupStateService.toggleTrainingDay(index)`; trinnet holder ingen egen
  state.
- Trinnet er altid "gyldigt": nul træningsdage er et lovligt svar, og servicen springer så
  varighed og intensitet over.
