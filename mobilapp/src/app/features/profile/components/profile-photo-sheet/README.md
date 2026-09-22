# ProfilePhotoSheet

`app-profile-photo-sheet` – bundarket "Profilbillede".

| Input  | Type      | Beskrivelse |
| ------ | --------- | ----------- |
| `open` | `boolean` | Påkrævet    |

| Output   | Beskrivelse                                   |
| -------- | --------------------------------------------- |
| `closed` | Luk-knap, scrim, Escape eller "Brug billedet" |

## To tilstande

**Tomt:** 132 px cirkel med forbogstavet, den orange "Vælg foto"-knap og teksten
"Du beskærer billedet, når det er valgt."

**Valgt:** 196 px cirkel, man kan trække i, en zoom-slider (100–300 %), "Centrér igen" /
"Fjern foto", "Vælg et andet foto" og "Brug billedet".

## Beskæring

Billedet gemmes som `ProfilePhoto` på profilen: data-URL, billedformat, zoom og x/y i procent.
Formlerne ligger i [`../profile-avatar/photo-crop.ts`](../profile-avatar/photo-crop.ts) og
deles med avataren, så udsnittet er det samme i 196 px-editoren og i 72 px-avataren.

Ændringer skrives direkte til profilen, mens man trækker – derfor opdaterer avataren bag
arket sig med det samme, og "Brug billedet" lukker bare arket. "Fjern foto" sætter
`photo: null`.

Trækfladen kan også betjenes med tastaturet: den har `tabindex="0"`, og piletasterne flytter
udsnittet 8 px ad gangen (24 px med Shift). Hvert tastetryk regnes ud fra den nuværende
beskæring, fordi `movePhotoCrop()` forventer et samlet træk fra sit udgangspunkt – ikke en
akkumuleret sum. Den synlige hjælpetekst er designets ordret ("Træk i billedet for at flytte
det."), så tastaturvejen står i trækfladens `aria-label` i stedet – den er kun for
skærmlæsere og ændrer ikke designets tekst.

## Filvalg

Der er hverken kamera eller galleri; designet bruger bevidst en almindelig filvælger. Et
`<input type="file">` kan kun åbnes af brugerens eget klik, så knapperne er `<label>`-elementer
med et gennemsigtigt input ovenpå – ikke `app-ui-button`. Filen læses med `FileReader` til en
data-URL, og billedformatet måles med et `Image`, fordi det afgør, om beskæringen skalerer
efter højden eller bredden.

Kan filen ikke læses eller afkodes, vises "Billedet kunne ikke indlæses. Prøv et andet." Den
tekst findes ikke i designet – prototypen har ingen fejltilstand – men UI'et skal kunne
håndtere det.

Billeder nedskaleres til højst 768 pixels på længste led og gemmes som JPEG med
kvalitet 0,8. Både valg, beskæring og fjernelse opdaterer kun profilen, når
lagringen lykkes. Ved pladsmangel vises en fejl, og den tidligere profil bevares.
