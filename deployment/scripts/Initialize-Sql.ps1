param(
    [string]$ConfigPath = '',
    [string]$ServiceName = 'VeroBillingService',
    [string]$SchemaPath = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ConfigPath) -or -not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Production configuration file was not found: $ConfigPath"
}
if ([string]::IsNullOrWhiteSpace($SchemaPath)) {
    $SchemaPath = Join-Path $PSScriptRoot 'schema-baseline.sql'
}
if (-not (Test-Path -LiteralPath $SchemaPath)) {
    throw "Fresh-install schema baseline was not found: $SchemaPath"
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
        $command.CommandTimeout = 300
        $command.CommandText = $Sql
        [void]$command.ExecuteNonQuery()
    }
    finally {
        if ($connection.State -ne [System.Data.ConnectionState]::Closed) { $connection.Close() }
        $connection.Dispose()
    }
}

function Invoke-SqlScriptFile {
    param([string]$ConnectionString, [string]$Path)
    $script = Get-Content -LiteralPath $Path -Raw
    # EF's SQL generator emits GO batch separators. SqlClient does not understand GO,
    # so execute each batch separately without requiring SSMS/sqlcmd on the target.
    $batches = [regex]::Split($script, '(?im)^\s*GO\s*;?\s*$')
    foreach ($batch in $batches) {
        if (-not [string]::IsNullOrWhiteSpace($batch)) {
            Invoke-SqlBatch -ConnectionString $ConnectionString -Sql $batch
        }
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

$schemaState = Invoke-SqlBatch -ConnectionString $databaseConnection -Sql @"
SELECT CASE WHEN OBJECT_ID(N'dbo.Companies', N'U') IS NULL
                 AND OBJECT_ID(N'dbo.__EFMigrationsHistory', N'U') IS NULL
            THEN 1 ELSE 0 END;
"@

$checkConnection = New-Object System.Data.SqlClient.SqlConnection $databaseConnection
try {
    $checkConnection.Open()
    $checkCommand = $checkConnection.CreateCommand()
    $checkCommand.CommandText = "SELECT CASE WHEN OBJECT_ID(N'dbo.Companies', N'U') IS NULL AND OBJECT_ID(N'dbo.__EFMigrationsHistory', N'U') IS NULL THEN 1 ELSE 0 END;"
    $isFresh = [int]$checkCommand.ExecuteScalar() -eq 1
}
finally {
    if ($checkConnection.State -ne [System.Data.ConnectionState]::Closed) { $checkConnection.Close() }
    $checkConnection.Dispose()
}

if ($isFresh) {
    Write-Host 'Fresh database detected. Applying EF-generated schema baseline only...'
    Invoke-SqlScriptFile -ConnectionString $databaseConnection -Path $SchemaPath
    Write-Host 'Fresh database schema created. No business/demo data was inserted.'
}
else {
    Write-Host 'Existing database detected. Preserving existing schema and data.'
}

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
