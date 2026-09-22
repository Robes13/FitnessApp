# UiSheet

Bundark: den dæmpede, slørede scrim med et panel nederst, som designet bruger til
"Tilføj mad", "Ny samling", "Rediger profil", "Profilbillede", "Log ud", scan-resultatet og
"Tjek din mail".

## Placering

Arket er **ikke** `position: fixed`. Scrimmen er `position: absolute; inset: 0` og lægger sig
over den nærmeste positionerede forælder – app-roden, som shell-komponenten gør `relative`
og begrænser til `--layout-max-width`. Derfor kan arket bruges hvor som helst i en side uden
at bryde ud af telefonrammen. Selve host-elementet er `display: contents`, så det aldrig
blokerer klik, når arket er lukket.

Arket lever inde i `@if (open())`: når det er lukket, findes intet af det i DOM'en.

## Åbn og luk

Forælderen ejer tilstanden. `open` er et krævet input, og arket udsender `closed`, når
brugeren

- klikker på luk-knappen (`aria-label` = `closeLabel`, standard "Luk"),
- klikker på scrimmen uden for panelet, eller
- trykker Escape.

Arket lukker ikke sig selv – forælderen sætter `open` til `false` som svar på `closed`.

`hideClose` gør arket **ikke-afviseligt**: luk-knappen forsvinder, og både scrim-klik og
Escape ignoreres. Det bruges til verificerings-arket på Hjem, som brugeren ikke må lukke.

### Escape og stablede ark

Escape lyttes på `document`, så det virker uanset hvor fokus står. Er flere ark åbne
samtidig (fx "Ny samling" med en indlejret vare-søgning), holder komponenten en intern liste
over åbne ark, og **kun det øverst åbnede** reagerer på Escape. Så lukker ét tryk ét ark.

### Fokus

Når arket åbner, flyttes fokus til panelet (`tabindex="-1"`), medmindre indholdet selv har
taget fokus (fx et søgefelt med autofokus). Panelet har `role="dialog"`,
`aria-modal="true"` og `aria-label` sat til titlen (inkl. accent).

## Titel

`title` vises som display-overskrift, og `titleAccent` tilføjes orange efter et mellemrum:
`title="Ny" titleAccent="samling"` → "Ny **samling**". Designets varianter dækkes af tre små
inputs:

| Ark i designet               | Inputs                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| "Tilføj **mad**" (28 px)     | `title="Tilføj" titleAccent="mad" titleSize="md"`          |
| "Log <span>ud?</span>" (rød) | `title="Log" titleAccent="ud?" titleAccentTone="negative"` |
| "Profil**billede**" (ét ord) | `title="Profil" titleAccent="billede" titleAccentJoined`   |
| "Tjek din **mail**" (30 px)  | `title="Tjek din" titleAccent="mail" titleSize="lg"`       |

Mellemrummet mellem de to dele er et `&ngsp;` i templaten (Angular fjerner ellers rene
mellemrum mellem elementer); `titleAccentJoined` udelader det. `aria-label` på dialogen følger
samme sammensætning.

Er både `title` og `titleAccent` tomme, tegnes der ingen `<h2>`; i stedet vises
`[sheetTitle]`-slotten i titlens plads, så fx scannerens røde "Ukendt vare"-badge kan stå til
venstre for luk-knappen.

## Slots

| Slot                 | Placering                                                         |
| -------------------- | ----------------------------------------------------------------- |
| `[sheetLeading]`     | **Over** overskriften, centreret (designets ikon-cirkel og mærke) |
| standardindhold      | Panelets krop                                                     |
| `[sheetTitle]`       | Titlens plads – kun når `title` og `titleAccent` er tomme         |
| `[sheetHeaderExtra]` | Til højre for titlen, før luk-knappen                             |
| `[sheetFooter]`      | Nederst, uden for det scrollbare indhold                          |

Tomme slots fylder ikke (`:empty`), så `gap` mellem header, krop og footer forbliver korrekt.

### `scrollable` eller `column`

`scrollable` lader **hele** kroppen scrolle. Skal en del af indholdet blive stående (Mad-arkets
måltids-chips og fanerne Varer/Samlinger), bruges `column` i stedet: kroppen bliver en
flex-kolonne med `min-height: 0`, og forbrugeren lægger `mixins.scroll-area` på netop det barn,
der skal scrolle.

## Inputs

| Input               | Standard   | Betydning                                                                 |
| ------------------- | ---------- | ------------------------------------------------------------------------- |
| `open`              | –          | Krævet. Om arket vises                                                    |
| `title`             | `''`       | Overskrift                                                                |
| `titleAccent`       | `''`       | Orange ord efter overskriften                                             |
| `titleSize`         | `'sm'`     | `sm` 26 · `md` 28 · `lg` 30 px (`--font-size-display-sm/md/lg`)           |
| `titleAccentTone`   | `'accent'` | `accent` orange · `negative` rød ("Log ud?")                              |
| `titleAccentJoined` | `false`    | Intet mellemrum mellem `title` og `titleAccent` ("Profilbillede")         |
| `closeLabel`        | `'Luk'`    | `aria-label` på luk-knappen                                               |
| `hideClose`         | `false`    | Skjul luk-knap og slå luk via scrim/Escape fra                            |
| `layer`             | `'sheet'`  | z-index: `sheet` 20 · `sheet-high` 25 · `overlay` 30 · `top` 40           |
| `maxHeight`         | `'auto'`   | `auto` 78 % · `medium` 88 % · `tall` 96 % · `full` 100 % − 24 px          |
| `scrollable`        | `false`    | Kroppen scroller inden i panelet (skjult scrollbar) i stedet for at vokse |
| `column`            | `false`    | Kroppen er en flex-kolonne, så et barn selv kan eje scroll-området        |

## Eksempel

```html
<app-ui-sheet
  [open]="isAddOpen()"
  title="Tilføj"
  titleAccent="mad"
  maxHeight="tall"
  scrollable
  (closed)="closeAdd()"
>
  <app-food-picker (picked)="onPicked($event)" />
  <button app-ui-button sheetFooter block type="button" (click)="save()">Gem</button>
</app-ui-sheet>
```
