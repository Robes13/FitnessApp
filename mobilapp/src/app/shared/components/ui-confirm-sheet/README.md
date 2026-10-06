# UiConfirmSheet

Bekræftelsen før noget slettes – en samling (4.2) eller en logget vare (3.4) – og profilens log ud og
slet konto. Flyttet hertil fra `features/collections/components/delete-collection-sheet`, så alle
features kan bruge den. Intet luk-kryds, kun den røde bekræft-knap og "Annuller", så et
utilsigtet tryk på baggrunden aldrig sletter noget. Escape – og Androids tilbageknap, der kommer
som Escape – er "Annuller" (`closeOnEscape` på `UiSheet`), undtagen mens handlingen kører.

```html
<app-ui-confirm-sheet
  [open]="deleteOpen()"
  titleKey="collections.deleteSheet.title"
  accentKey="collections.deleteSheet.titleAccent"
  bodyKey="collections.deleteSheet.body"
  [bodyParams]="{ name: collection.name }"
  confirmKey="collections.deleteSheet.confirm"
  cancelKey="collections.deleteSheet.cancel"
  [busy]="deleting()"
  (closed)="deleteOpen.set(false)"
  (confirmed)="delete()"
/>
```

| Input          | Betydning                                                                        |
| -------------- | -------------------------------------------------------------------------------- |
| `open`         | Om arket er åbent (påkrævet)                                                     |
| `titleKey`     | Oversættelsesnøgle til titlens første del                                        |
| `accentKey`    | Nøgle til titlens røde del (fx "samling?")                                       |
| `bodyKey`      | Nøgle til spørgsmålet                                                            |
| `bodyParams`   | Parametre til `bodyKey` (valgfri)                                                |
| `confirmKey`   | Nøgle til den røde knap                                                          |
| `cancelKey`    | Nøgle til "Annuller"                                                             |
| `busy`         | Handlingen kører: spinner på bekræft-knappen, "Annuller" slået fra               |
| `errorMessage` | Hvorfor handlingen fejlede (allerede oversat); vises under spørgsmålet (valgfri) |

| Output      | Betydning                        |
| ----------- | -------------------------------- |
| `closed`    | "Annuller", Escape eller tilbage |
| `confirmed` | Bekræft-knappen blev trykket     |

Arket sletter ikke selv; forælderen kalder sin service og lukker arket (også efter en fejl, som
den selv viser).
