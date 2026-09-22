# Profil – services

Feature-specifik logik bag profilskærmen. Alt læses fra `core/`-stores via signals; ingen af
disse services har egen state.

| Fil               | Indhold                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile-rows.ts` | `ProfileRowsService` – rækkerne under "Min plan" og "Konto" samt de tre nøgletal (vægt, højde, BMI). Designets `profileRows` / `accountRows`.               |
| `profile-edit.ts` | `ProfileEditService` – definitionerne bag "Rediger profil"-arket (titel, felttype, grænser, hjælpetekst) og handlingerne, der gemmer. Designets `editDefs`. |
| `achievements.ts` | `AchievementsService` – de 12 præstationer. Designets `badges`.                                                                                             |

## Betingede rækker

"Min plan" er ikke en fast liste. Præcis som i designet vises

- **Målvægt** kun, når målet er valgt og ikke er `hold`, og
- **Længde** + **Intensitet** kun, når brugeren har mindst én træningsdag.

Derudover ligger **Dagligt kaloriemål** sidst i listen. Rækken findes ikke i designets
`profileRows`, men designets `editDefs.kcal` gør – den skriver `kcalOverride`, så brugeren kan
overstyre det beregnede mål.

## Grænser i redigeringsarket

Højdefeltet bruger designets egne grænser (120–230 cm), som er snævrere end linealen i
opret-flowet (`HEIGHT_MIN_CM`/`HEIGHT_MAX_CM` = 55–250). Det er bevidst: feltet skrives med
tastaturet, hvor et urealistisk tal ellers er nemt at ramme. Alle andre grænser kommer fra
`core/constants/nutrition.ts`.

## Adgangskode

Adgangskoden er ikke en del af `UserProfile`. "Ny adgangskode" sendes derfor til
`AuthApi.resetPassword()` – backenden er det eneste sted, en adgangskode kan ændres – og
arket viser spinner og fejltekst fra det kald.

## Præstationer

`AchievementsService` regner de tolv badges ud af brugerens egne data: madloggen, vejningerne,
egne samlinger og antallet af scanninger. Der er ingen forspring og ingen syntetisk uge, så
gitteret starter på tolv tomme ringe. Appen kender kun dagen i dag, så ugetallene kan højst
blive 1, indtil backenden kan levere tidligere dage.
