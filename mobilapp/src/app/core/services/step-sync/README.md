# Step sync

Spec 2.6 (skridt fra Apple Sundhed / Health Connect én gang om måneden) og 9.2-3a (træk samtykket
tilbage → ingen automatisk indhentning).

| Fil                  | Indhold                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `step-sync.ts`       | `StepSyncService` – samtykket, den månedlige synkronisering, `enable()` og `disable()`                |
| `health-platform.ts` | `HEALTH_PLATFORM` + `CapacitorHealthPlatform` – den eneste kode, der kalder `@capgo/capacitor-health` |

Flow, statusser og beslutninger: [`../README.md`](../README.md) → "Skridt fra Apple Sundhed /
Health Connect". Native opsætning (HealthKit, Health Connect-tilladelser, privatlivssiden) og
hvordan man lægger testskridt ind på emulatorerne: [`mobilapp/README.md`](../../../../../README.md).

Specs giver en fake `HealthPlatform` (`{ provide: HEALTH_PLATFORM, useValue: … }`) og kalder
`TestBed.tick()` efter `inject`, så effekten bag `toObservable(profile.status)` har kørt.
