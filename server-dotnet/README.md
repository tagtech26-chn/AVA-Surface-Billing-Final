# AVASurface Billing Server

ASP.NET Core + Entity Framework Core + Microsoft SQL Server Express backend for AVASurface Billing.

## Local SQL Server Express

The default development connection targets:

`Server=.\SQLEXPRESS;Database=AVASurfaceBilling;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True`

Make sure the **SQL Server (SQLEXPRESS)** service is running.

## Run

```powershell
cd server-dotnet
dotnet restore
dotnet build
dotnet run
```

Swagger is available in Development at `/swagger`.

## Database

EF Core is the source of truth for the SQL Server schema. The first migration should be generated from this project with:

```powershell
dotnet ef migrations add InitialCreate
dotnet ef database update
```

Do not commit local database files or connection passwords. For a shared/production environment, override `ConnectionStrings:DefaultConnection` using environment configuration or user secrets.
