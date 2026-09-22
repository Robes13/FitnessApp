# UiOptionCard

Valgkort med label og beskrivelse – designets `.opt` (køn, mål, tempo) og intensitets-flisen.
Komponenten sidder som attribut på en `<button>`, så native `disabled` og tastaturstyring
følger med. Valget ejes af forælderen (`selected`); kortet rapporterer via `(click)`.

```html
<button
  app-ui-option-card
  label="Tabe mig"
  description="Færre kalorier end du forbrænder"
  [selected]="goal() === 'tabe'"
  (click)="pick('tabe')"
>
  <span optionTrailing class="goal-step__glyph">↓</span>
</button>

<button app-ui-option-card layout="column" selectionStyle="accent" label="Moderat" …>
  <span optionLeading>…tre bjælker…</span>
</button>
```

| Input            | Standard     | Betydning                                                                                                                                                                                                                    |
| ---------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`          | (påkrævet)   | Overskrift (16 px fed)                                                                                                                                                                                                       |
| `description`    | `''`         | Undertekst (13 px sekundær); udelades, når den er tom                                                                                                                                                                        |
| `selected`       | `false`      | Valgt tilstand (`aria-pressed`)                                                                                                                                                                                              |
| `selectionStyle` | `'selected'` | `selected` blå kant + blå tone (designets `sel()`) · `accent` orange kant, orange fyld og orange tekst (designets `editOptions`) · `accent-radio` orange kant + svagere fyld + radio-prik til højre (designets `gendersBig`) |
| `density`        | `'regular'`  | `regular` 68 px · `compact` 58 px (redigeringsarkets valgkort)                                                                                                                                                               |
| `layout`         | `'row'`      | `row` 68 px høj række · `column` intensitets-flisen (`--size-option-tile-min-height`, 104 px) med indikator øverst                                                                                                           |

Slots: `[optionLeading]` (før teksten – i `column` øverst) og `[optionTrailing]` (efter
teksten, fx et glyf eller tempoets "0,5 kg/uge"). Tomme slots fylder ikke.

## Beslutninger

- **`aria-pressed`, ikke radio-semantik.** Kortene bruges både som enkeltvalg (køn, mål) og
  som knapper, der straks anvender valget (profilens redigeringsark). Ønsker en feature
  radiogruppe-semantik, sætter den selv `role="radiogroup"` på beholderen.
- Radio-prikken (22 px, 2 px kant) er ren pynt (`aria-hidden`); tilstanden bærer `aria-pressed`.
- Host-styling står som `:host(.ui-option-card--selected.ui-option-card--style-accent)`, fordi
  kun `:host(…)` rammer selve `<button>` under emuleret encapsulation.
