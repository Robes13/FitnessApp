# ProfilePhotoSheet

`app-profile-photo-sheet` – bundarket "Profilbillede" (spec 2.4).

| Input  | Type      | Beskrivelse |
| ------ | --------- | ----------- |
| `open` | `boolean` | Påkrævet    |

| Output   | Beskrivelse                                                      |
| -------- | ---------------------------------------------------------------- |
| `closed` | Luk-knap, scrim, Escape – eller "Brug billedet", når det er gemt |

## Tilstande

**Intet nyt billede:** 132 px cirkel med det gemte foto (API'ets `profileImageUrl`) eller
forbogstavet, den orange "Vælg foto"-knap, "Tag et foto" og teksten "Du beskærer billedet, når det
er valgt."
Er der et gemt foto, står "Fjern foto" under teksten.

**Valgt billede (kladde):** 196 px cirkel, man kan trække i, en zoom-slider (100–300 %),
"Centrér igen" / "Fjern foto", "Vælg et andet foto", "Tag et foto" og "Brug billedet".

## Kladde, bagning og upload

Det valgte billede er en **kladde** (`draft`-signalet): træk, zoom og piletaster ændrer kun
kladden, og intet gemmes, mens man beskærer. Lukkes arket uden "Brug billedet", kasseres kladden
(6a), og profilen er uændret.

"Brug billedet" bager udsnittet ind i en 512 × 512 JPEG (kvalitet 0,85) på et canvas:
`photoDrawRect()` i [`photo-crop.ts`](../../../../shared/components/profile-avatar/photo-crop.ts)
regner med de samme formler som avatarens `background-size`/`background-position`, så den
uploadede fil er præcis det udsnit, editoren viste. Filen sendes med
`UserProfileService.uploadPhoto()` (`PUT me/profile/image`, multipart-feltet `file`,
`avatar.jpg`). Imens viser knappen en spinner; når API'et har svaret, viser profilen API'ets URL,
og arket lukker. Fejler upload eller bagning, står "Billedet kunne ikke gemmes. Prøv igen." i
arket, og kladden bliver.

Mens upload eller fjernelse kører, kan arket ikke lukkes (`hideClose`), og et nyvalgt billede
ignoreres – ellers kunne et sent svar lukke et genåbnet ark eller smide en nyere kladde væk.

"Fjern foto" kalder `UserProfileService.deletePhoto()` (`DELETE me/profile/image`; 404 = allerede
væk = succes) og kasserer kladden. Fejl giver samme gem-fejl.

API'et kræver ≤ 2 MB og JPEG/PNG/WebP (magic bytes og delens `Content-Type`). Uploaden er altid en
gen-kodet JPEG langt under 2 MB, så API'ets 400 kan ikke nås herfra – den giver bare gem-fejlen.

## Beskæring

Formlerne ligger i [`photo-crop.ts`](../../../../shared/components/profile-avatar/photo-crop.ts)
og deles med avataren, så udsnittet er det samme i 196 px-editoren, på 512 px-canvasset og i
avatarerne.

Trækfladen kan også betjenes med tastaturet: den har `tabindex="0"`, og piletasterne flytter
udsnittet 8 px ad gangen (24 px med Shift). Hvert tastetryk regnes ud fra den nuværende
beskæring, fordi `movePhotoCrop()` forventer et samlet træk fra sit udgangspunkt – ikke en
akkumuleret sum. Den synlige hjælpetekst er designets ordret ("Træk i billedet for at flytte
det."), så tastaturvejen står i trækfladens `aria-label` i stedet – den er kun for
skærmlæsere og ændrer ikke designets tekst.

## Filvalg

To `<input type="file" accept="image/*">` – ingen Capacitor Camera-pakke: "Vælg foto" åbner
galleriet, og "Tag et foto" har `capture="user"`, fordi Android-WebView'et (Capacitors
`BridgeWebChromeClient`) kun åbner kameraet, når inputtet har `capture`. Android starter så
telefonens kamera-app (`ACTION_IMAGE_CAPTURE`), og den skal stå under `<queries>` i
`AndroidManifest.xml` – ellers kan Android 11+ ikke finde den, og galleriet åbner i stedet.
Appen har bevidst **ikke** tilladelsen `CAMERA`: kamera-appen har sin egen adgang og beder selv om
den. Var tilladelsen erklæret, ville Capacitor bede om den først, og et afslag gav intet kamera og
ingen besked – spec 2.4-3a "tilladelse mangler" håndteres derfor af kamera-appen på Android og af
systemet på iOS. iOS tilbyder også kameraet fra "Vælg foto" (`NSCameraUsageDescription` nævner
profilbilledet), og desktop-browsere ignorerer `capture`. Inputtet kan kun åbnes af brugerens eget
klik, så knapperne er `<label>`-elementer med et gennemsigtigt input ovenpå – ikke `app-ui-button`.
Filen læses med `FileReader` til en data-URL, nedskaleres til højst 768 pixels på længste led, og
billedformatet måles, fordi det afgør, om beskæringen skalerer efter højden eller bredden.

Kan browseren ikke læse eller afkode filen (spec 4a, "billedet overholder ikke kravene" – fx en
tekstfil, der hedder `x.jpg`), vises "Billedet kan ikke bruges – vælg et andet (fx JPEG, PNG eller
WebP).", og intet uploades.
