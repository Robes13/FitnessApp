# TrainingIntensityStep

Signup-trinnet `training-intensity` (`app-training-intensity-step`): "Hvor **hårdt?**".

## Indhold

- RPE-tallet 1–10 (`–` indtil der er valgt) farvet efter niveauets tone, "/10", og de to
  hjælpetekster, der skifter, når der er valgt.
- Scenen: figuren med udtryk pr. niveau – pandebånd, kinder, mund, tunge, bryn, vippetempo,
  varmestriber (kun hårdt) og 0/1/3 svededråber.
- Anstrengelsesskalaen: ti søjler med højden 12 + n × 2,8 px, der fyldes til og med det
  valgte tal, og enderne "1 · meget let" / "10 · alt hvad du har".
- Tre valgfliser (`app-ui-option-card` i kolonne-layout) med niveauindikator på tre søjler,
  labels og `3/10`, `6/10`, `9/10`. Nederst talk-testen på én linje med ellipsis.

## Beslutninger

- Niveauerne kommer fra `INTENSITIES` i core, og RPE oversættes med
  `NutritionCalculator.intensityFor`. Kun de rent visuelle felter (humør, tempo, mund, bryn,
  varme, dråber) ligger i trinnet, fordi de ikke bruges andre steder.
- Figuren er `FigureBody` med `expression`; kun varme og sved tegnes her.
- Både søjleskalaen og fliserne sætter `trainingRpe` direkte i `SignupStateService` – 3, 6
  eller 9 fra fliserne, det trykkede tal fra skalaen.
- Uden et valg er trinnet ikke gyldigt (`canContinue`), og figuren står stille.

Figurens koordinater opdateres samlet gennem `animatedFigure`, så kropsdele og afledte
rekvisitter deler samme frame ved hurtige inputskift. Se fælles figur-dokumentation for
afbrydelse, tempo og reduceret bevægelse.
