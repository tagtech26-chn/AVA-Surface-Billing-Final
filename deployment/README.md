# Vero Billing System — Windows Production Deployment

This deployment branch packages the existing React/Vite frontend and ASP.NET Core backend into one Windows application.

## Target architecture

- Frontend: Vite production build copied into `server-dotnet/wwwroot`.
- Backend: ASP.NET Core self-contained `win-x64` executable.
- Web/API endpoint: `http://localhost:5080` on the production machine.
- Windows service: `VeroBillingService` / display name `Vero Billing System`.
- Database: SQL Server Express named instance `SQLEXPRESS`.
- Database name: `AVASurfaceBilling`.
- Database upgrades: self-contained EF Core migration bundle.
- SQL application identity: Windows service SID `NT SERVICE\VeroBillingService`.
- Installer: Inno Setup x64.

The production machine does not need Node.js, npm, the .NET runtime, EF CLI, or the source repository.

## Build machine requirements

1. Node.js/npm.
2. .NET 9 SDK.
3. `dotnet-ef` 9.0.8. The build script installs/updates it if necessary.
4. Inno Setup 7 x64.
5. Official SQL Server 2025 Express x64 full-media installer copied to:

   `deployment\prerequisites\SQLEXPR_x64_ENU.exe`

## Build

Run PowerShell from the repository root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\deployment\Build-Production.ps1
```

The build performs frontend lint/build, copies the frontend into ASP.NET Core, publishes a self-contained Windows x64 backend, creates a self-contained EF migration bundle, and compiles the final Setup.exe.

## Production installation

Run the generated Setup.exe as Administrator.

The installer:

1. Stops an existing Vero Billing System service if present.
2. Installs SQL Server Express SQLEXPRESS if it is not already installed.
3. Creates/configures the Vero Billing Windows service.
4. Creates the service SID and grants it only the database roles required by the application (`db_datareader`, `db_datawriter`, `db_ddladmin`, and `EXECUTE`).
5. Creates `AVASurfaceBilling` if needed.
6. Applies all EF migrations using the self-contained migration bundle.
7. Creates a production JWT secret on first installation and stores it in the protected production configuration file.
8. Opens TCP 5080 for Domain/Private Windows firewall profiles.
9. Starts the Windows service.
10. Creates Start Menu and Desktop shortcuts to `http://localhost:5080`.

The installer does not delete the SQL database during uninstall. Database backup/restore remains an explicit administrative operation.

## Upgrade behaviour

Run the new Setup.exe over the existing installation. The service is stopped before files are replaced. The existing `appsettings.Production.json` is preserved, the migration bundle applies only pending migrations, and the service is restarted.

## Production configuration

`appsettings.Production.json` is intentionally excluded from the installer file list and is created during installation. This prevents a generated JWT secret from being stored in Git or in the installer build output.

The GST verification section is initially blank and can be configured on the production machine without changing source code.

## Important support note

The current application targets .NET 9 because that is the existing production codebase. Microsoft currently lists .NET 9 as Standard Term Support ending November 10, 2026, while .NET 10 is the current LTS release through November 14, 2028. The first installer can therefore be built without disturbing the application, but a separate .NET 10 upgrade should be planned before the .NET 9 support end date.
