# Vero Billing System — Windows Production Deployment

This deployment branch packages the existing React/Vite frontend and ASP.NET Core backend into one Windows application.

## Target architecture

- Frontend: Vite production build copied into `server-dotnet/wwwroot`.
- Backend: ASP.NET Core self-contained `win-x64` executable.
- Web/API endpoint: configurable during installation on TCP port `5080`.
- Windows service: `VeroBillingService` / display name `Vero Billing System`.
- Database: SQL Server Express named instance `SQLEXPRESS`.
- Database name: `AVASurfaceBilling`.
- Database upgrades: self-contained EF Core migration bundle.
- SQL application identity: Windows service SID `NT SERVICE\VeroBillingService`.
- Installer: Inno Setup x64.

The production machine does not need Node.js, npm, the .NET runtime, EF CLI, or the source repository.

## Configurable production server address

The installer does **not** hard-code `localhost` or a specific IP address.

During installation it asks for the **Server IP / hostname**. Enter the LAN/static IP or DNS hostname that users will use to open the billing application, for example:

`192.168.1.50`

The installer then:

- Configures the Windows service to listen on `http://<server-address>:5080`.
- Creates Start Menu and Desktop shortcuts using the same address.
- Keeps the application source code unchanged between installations.
- Allows the same Setup.exe build to be deployed to another server with a different IP/hostname.

For upgrades, the installer asks for the address again and updates the Windows service command line. The existing protected `appsettings.Production.json` is preserved, including the generated JWT secret and other production settings.

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
2. Asks for the production server IP address or DNS hostname.
3. Installs SQL Server Express SQLEXPRESS if it is not already installed.
4. Creates/configures the Vero Billing Windows service with the selected server address and port 5080.
5. Creates the service SID and grants it only the database roles required by the application (`db_datareader`, `db_datawriter`, `db_ddladmin`, and `EXECUTE`).
6. Creates `AVASurfaceBilling` if needed.
7. Applies all EF migrations using the self-contained migration bundle.
8. Creates a production JWT secret on first installation and stores it in the protected production configuration file.
9. Opens TCP 5080 for Domain/Private Windows firewall profiles.
10. Starts the Windows service.
11. Creates Start Menu and Desktop shortcuts to `http://<server-address>:5080`.

The installer does not delete the SQL database during uninstall. Database backup/restore remains an explicit administrative operation.

## Upgrade behaviour

Run the new Setup.exe over the existing installation. The service is stopped before files are replaced. The existing `appsettings.Production.json` is preserved, the migration bundle applies only pending migrations, the Windows service address is updated from the installer input, and the service is restarted.

## Production configuration

`appsettings.Production.json` is intentionally excluded from the installer file list and is created during installation. This prevents a generated JWT secret from being stored in Git or in the installer build output.

The GST verification section is initially blank and can be configured on the production machine without changing source code.

## Important support note

The current application targets .NET 9 because that is the existing production codebase. Microsoft currently lists .NET 9 as Standard Term Support ending November 10, 2026, while .NET 10 is the current LTS release through November 14, 2028. The first installer can therefore be built without disturbing the application, but a separate .NET 10 upgrade should be planned before the .NET 9 support end date.
