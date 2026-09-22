# WeightRulerInput

`app-weight-ruler-input` – vægtlinealen (den fælles `UiRuler` i `size="lg"`, 30–300 kg i trin
på 0,1) i et kort med −/+ knapper oven på enderne.

| Fil                       | Indhold                                            |
| ------------------------- | -------------------------------------------------- |
| `weight-ruler-input.ts`   | Komponenten – input `value`, output `valueChange`. |
| `weight-ruler-input.html` | −, linealen og +.                                  |
| `weight-ruler-input.scss` | Kortet og placeringen af −/+ knapperne.            |

Bruges to steder: til at registrere en vejning på `WeightPage` og til at rette en vejning i
`WeightEditSheet`. Både træk og −/+ udsendes som `valueChange` med den nye vægt, klemt fast
mellem `WEIGHT_MIN_KG` og `WEIGHT_MAX_KG` og rundet til 0,1 kg. Forælderen ejer værdien.
