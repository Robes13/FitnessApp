# WeightLogList

`app-weight-log-list` – "Seneste vejninger". Hver række viser dato ("I dag" / "I går" /
"3 dage siden"), klokkeslæt, forskellen til vejningen før (grøn/rød efter målet, "Start" på den
ældste) og vægten.

| Fil                    | Indhold                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `weight-log-list.ts`   | Komponenten – ét input: `rows` fra `WeightViewService`.    |
| `weight-log-list.html` | Listen, eller `UiEmptyState`, når der ikke er vejet endnu. |
| `weight-log-list.scss` | Rækkernes typografi og hairline mellem dem.                |

Rækkerne er færdigformaterede i `WeightViewService.logRows` (dansk komma, typografisk minus),
så komponenten kun skal tegne dem.
