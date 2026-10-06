# MeasureStage

`app-measure-stage` – scenen, som vægt- og højdetrinnet deler: tallet som stort orange display-tal
med enhed, `−` / `+`-knapper der flytter ét trin ad gangen, `app-figure` med håndvægt ved siden af
og `app-ui-ruler` ud til begge skærmkanter. Trinnet leverer overskrift, undertekst og det, der
står under knapperne (hint eller BMI-blok), som indhold i komponenten (`<ng-content />`).

| Input / model                                         | Betydning                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `value` (`model`)                                     | Tallet. Tovejsbundet til kladdens signal, så lineal og knapper skriver direkte. |
| `min`, `max`                                          | Skalaens grænser. Knapperne klemmer værdien ind i dem.                          |
| `display`                                             | Det formaterede tal, der vises (vægten har dansk komma).                        |
| `unitKey`                                             | i18n-nøgle til enheden (`common.unit.kg` / `common.unit.cm`).                   |
| `decreaseKey`, `increaseKey`, `rulerKey`, `figureKey` | i18n-nøgler til knappernes, linealens og figurens `aria-label`.                 |
| `showCeiling`                                         | Loftslinje og lampe på figuren (kun højdetrinnet).                              |

Figuren læser vægt, højde og køn fra `SignupStateService` selv, og `value` styrer kun tallet og
linealen. Værten er `display: contents`, så rækken og linealen ligger direkte i trinnets
flex-kolonne som før.

## Beslutninger

- Designets faste px-bredde på figuren er oversat til `66 %` af indholdsbredden, så der ikke står
  px-litteraler i SCSS'en.
- `−`/`+`-knapperne er 52 × 44 px rektangler og findes ikke i `shared/` (`UiIconButton` er rund), så
  de er scenens egne.
