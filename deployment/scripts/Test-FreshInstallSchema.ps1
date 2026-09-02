param(
    [string]$ServerInstance = '.\SQLEXPRESS',
    [string]$DatabaseName = 'AVASurfaceBilling_SchemaTest',
    [string]$SchemaPath = '',
    [string]$BundlePath = '',
    [string]$SeedScriptPath = ''
)

$ErrorActionPreference = 'Stop'

$DeploymentDir = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($SchemaPath)) { $SchemaPath = Join-Path $DeploymentDir '..\artifacts\schema-baseline.sql' }
if ([string]::IsNullOrWhiteSpace($BundlePath)) { $BundlePath = Join-Path $DeploymentDir '..\artifacts\efbundle.exe' }
if ([string]::IsNullOrWhiteSpace($SeedScriptPath)) { $SeedScriptPath = Join-Path $PSScriptRoot 'Seed-InitialData.ps1' }

$SchemaPath = [System.IO.Path]::GetFullPath($SchemaPath)
$BundlePath = [System.IO.Path]::GetFullPath($BundlePath)
$SeedScriptPath = [System.IO.Path]::GetFullPath($SeedScriptPath)

foreach ($path in @($SchemaPath, $BundlePath, $SeedScriptPath)) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Required test artifact not found: $path" }
}

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
    foreach ($batch in [regex]::Split($script, '(?im)^\s*GO\s*;?\s*$')) {
        if (-not [string]::IsNullOrWhiteSpace($batch)) {
            Invoke-SqlBatch -ConnectionString $ConnectionString -Sql $batch
        }
    }
}

$master = "Server=$ServerInstance;Database=master;Integrated Security=True;TrustServerCertificate=True;"
$db = "Server=$ServerInstance;Database=$DatabaseName;Integrated Security=True;TrustServerCertificate=True;"

Write-Host "Recreating test database $DatabaseName..." -ForegroundColor Yellow
Invoke-SqlBatch $master @"
IF DB_ID(N'$DatabaseName') IS NOT NULL
BEGIN
    ALTER DATABASE [$DatabaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$DatabaseName];
END;
CREATE DATABASE [$DatabaseName];
"@

Write-Host 'Applying schema baseline...' -ForegroundColor Yellow
Invoke-SqlScriptFile $db $SchemaPath

Write-Host 'Running EF upgrade bundle (should report no pending migrations)...' -ForegroundColor Yellow
$connectionString = "Server=$ServerInstance;Database=$DatabaseName;Trusted_Connection=True;TrustServerCertificate=True"
& $BundlePath '--connection' $connectionString
if ($LASTEXITCODE -ne 0) { throw "EF migration bundle failed with exit code $LASTEXITCODE." }

$configPath = Join-Path $env:TEMP "AVA-SchemaTest-$([Guid]::NewGuid().ToString('N')).json"
@{
    Database = @{ Server = $ServerInstance; Database = $DatabaseName }
} | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $configPath -Encoding UTF8
try {
    Write-Host 'Running initial data seed...' -ForegroundColor Yellow
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $SeedScriptPath -ConfigPath $configPath
    if ($LASTEXITCODE -ne 0) { throw "Initial data seed failed with exit code $LASTEXITCODE." }
}
finally {
    Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
}

$connection = New-Object System.Data.SqlClient.SqlConnection $db
try {
    $connection.Open()
    $command = $connection.CreateCommand()
    $command.CommandText = @"
SELECT
    (SELECT COUNT(*) FROM dbo.Companies) AS Companies,
    (SELECT COUNT(*) FROM dbo.AppUsers) AS AppUsers,
    (SELECT COUNT(*) FROM dbo.Customers) AS Customers,
    (SELECT COUNT(*) FROM dbo.Products) AS Products,
    (SELECT COUNT(*) FROM dbo.Invoices) AS Invoices,
    (SELECT COUNT(*) FROM dbo.Promotions) AS Promotions,
    (SELECT COUNT(*) FROM dbo.BillingDiscountSettings) AS DiscountSettings,
    (SELECT COUNT(*) FROM dbo.__EFMigrationsHistory) AS MigrationHistory;
"@
    $reader = $command.ExecuteReader()
    try {
        [void]$reader.Read()
        $companies = [int]$reader['Companies']
        $users = [int]$reader['AppUsers']
        $customers = [int]$reader['Customers']
        $products = [int]$reader['Products']
        $invoices = [int]$reader['Invoices']
        $promotions = [int]$reader['Promotions']
        $settings = [int]$reader['DiscountSettings']
        $history = [int]$reader['MigrationHistory']
    }
    finally { $reader.Close(); $reader.Dispose() }
}
finally {
    if ($connection.State -ne [System.Data.ConnectionState]::Closed) { $connection.Close() }
    $connection.Dispose()
}

if ($companies -ne 1) { throw "Expected 1 company; found $companies." }
if ($users -ne 1) { throw "Expected 1 admin user; found $users." }
if ($customers -ne 0 -or $products -ne 0 -or $invoices -ne 0 -or $promotions -ne 0) {
    throw "Fresh-install data isolation failed: Customers=$customers Products=$products Invoices=$invoices Promotions=$promotions."
}
if ($settings -ne 1) { throw "Expected 1 discount-settings row; found $settings." }
if ($history -lt 1) { throw 'Migration history baseline was not created.' }

Write-Host 'FRESH INSTALL SCHEMA TEST PASSED' -ForegroundColor Green
Write-Host "Company=1 Admin=1 Customers=0 Products=0 Invoices=0 Promotions=0 Settings=1 History=$history" -ForegroundColor Green
