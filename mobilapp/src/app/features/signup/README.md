# Signup

Oprettelsesflowet: 14 trin, én side. Brugeren svarer sig igennem konto, krop, aktivitet,
træning, mål og notifikationer og lander på en opsummering, der opretter kontoen.

| Fil/mappe                     | Indhold                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `signup.routes.ts`            | `SIGNUP_ROUTES`: `SignupPage` med `SignupStateService` som route-provider.        |
| `services/`                   | `SignupStateService` – kladden, trin-navigationen og oprettelsen.                 |
| `pages/signup-page/`          | Siden: fremdrift øverst, det aktive trin i midten, tilbage/videre nederst.        |
| `components/signup-progress/` | Ringen med trinnummeret, kapitelnavn og kapitelbjælkerne.                         |
| `components/steps/`           | Ét trin pr. mappe (`app-<trin>-step`). Trinnene læser og skriver kladden direkte. |

## Trin og rækkefølge

`SIGNUP_STEP_ORDER` er designets `order`:

```
account · birthday · gender · weight · height · activity ·
training-frequency · training-duration · training-intensity ·
goal · goal-weight · pace · notifications · summary
```

`visibleOrder` fjerner de trin, brugerens svar gør overflødige:

- **ingen træningsdage valgt** → `training-duration` og `training-intensity` springes over
- **mål = "hold"** → `goal-weight` springes over
- **mål = "hold"** og `SKIP_PACE_FOR_MAINTAIN` → `pace` springes over

`next()` og `back()` går til naboen i `visibleOrder`, så spring-reglerne kun står ét sted.
Fremdriften (`stepNumber`, `stepTotal`, `chapters`) tæller de samme synlige trin, og
`progressValue` er `stepNumber / stepTotal`.

## Rette fra opsummeringen

Opsummeringen kalder `jumpTo(step)`. Det sætter `editFrom`, og `isEditing` er sandt, så længe
brugeren ikke er tilbage på opsummeringen. Nogle trin hænger sammen og rettes som en kæde
(designets `editChains`): `training-frequency → training-duration → training-intensity` og
`goal → goal-weight → pace`. Inde i kæden hedder knappen "Næste"; på kædens sidste trin hedder
den "Gem" og fører tilbage til opsummeringen. `back()` gør det samme: forlader man kæden,
lander man på opsummeringen i stedet for på det foregående trin.

## Trinnenes kontrakt

Et trin er en standalone OnPush-komponent i `components/steps/<trin>-step/` med selector
`app-<trin>-step` og **hverken inputs eller outputs**: det injicerer `SignupStateService` og
skriver direkte i kladdens signaler. Siden tegner det aktive trin med `@switch`, og trinnets
`:host` skal være `display: flex; flex-direction: column; flex: 1; min-height: 0`, så et trin
med meget indhold kan scrolle uden at skubbe knapperne ud af skærmen.

## Oprettelsen

`submit()` registrerer kontoen hos `AuthApi`, skriver kladden som profil via
`UserProfileService.replace` og kalder `SessionService.completeSignup()`. Brugeren er derefter
logget ind, men **ikke** bekræftet, så Hjem viser bekræftelses-arket. Profilen skrives først,
når registreringen er gået godt, og siden viser fejlen fra backenden i en `UiFormError`.
Indtil backenden findes, svarer `AuthApi.register` med en stubbet succes, så hele flowet kan
klikkes igennem.
Selve navigationen til Hjem sker i `SignupPage`, fordi den også ejer spinner og fejltekst.

## Bevidste afvigelser fra prototypen

- **Notifikationstrinnet springes ikke over.** Designets `calcNext()` kaskaderer
  `sMaal → s5 → s6`, så `sNotif` utilsigtet blev sprunget over, når målet var "hold" – selv om
  trinnet stadig tælles med i `visOrder`. Her går flowet til næste **synlige** trin, så
  notifikationer altid bliver spurgt om.
- **Fejltekst ved oprettelse.** Prototypen har ingen fejltilstand på det sidste trin. Slår
  registreringen fejl, viser siden backendens besked, ellers "Kontoen kunne ikke oprettes.
  Prøv igen."
- **Alderen regnes ud fra `NOW`.** Prototypen har datoen 16. september 2026 hardkodet.
