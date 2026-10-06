# Signup – trin

Ét trin pr. mappe: `<trin>-step/<trin>-step.{ts,html,scss}` med klassen `<PascalCase>Step` og
selector `app-<trin>-step`. Navne og stier er låst af signup-kontrakten, fordi
`SignupPage` tegner trinnene med `@switch` over `SignupStepId`.

Et trin har **hverken inputs eller outputs**. Det injicerer `SignupStateService` med `inject()`
og læser/skriver kladdens signaler direkte. Trinnet bestemmer selv sit indhold, men ikke sin
plads i flowet: rækkefølge, spring-regler, knaptekst og "kan man gå videre" bor i servicen.

Trinnets `:host` skal være `display: flex; flex-direction: column; flex: 1; min-height: 0`,
så et langt trin kan scrolle uden at skubbe knapperne ud af skærmen. Det og de fælles
`__title`, `__title-accent` og `__subtitle` leverer mixinen `signup-step`
([`src/styles/_mixins.scss`](../../../../../styles/_mixins.scss)): hvert trin inkluderer den
først i sin blok (`@include mixins.signup-step;`, eller `signup-step($subtitle: false)` hvis
indledningen har et andet klassenavn) og tilføjer kun sine egne overrides efter den.
