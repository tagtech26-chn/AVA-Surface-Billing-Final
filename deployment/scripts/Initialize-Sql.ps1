param(
    [string]$ConfigPath = '',
    [string]$ServiceName = 'VeroBillingService'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ConfigPath) -or -not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Production configuration file was not found: $ConfigPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$ServerInstance = [string]$config.Database.Server
$DatabaseName = [string]$config.Database.Database

if ([string]::IsNullOrWhiteSpace($ServerInstance)) { throw 'Database.Server is required in AVA-Surface-Production.json.' }
if ([string]::IsNullOrWhiteSpace($DatabaseName)) { throw 'Database.Database is required in AVA-Surface-Production.json.' }

function Invoke-SqlBatch {
    param([string]$ConnectionString, [string]$Sql)
    $connection = New-Object System.Data.SqlClient.SqlConnection $ConnectionString
    try {
        $connection.Open()
        $command = $connection.CreateCommand()
        $command.CommandTimeout = 120
        $command.CommandText = $Sql
        [void]$command.ExecuteNonQuery()
    }
    finally {
        if ($connection.State -ne [System.Data.ConnectionState]::Closed) { $connection.Close() }
        $connection.Dispose()
    }
}

$masterConnection = "Server=$ServerInstance;Database=master;Integrated Security=True;TrustServerCertificate=True;"
$escapedDatabase = $DatabaseName.Replace(']', ']]')
$escapedService = "NT SERVICE\$ServiceName".Replace(']', ']]')

Write-Host "Preparing SQL Server instance $ServerInstance and database $DatabaseName..."

Invoke-SqlBatch -ConnectionString $masterConnection -Sql @"
IF DB_ID(N'$DatabaseName') IS NULL
BEGIN
    CREATE DATABASE [$escapedDatabase];
END;

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$escapedService')
BEGIN
    CREATE LOGIN [$escapedService] FROM WINDOWS;
END;
"@

$databaseConnection = "Server=$ServerInstance;Database=$DatabaseName;Integrated Security=True;TrustServerCertificate=True;"
Invoke-SqlBatch -ConnectionString $databaseConnection -Sql @"
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$escapedService')
BEGIN
    CREATE USER [$escapedService] FOR LOGIN [$escapedService];
END;

IF IS_ROLEMEMBER(N'db_datareader', N'$escapedService') <> 1
    ALTER ROLE [db_datareader] ADD MEMBER [$escapedService];

IF IS_ROLEMEMBER(N'db_datawriter', N'$escapedService') <> 1
    ALTER ROLE [db_datawriter] ADD MEMBER [$escapedService];

GRANT EXECUTE TO [$escapedService];
"@

Write-Host "SQL Server database and Vero Billing service permissions are ready."
