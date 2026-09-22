# HistoryPage

`app-history-page` – fanen Historik. Designets `tabHistorik` (HTML-linje 1066–1096).

| Fil                    | Indhold                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `history-page.ts`      | Komponenten. Leverer `HistoryService` og sender kliks videre til den.  |
| `history-page.html`    | Overskrift, filter-chips, dagsgrupper og tom tilstand.                 |
| `history-page.scss`    | `:host` er `page-screen`; resten er BEM-klasser under `.history-page`. |
| `history-page.spec.ts` | Smoke-test: overskrift, filtre, filtrering og gen-log-knappens etiket. |

## Opbygning

```
:host (page-screen)
└── .history-page__scroll (scroll-area, hide-scrollbar)
    ├── .history-page__title        "Din historik" – historik i orange
    ├── .history-page__filters      UiChip size="sm", vandret scroll ud til kanten
    └── .history-page__groups       én sektion pr. dag
        ├── .history-page__group-label   "I går · 20. sep"
        ├── .history-page__group-summary "1.970 kcal · P 120 g · K 210 g · F 60 g" (kun dage med mad)
        └── .history-page__row           prik · titel/undertekst · værdi · gen-log
└── .history-page__tab-bar-spacer   --layout-tab-bar-clearance
```

Filter-rækken trækkes ud i fuld bredde med negativ margin og får sidepadding igen, så
chipsene kan scrolle helt ud til skærmkanten som i designet.

## Detaljer

- **Prikkens farve** følger posttypen: vejning orange, mad lyseblå (`--color-info`), mål grøn.
- **Værdiens farve** følger `valueTone`: normal tekst, grøn ved holdt dagsmål, rød ved
  overskredet.
- **Gen-log-knappen** vises kun på måltidsposter. Det er `UiIconButton` med `size="4xs"`
  (26 px som i designet) og `tone="ghost"`; siden farver kun ikonet. Teksten `Logget i dag`
  står i `aria-label` og `title`; visuelt skifter ikonet til grønt.
- Rækkens lodrette padding er `--space-2-25` (designets 9 px).
