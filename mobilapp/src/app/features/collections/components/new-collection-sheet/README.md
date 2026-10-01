# NewCollectionSheet

Arket "Ny samling" (designets `newColOpen`): navn og en kladde af varer. Bunden har "Opret
samling", der er slået fra, indtil samlingen har et gyldigt navn og mindst én vare (spec
4.0-8a).

Med `[collection]` bliver det samme ark til **"Rediger samling"** (spec 4.1): det åbner udfyldt
med samlingens navn og varer, knappen hedder "Gem ændringer", og arket udsender `updated` i
stedet for `created`. Varer tilføjes, rettes og fjernes præcis som ved oprettelse.

```html
<app-new-collection-sheet
  [open]="sheetOpen()"
  [busy]="saving()"
  [error]="saveError()"
  (closed)="sheetOpen.set(false)"
  (created)="onCreated($event)"
/>

<app-new-collection-sheet
  [open]="editOpen()"
  [collection]="collection"
  [busy]="pending()"
  (closed)="editOpen.set(false)"
  (updated)="onUpdated($event)"
/>
```

- **Arket gemmer ikke selv.** `created`/`updated` udsender en `NewCollectionInput`; siden
  gemmer samlingen. `busy` giver knappen spinner og blokerer et tryk mere; `error` (oversat)
  vises over knappen.
- **1–50 varer, navn højst 100 tegn** (API'ets regler). Er kladden tom, står "Tilføj mindst én
  vare for at gemme samlingen." under den tomme tilstand. Ved 50 varer er "Søg vare" og "Scan"
  slået fra. Navnefeltet har `maxlength` 100.
- **Unikke navne.** Har en anden samling allerede navnet (trimmet, uden hensyn til store og
  små bogstaver), vises "Du har allerede en samling med det navn." med `app-ui-form-error`,
  feltet får rød kant, og knappen er slået fra. Den samling, der redigeres, må beholde sit eget
  navn. Reglen findes kun i appen (`CollectionsService.isNameTaken()`); API'et tager dubletter.
- **Nulstilles ved hver åbning** (tomt navn og tom kladde), som designets `openNewCol` — eller
  til den redigerede samlings værdier.
- **To veje til en vare:** "Søg vare" åbner `app-food-picker` i et ark oven på dette
  (`layer="sheet-high"`), og "Scan" åbner `app-barcode-scanner`. Begge lægger varen i
  kladden. Et tryk på en kladde-række åbner vælgeren i portionstrinnet og erstatter varen.
- **Varen beholder sit eget id**: katalog-id'et, `off-<stregkode>` for en scannet vare eller
  `food-…` for en ny egen vare. `CollectionsService` slår det op med `FoodLogService.ensureFood`
  og opretter madvaren, hvis den mangler. Den samme vare kan ligge i kladden flere gange
  (rækkerne spores på position).
- **En rettet vare mister sit `mealItemId`**, når mængden (eller varen) er ændret, så gemningen
  sletter den gamle række og tilføjer den nye (diffen i `CollectionsService.update()`). Åbnes en
  vare uden ændringer, beholdes den, som den er.
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
- Ikongitteret og "Hører under" er slettet: API'et har hverken ikon eller måltid på en samling
  (P13). Måltidet vælges, når samlingen logges.
