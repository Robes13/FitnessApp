# PaceStep

Signup-trinnet `pace` (`app-pace-step`) — designets `s5`, "Hvor **hurtigt?**".

Tre valgkort (`UiOptionCard`, blå `selected`-stil) bygget på `PACES` fra
`core/constants/nutrition`. Til højre står tempoets takt (`rateLabel`) i orange.

Indledningen skifter med målet: "Hvor hurtigt vil du tage på?" ved `tage`, ellers
"Hvor hurtigt vil du tabe dig?".

Den grønne boks nederst oversætter valget til et dagligt kalorietal —
`Moderat · 0,5 kg/uge svarer til ca. 500 kcal mindre om dagen.` (`ekstra` ved `tage`).
Er der ikke valgt et tempo endnu, står der "Vælg et tempo for at se dagligt kalorietal.".

Trinnet vises ikke, når målet er "holde vægten" (`SKIP_PACE_FOR_MAINTAIN`), og det er
`SignupStateService.canContinue`, der kræver et valg, før man kan gå videre.
