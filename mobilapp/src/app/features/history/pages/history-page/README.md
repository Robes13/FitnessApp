# HistoryPage

`app-history-page` – fanen Historik. Designets `tabHistorik` (HTML-linje 1066–1096).

| Fil                    | Indhold                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `history-page.ts`      | Komponenten. Leverer `HistoryService`, henter første side og beder om næste side ved scroll.                 |
| `history-page.html`    | Overskrift, filter-chips, dagsgrupper, spinner/fejl nederst og tom tilstand; læser `HistoryService` direkte. |
| `history-page.scss`    | `:host` er `page-screen`; resten er BEM-klasser under `.history-page`.                                       |
| `history-page.spec.ts` | Spinner → grupper, scroll nær bunden henter næste side, filter + tom tilstand, fejl + "Prøv igen", gen-log.  |

## Opbygning

```
:host (page-screen)
└── .history-page__scroll (scroll-area, hide-scrollbar) – (scroll) → næste side nær bunden
    ├── .history-page__title        "Din historik" – historik i orange
    ├── .history-page__filters      UiChip size="sm", vandret scroll ud til kanten
    └── .history-page__groups       én sektion pr. dag
        ├── .history-page__group-label   "I går · 20. sep"
        ├── .history-page__group-summary "1.970 kcal · P 120 g · K 210 g · F 60 g" (kun dage med mad)
        ├── .history-page__row           prik · titel/undertekst · værdi · gen-log
        ├── .history-page__status        UiSpinner under indlæsning / UiFormError + "Prøv igen" ved fejl
        └── UiEmptyState                 kun når siden er hentet uden poster
└── .history-page__tab-bar-spacer   --layout-tab-bar-clearance
```

Filter-rækken trækkes ud i fuld bredde med negativ margin og får sidepadding igen, så
chipsene kan scrolle helt ud til skærmkanten som i designet.

## Detaljer

- **Næste side** hentes, når `scrollTop + clientHeight >= scrollHeight − HISTORY_LOAD_MORE_THRESHOLD_PX`
  (400 px). Ingen `IntersectionObserver`: én (scroll)-handler er nok, og servicen ignorerer
  kaldet, mens en side hentes.
- **Prikkens farve** følger posttypen: vejning orange, mad lyseblå (`--color-info`), mål grøn,
  konto blå (`--color-primary`).
- **Gen-log-knappen** vises kun på måltidsposter. Det er `UiIconButton` med `size="4xs"`
  (26 px som i designet) og `tone="ghost"`; siden farver kun ikonet. Tryk, mens API'et gemmer,
  ignoreres af servicen (knappen deaktiveres ikke, så fokus bliver på den). Teksten (`Logget i dag` / `Ikke logget – prøv igen`) står i `aria-label` og
  `title`; visuelt bliver ikonet grønt, eller rødt og et kryds (`close`), så en fejl ikke kun
  vises med farve.
- **Værdierne flugter:** har en synlig række en gen-log-knap, får rækkerne uden knap en tom
  plads af samme bredde (`.history-page__relog-space`), så alle værdier slutter i samme kolonne.
- Rækkens lodrette padding er `--space-2-25` (designets 9 px).
