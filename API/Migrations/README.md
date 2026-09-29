# EF Core migrations

`20260929174945_InitialCreate` creates the PostgreSQL schema from the entity
model, including onboarding, consent, profile image metadata, and query indexes.
`20260929175518_AddPushDevicesAndDeliveries` adds Firebase device registrations
and reminder delivery claims. Both were generated with `dotnet ef migrations add`
and reviewed; neither has been applied to a live database in this workspace.

Apply them with `dotnet ef database update --project src/FitnessApp.Api`
after configuring `ConnectionStrings:DefaultConnection` and `Jwt:SigningKey`.
