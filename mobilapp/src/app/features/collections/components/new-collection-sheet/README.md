# NewCollectionSheet

Arket "Ny samling" (designets `newColOpen`): navn, "Hører under", ikongitter og en kladde af
varer. Bunden har "Opret samling", der er slået fra, indtil samlingen har et navn.

```html
<app-new-collection-sheet
  [open]="sheetOpen()"
  [defaultMeal]="defaultMeal()"
  (closed)="sheetOpen.set(false)"
  (created)="onCreated($event)"
/>
```

- **Arket gemmer ikke selv.** `created` udsender en `NewCollectionInput`; siden opretter
  samlingen og vælger det rigtige filter bagefter.
- **Nulstilles ved hver åbning** (navn, ikon `star`, tom kladde, måltid = `defaultMeal`),
  som designets `openNewCol`.
- **To veje til en vare:** "Søg vare" åbner `app-food-picker` i et ark oven på dette
  (`layer="sheet-high"`), og "Scan" åbner `app-barcode-scanner`. Begge lægger varen i
  kladden. Et tryk på en kladde-række åbner vælgeren i portionstrinnet og erstatter varen.
- **Egne varer** gemmes samtidig under "Mine varer" (`FoodLogService.addCustomFood`), så de
  kan søges frem igen — vælgerens egen tekst lover det ("Gemmes under Mine varer").
- Vare-vælgerens primærknap hedder her **"Gem og føj til samlingen"**. Designet genbruger
  "Gem og log under <måltid>" fra Mad-skærmen, men varen havner i samlingen, ikke i dagens
  log, så teksten ville være forkert.
- Kladdens varer får et nyt id (`IdService`), så den samme vare kan ligge i den flere gange.
- **Ikongitteret er en rigtig radiogruppe:** kun det valgte ikon er i tab-rækkefølgen, og
  piletasterne flytter valget (venstre/højre ±1, op/ned ±6, fordi gitteret har seks
  kolonner) og wrapper rundt om det antal ikoner, der faktisk vises — 12 eller 30. Er det
  valgte ikon foldet væk med "Vis færre", overtager det første synlige tab-pladsen.
- Hvert ikon får et rigtigt navn med som `aria-label` ("Æg", "Håndvægt" …) i stedet for
  "Ikon 1" … "Ikon 30". Oversættelsen er `COLLECTION_ICON_LABELS` i
  `core/constants/collection-icons.ts` — ved siden af `COLLECTION_ICON_NAMES`, så enhver
  ikonvælger bruger de samme navne. Designet har kun tegningerne.
