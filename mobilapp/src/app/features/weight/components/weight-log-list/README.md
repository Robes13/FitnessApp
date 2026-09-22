# WeightLogList

`app-weight-log-list` – "Seneste vejninger". Hver række viser dato ("I dag" / "I går" /
"3 dage siden"), klokkeslæt, forskellen til vejningen før (grøn/rød efter målet, "Start" på den
ældste) og vægten.

| Fil                    | Indhold                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `weight-log-list.ts`   | Komponenten – inputs `rows`, `hiddenCount`, `expanded`, `emptyMessage`. |
| `weight-log-list.html` | Listen og "Vis alle"-knappen, eller `UiEmptyState`, når den er tom.     |
| `weight-log-list.scss` | Rækkernes typografi og hairline mellem dem.                             |

Rækkerne er færdigformaterede i `WeightViewService.logRows` (dansk komma, typografisk minus),
så komponenten kun skal tegne dem.

- **Hver række er en knap** og udsender `rowSelected(id)`; siden åbner så `WeightEditSheet`.
- **"Vis alle (n mere)" / "Vis færre"** vises, når der er flere vejninger inden for de sidste
  3 mdr., end den sammenfoldede liste viser. Knappen udsender `expandToggled`; tilstanden ejes af
  `WeightViewService`.
- Tomteksten kommer fra forælderen (`emptyMessage`), så listen kan skelne mellem "aldrig vejet"
  og "ingen vejninger de sidste 3 mdr.".
