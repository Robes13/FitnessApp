# i18n (oversættelse)

Appen oversættes med [ngx-translate](https://github.com/ngx-translate/core). Al brugertekst ligger
som nøgler i to filer:

| Fil       | Indhold                                    |
| --------- | ------------------------------------------ |
| `da.json` | Dansk – kildesproget og fallback           |
| `en.json` | Engelsk – præcis de samme nøgler og params |

Nøglerne er nested pr. område: `common.*` (fælles ord som `common.back`), `core.*`, `shared.*`
og ét objekt pr. feature (`profile.*`, `home.*` …). Parametre skrives `{{navn}}`:
`"lastWeighed": "Sidst vejet {{day}}"`.

## Brug

| Hvor               | Sådan                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| Tekst i template   | `{{ 'profile.page.title' \| translate }}` (`TranslatePipe` i `imports`) |
| Med parametre      | `{{ 'weight.view.lastWeighed' \| translate: { day: day() } }}`          |
| Attribut / input   | `[attr.aria-label]="'common.close' \| translate"`, `[label]="…"`        |
| TypeScript         | `t = injectTranslate()` → `computed(() => this.t('…', { … }))`          |
| Konstant med tekst | Gem nøglen (`labelKey`) og oversæt, hvor den vises                      |

`t()` kaldes altid inde i `computed()` eller en metode – aldrig på modulniveau eller i et
almindeligt felt, for så følger teksten ikke med, når sproget skiftes.

## Sprogskift

Brugeren vælger sprog under **Profil → Konto → Sprog**. `LanguageService.set()` henter sprogets
fil og skifter live: `translate`-pipen, `injectTranslate()` og talformatet (`numberLocale` i
`core/utils/date-format.ts`) opdaterer sig selv, så intet genindlæses. Valget gemmes
(`nutrify.language`) og genskabes ved opstart, før første skærm vises.

Dansk er bundlet; de andre sprog hentes som en lazy chunk første gang, de bruges
(`core/services/language/translation-loader.ts`). Der bruges ikke HTTP, så det virker offline i
den native app. En manglende nøgle vises på dansk.

## Test

`i18n.spec.ts` fejler, hvis `da.json` og `en.json` ikke har de samme nøgler og de samme
`{{params}}`. Specs får ngx-translate med `da.json` automatisk
(`core/testing/global-test-providers.ts`).

## Tilføj et sprog

1. Tilføj sproget til `Language` (`core/models/language.ts`) og til `LANGUAGE_OPTIONS` og
   `INTL_LOCALE` (`core/constants/language.ts`).
2. Kopiér `en.json` til fx `de.json` og oversæt værdierne.
3. Tilføj filen i `TRANSLATIONS` i `translation-loader.ts` og i `i18n.spec.ts`.
