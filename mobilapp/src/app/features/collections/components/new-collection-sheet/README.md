# NewCollectionSheet

Arket "Ny samling" (designets `newColOpen`): navn, "Hører under", ikongitter og en kladde af
varer. Bunden har "Opret samling", der er slået fra, indtil samlingen har et gyldigt navn.

Med `[collection]` bliver det samme ark til **"Rediger samling"**: det åbner udfyldt med
samlingens navn, måltid, ikon og varer, knappen hedder "Gem ændringer", og arket udsender
`updated` i stedet for `created`. Varer tilføjes, rettes og fjernes præcis som ved oprettelse.

```html
<app-new-collection-sheet
  [open]="sheetOpen()"
  [defaultMeal]="defaultMeal()"
  (closed)="sheetOpen.set(false)"
  (created)="onCreated($event)"
/>

<app-new-collection-sheet
  [open]="editOpen()"
  [collection]="collection"
  (closed)="editOpen.set(false)"
  (updated)="onUpdated($event)"
/>
```

- **Arket gemmer ikke selv.** `created`/`updated` udsender en `NewCollectionInput`; siden
  gemmer samlingen (og vælger efter oprettelse det rigtige filter).
- **Unikke navne.** Har en anden samling allerede navnet (trimmet, uden hensyn til store og
  små bogstaver), vises "Du har allerede en samling med det navn." med `app-ui-form-error`,
  feltet får rød kant, og knappen er slået fra. Den samling, der redigeres, må beholde sit
  eget navn. Arket læser kun `CollectionsService.isNameTaken()`; servicen kaster alligevel
  `DuplicateCollectionNameError`, hvis nogen forsøger at gemme uden om arket.
- **Nulstilles ved hver åbning** (navn, ikon `star`, tom kladde, måltid = `defaultMeal`),
  som designets `openNewCol` — eller til den redigerede samlings værdier. Ligger dens ikon
  blandt de foldede, vises alle 30 ikoner fra start.
- **To veje til en vare:** "Søg vare" åbner `app-food-picker` i et ark oven på dette
  (`layer="sheet-high"`), og "Scan" åbner `app-barcode-scanner`. Begge lægger varen i
  kladden. Et tryk på en kladde-række åbner vælgeren i portionstrinnet og erstatter varen.
- **Egne varer** gemmes samtidig under "Mine varer" i API'et (`FoodLogService.addCustomFood`,
  både fra "Gem uden at logge" og fra "Gem og føj til samlingen", der kun udsender `picked`), så
  de kan søges frem igen — vælgerens egen tekst lover det ("Gemmes under Mine varer"). Fejler
  det (fx `DuplicateCustomFoodNameError`, når navnet er taget på en anden enhed), ligger varen
  stadig i kladden, og arket viser beskeden under knapperne (og øverst i vælgeren, mens den er
  åben). Imens gemningen kører, er vælgeren `busy`, så "Gem uden at logge" ikke sender to gange;
  den bliver på formularen, til varen er gemt. Gemningen afbrydes ikke, når arket lukkes.
- Vare-vælgerens primærknap hedder her **"Gem og føj til samlingen"**. Designet genbruger
  "Gem og log under <måltid>" fra Mad-skærmen, men varen havner i samlingen, ikke i dagens
  log, så teksten ville være forkert.
- Kladdens varer får et nyt id (`newId()`), så den samme vare kan ligge i den flere gange, og
  id'et kan bruges som rute-id for varen i samlingen. Varen i samlingen er derfor en kopi, ikke
  et link til den egne vare. Når samlingen logges, bliver hver vare til katalogvaren med samme
  navn (`FoodLogService.ensureFood`).
- **Ikongitteret er en rigtig radiogruppe:** kun det valgte ikon er i tab-rækkefølgen, og
  piletasterne flytter valget (venstre/højre ±1, op/ned ±6, fordi gitteret har seks
  kolonner) og wrapper rundt om det antal ikoner, der faktisk vises — 12 eller 30. Er det
  valgte ikon foldet væk med "Vis færre", overtager det første synlige tab-pladsen.
- Hvert ikon får et rigtigt navn med som `aria-label` ("Æg", "Håndvægt" …) i stedet for
  "Ikon 1" … "Ikon 30". Nøglerne er `COLLECTION_ICON_LABEL_KEYS` i
  `core/constants/collection-icons.ts` — ved siden af `COLLECTION_ICON_NAMES`, så enhver
  ikonvælger bruger de samme navne. Designet har kun tegningerne.
