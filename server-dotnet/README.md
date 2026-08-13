# AVASurface Billing Server

ASP.NET Core + Entity Framework Core + Microsoft SQL Server Express backend for AVASurface Billing.

## Target stack

- .NET 9 ASP.NET Core Web API
- Entity Framework Core 9
- Microsoft SQL Server Express (`SQLEXPRESS`)
- Existing React frontend

## SQL Server Express

Default development connection:

`Server=.\SQLEXPRESS;Database=AVASurfaceBilling;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True`

Make sure the **SQL Server (SQLEXPRESS)** Windows service is running.

If the database does not exist, run `scripts/create-database.sql` in SSMS, Azure Data Studio, or sqlcmd.

## Run locally

```powershell
cd server-dotnet
dotnet restore
dotnet build
dotnet run
```

The API exposes `/api/health`. Swagger is available at `/swagger` in Development.

## EF Core migrations

Install the EF CLI if required:

```powershell
dotnet tool install --global dotnet-ef --version 9.0.8
```

Create and apply the initial migration from the `server-dotnet` directory:

```powershell
dotnet ef migrations add InitialCreate
dotnet ef database update
```

The migration files should be committed under `server-dotnet/Migrations/` so every environment receives the same schema.

## Architecture

```text
React UI
   |
   v
ASP.NET Core API
   |
   v
Application / Domain rules
   |
   v
EF Core
   |
   v
SQL Server Express
```

The existing React/localStorage implementation is being migrated incrementally. SQL Server is the target system of record; browser storage must not be treated as authoritative for production billing data.

Do not commit passwords, local database files, or production connection strings. Override `ConnectionStrings:DefaultConnection` using environment variables, user secrets, or deployment configuration.
