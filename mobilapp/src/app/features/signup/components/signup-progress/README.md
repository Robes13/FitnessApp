# SignupProgress

`app-signup-progress` – fremdriften øverst i oprettelsesflowet: en 48 px ring med trinnummeret,
kapitelnavnet + "Trin x af y" og en bjælke pr. kapitel med kapitelnavnene under.

| Input        | Betydning                                                 |
| ------------ | --------------------------------------------------------- |
| `stepNumber` | Nummeret på det aktive trin (1-baseret).                  |
| `stepTotal`  | Antal synlige trin.                                       |
| `value`      | Andel 0..1 til ringen (`stepNumber / stepTotal`).         |
| `chapters`   | `SignupChapter[]`: navn, antal trin, fyld, aktiv, færdig. |
| `editing`    | Retter brugeren et svar fra opsummeringen?                |

Komponenten er ren præsentation: siden leverer de afledte værdier fra `SignupStateService`.
Retter brugeren et svar, skifter overskriften til "Retter" og undertekten til
"Tilbage til opsummering" (designets `chapterLabel`/`stepOfText`).

Bjælkernes bredde følger antallet af synlige trin i kapitlet (`flex-grow`), så de skrumper,
når et trin springes over. Bjælke og navn ligger i samme kolonne, og kolonnen er aldrig
smallere end sit navn: har kapitlet kun ét trin (Aktivitet uden træningsdage), tager det pladsen
fra de længere kapitler i stedet for at afkorte navnet. Selve ringen er `UiProgressRing` med `trackTone="neutral"`, så
sporet får designets `rgba(148,163,184,.3)`.

`compact` (sat af signup-siden, mens skærmtastaturet er åbent) skjuler ringen og
kapitelnavnene, så kun kapitel, trin og streger er tilbage, og felterne får pladsen.
