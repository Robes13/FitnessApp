# ProfileAvatar

`app-profile-avatar` – brugerens avatar i fire størrelser: 44 px (Hjems header), 72 px
(profilsidens hoved), 132 px (fotoarkets tomme tilstand) og 196 px (fotoarkets editor).

Komponenten ligger i `shared/`, fordi både **Hjem** og **Profil** viser den samme avatar med
den samme beskæring. Lå formlerne i den ene feature, skulle den anden enten importere på tværs
af features (forbudt) eller skrive dem af.

| Input     | Type                           | Beskrivelse                                           |
| --------- | ------------------------------ | ----------------------------------------------------- |
| `photo`   | `ProfilePhoto \| null`         | Det beskårne billede. `null` → blå cirkel med initial |
| `initial` | `string`                       | Forbogstavet, der vises uden billede                  |
| `size`    | `'sm' \| 'md' \| 'lg' \| 'xl'` | 44 / 72 / 132 / 196 px                                |

## Hvorfor procent og ikke pixels

`photo-crop.ts` oversætter `ProfilePhoto` til `background-size` og `background-position` i
**procent** (designets `photoSize` / `photoPos`). Procenter er relative til elementet, så de
samme tre tal — `zoom`, `x`, `y` — giver nøjagtig samme udsnit i alle fire størrelser. Havde vi
regnet i pixels, ville beskæringen fra editoren ikke passe på avataren.

`photo-crop.ts` indeholder også `movePhotoCrop()` (designets `photoMove`), der oversætter et
træk i pixels til en ny position i procent. Trækket regnes altid fra beskæringen, som den var,
da fingeren blev sat — ikke skridt for skridt — så positionen ikke driver af afrunding.

`photoDrawRect()` er de samme formler i pixels: hvor hele billedet skal tegnes på et kvadratisk
canvas (`BAKED_PHOTO_SIZE` = 512 px), så canvasset viser præcis avatarens udsnit – fyld efter den
korte side gange zoom, og `x`/`y` procent af overskuddet. Fotoarket bager dermed beskæringen ind i
den JPEG, der uploades (plan-v2 P10).

`photo.dataUrl` er enten en data-URL (et valgt billede under beskæring) eller API'ets
`profileImageUrl`. I Development er den relativ (`/api/v1/dev-images/<guid>.jpg`) og virker
uændret i `url("…")`, fordi browseren slår den op på sidens egen origin, og dev-proxyen sender
`/api` videre til API'et. Bevidst genvej: i native dev-builds peger en relativ URL på WebView'ets
egen server, så dér vises intet billede; produktionens Azure-URL'er er absolutte.

Avataren er dekorativ (`aria-hidden`): navnet står ved siden af, og i fotoarket bærer den
omkringliggende knap etiketten.
