# EF Core-migrationer

| Migration | Indhold |
| --- | --- |
| `20260929174945_InitialCreate` | PostgreSQL-skemaet fra entity-modellen (onboarding, samtykke, profilbillede-metadata, indekser) |
| `20260929175518_AddPushDevicesAndDeliveries` | Firebase-enhedsregistreringer og claims for påmindelseslevering |
| `20260930082029_BindEmailVerificationTokensToEmail` | `EMAIL_VERIFICATION_TOKEN.Email varchar(320) NOT NULL` (kontoens adresse, da tokenet blev udstedt); markerer alle ubrugte tokens som brugt |
| `20260930084037_AddNormalizedUsername` | Genereret `USER.NormalizedUsername` (A–Z → a–z) med unikt indeks; afbryder ved tomme brugernavne eller kollisioner, der kun adskiller sig i store/små bogstaver |
| `20260930115857_AddMealTypeAndPendingEmail` | `FOOD_LOG.MealType integer NOT NULL DEFAULT 4` (Snack) og `EMAIL_VERIFICATION_TOKEN.NewEmail varchar(320) NULL` |

Alle er genereret med `dotnet ef migrations add` og gennemgået. I `AddMealTypeAndPendingEmail` er
EF's scaffoldede `defaultValue: 0` rettet til `4`, fordi `0` ikke er en gyldig `MealType`.

`dotnet` findes ikke på værten, så migrationer køres i SDK-containeren. Kilden kopieres ind i
containeren, så `bin/obj` aldrig skrives i `API/`; kun `Migrations/*.cs` kopieres tilbage. Fra
repo-roden:

```bash
docker run --rm -v "$PWD/API":/src -v fitnessapp-nuget:/root/.nuget/packages mcr.microsoft.com/dotnet/sdk:10.0 \
  bash -c 'mkdir /work && cp -r /src/. /work && cd /work && rm -rf bin obj && dotnet tool install -g dotnet-ef --version "10.*" && export PATH="$PATH:/root/.dotnet/tools" && dotnet restore API.csproj && dotnet ef migrations add <Navn> --project API.csproj && dotnet ef migrations has-pending-model-changes --project API.csproj && cp Migrations/*.cs /src/Migrations/'
```

`dotnet restore` er nødvendig, før `dotnet ef` kan læse projektet. `has-pending-model-changes` skal
svare "No changes have been made to the model since the last migration."

Migrationerne anvendes af `migrate`-servicen i `mobilapp/docs/api-integration/docker/compose.yml`
(`dotnet ef database update --project API.csproj` mod Postgres i compose-stakken). Mod en anden
database: sæt `ConnectionStrings__DefaultConnection` og kør samme container med
`dotnet restore API.csproj && dotnet ef database update --project API.csproj`.
