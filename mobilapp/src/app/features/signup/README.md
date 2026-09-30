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

`submit()` kalder `SessionService.register(profil, adgangskode, gentagelse)`. Den mapper kladden
til API'ets flade `RegisterRequest` (`toRegisterRequest()` i `core/services/auth-api/auth-mapping.ts`)
og sender `POST auth/register`. API'et opretter profil, første mål, notifikationsindstilling og
vilkårssamtykke i ét kald og sender selv bekræftelsesmailen. Sessionen bliver derefter
`pending-verification`, og Hjem viser bekræftelses-arket, mens brugeren trykker på linket i
mailen (se `features/home/components/verify-email-sheet`). Adgangskoden holdes **kun i
hukommelsen**, så arket kan logge brugeren ind automatisk, når e-mailen er bekræftet.

Kladden skrives som lokal profil via `UserProfileService.replace` først, når API'et har oprettet
kontoen. Siden viser fejlen i en `UiFormError` – e-mail eller brugernavn optaget (409),
for kort adgangskode eller "Kontoen kunne ikke oprettes" – via `toApiError(error).messageKey`.
Selve navigationen til Hjem sker i `SignupPage`, fordi den også ejer spinner og fejltekst.

### API'ets regler i trinnene

- **Brugernavn** 3–50 tegn (`USERNAME_MIN_LENGTH`/`USERNAME_MAX_LENGTH`) og uden `@`
  (`USERNAME_PATTERN` – login skelner e-mail fra brugernavn på `@`), **adgangskode** 10–200 tegn
  (`PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH`). Felterne stopper ved maksimum, og
  `canContinue('account')` kræver alle tre regler.
- **Højde** 100–250 cm (`HEIGHT_MIN_CM` = 100) og **alder** `MIN_AGE`–`MAX_AGE` (13–100 år, API'ets
  regel). "For ung"-teksten interpolerer `MIN_AGE` (`{{minAge}}`).
- **Målvægt** skal ligge på målets side af vægten i dag (under ved "tabe", over ved "tage").
  Skalaens grænser sikrer det ikke i yderpunkterne (vægt ≤ 36 kg ved "tabe", ≥ 200 kg ved
  "tage"), så `canContinue('goal-weight')` kræver det også – ellers svarer register 400.
- API'et gemmer kun antallet af træningsdage og én af tre intensiteter (`Low`/`Moderate`/`High`
  via `INTENSITIES[].maxRpe`); uden træningsdage sendes `TRAINING_FALLBACK_INTENSITY`. Ugedagene
  og RPE-tallet gemmes kun lokalt i profilen (gap i API'et).

## Bevidste afvigelser fra prototypen

- **Notifikationstrinnet springes ikke over.** Designets `calcNext()` kaskaderer
  `sMaal → s5 → s6`, så `sNotif` utilsigtet blev sprunget over, når målet var "hold" – selv om
  trinnet stadig tælles med i `visOrder`. Her går flowet til næste **synlige** trin, så
  notifikationer altid bliver spurgt om.
- **Fejltekst ved oprettelse.** Prototypen har ingen fejltilstand på det sidste trin. Slår
  registreringen fejl, viser siden en oversat fejltekst (fx "Der findes allerede en konto med
  den e-mail.").
- **Alderen regnes ud fra `NOW`.** Prototypen har datoen 16. september 2026 hardkodet.
