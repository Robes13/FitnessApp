# DeleteCollectionSheet

Bekræftelsen før en af brugerens egne samlinger slettes. Mønstret er kopieret fra profilens
log ud-bekræftelse (en feature må ikke importere fra en anden): intet luk-kryds, kun "Ja, slet
samlingen" (rød) og "Annuller", så et utilsigtet tryk på baggrunden aldrig sletter noget.

```html
<app-delete-collection-sheet
  [open]="deleteOpen()"
  [name]="collection.name"
  (closed)="deleteOpen.set(false)"
  (confirmed)="delete()"
/>
```

| Input  | Betydning                           |
| ------ | ----------------------------------- |
| `open` | Om arket er åbent (påkrævet)        |
| `name` | Samlingens navn, vist i spørgsmålet |

| Output      | Betydning                         |
| ----------- | --------------------------------- |
| `closed`    | "Annuller" blev trykket           |
| `confirmed` | "Ja, slet samlingen" blev trykket |

Arket sletter ikke selv; siden kalder `CollectionsService.remove()` og navigerer tilbage.
