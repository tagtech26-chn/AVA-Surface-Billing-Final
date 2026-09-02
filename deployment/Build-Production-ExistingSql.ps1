$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
$ServerProject = Join-Path $Root 'server-dotnet\AVASurface.Server.csproj'
$ServerDir = Join-Path $Root 'server-dotnet'
$Dist = Join-Path $Root 'dist'
$WebRoot = Join-Path $ServerDir 'wwwroot'
$Artifacts = Join-Path $Root 'artifacts'
$Publish = Join-Path $Artifacts 'publish'
$Bundle = Join-Path $Artifacts 'efbundle.exe'
$Schema = Join-Path $Artifacts 'schema-baseline.sql'
$Iss = Join-Path $Root 'deployment\installer\VeroBillingExistingSql.iss'
$Out = Join-Path $Root 'deployment\output'

function Need($n) {
    if (-not (Get-Command $n -ErrorAction SilentlyContinue)) {
        throw "Required command '$n' was not found."
    }
}

Need node
Need npm
Need dotnet

if (-not (Test-Path $Iss)) { throw "Installer script not found: $Iss" }
$Inno = Join-Path $env:ProgramFiles 'Inno Setup 7\ISCC.exe'
if (-not (Test-Path $Inno)) { $Inno = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 7\ISCC.exe' }
if (-not (Test-Path $Inno)) { throw 'Inno Setup 7 ISCC.exe was not found.' }

Write-Host '1/7 Frontend dependencies/build' -ForegroundColor Yellow
Push-Location $Root
try {
    npm ci
    if ($LASTEXITCODE) { throw 'npm ci failed' }
    npm run lint
    if ($LASTEXITCODE) { throw 'npm run lint failed' }
    npm run build
    if ($LASTEXITCODE) { throw 'npm run build failed' }
}
finally { Pop-Location }

if (-not (Test-Path (Join-Path $Dist 'index.html'))) { throw 'Frontend build did not produce dist/index.html.' }

Write-Host '2/7 Combining frontend' -ForegroundColor Yellow
if (Test-Path $WebRoot) { Remove-Item $WebRoot -Recurse -Force }
New-Item -ItemType Directory $WebRoot -Force | Out-Null
Copy-Item (Join-Path $Dist '*') $WebRoot -Recurse -Force

Write-Host '3/7 Publishing backend' -ForegroundColor Yellow
if (Test-Path $Artifacts) { Remove-Item $Artifacts -Recurse -Force }
New-Item -ItemType Directory $Publish -Force | Out-Null
Push-Location $ServerDir
try {
    dotnet restore $ServerProject -r win-x64
    if ($LASTEXITCODE) { throw 'dotnet restore failed' }
    dotnet build $ServerProject -c Release --no-restore
    if ($LASTEXITCODE) { throw 'dotnet build failed' }
    dotnet publish $ServerProject -c Release -r win-x64 --self-contained true --no-restore -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:DebugType=None -o $Publish
    if ($LASTEXITCODE) { throw 'dotnet publish failed' }
}
finally { Pop-Location }

Write-Host '4/7 Creating fresh-install EF schema baseline' -ForegroundColor Yellow
$env:ASPNETCORE_ENVIRONMENT = 'Production'
Push-Location $ServerDir
try {
    dotnet ef dbcontext script --project $ServerProject --startup-project $ServerProject --context BillingDbContext --output $Schema
    if ($LASTEXITCODE) { throw 'EF DbContext schema script generation failed' }
}
finally { Pop-Location }

# The current application has one schema object that is intentionally outside the EF model.
# Keep it in the fresh-install schema baseline rather than recreating it at service startup.
$schemaAppend = @'

/* AVA Surface system schema not represented by BillingDbContext */
IF OBJECT_ID(N'dbo.BillingDiscountSettings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BillingDiscountSettings
    (
        Id uniqueidentifier NOT NULL CONSTRAINT PK_BillingDiscountSettings PRIMARY KEY,
        CompanyId uniqueidentifier NOT NULL,
        DefaultSalespersonDiscountPercent decimal(5,2) NOT NULL CONSTRAINT DF_BillingDiscountSettings_Default DEFAULT (0),
        MaxSalespersonDiscountPercent decimal(5,2) NOT NULL CONSTRAINT DF_BillingDiscountSettings_Max DEFAULT (0),
        UpdatedAtUtc datetime2 NOT NULL CONSTRAINT DF_BillingDiscountSettings_Updated DEFAULT (SYSUTCDATETIME()),
        UpdatedByUserId uniqueidentifier NULL,
        CONSTRAINT UQ_BillingDiscountSettings_Company UNIQUE (CompanyId),
        CONSTRAINT CK_BillingDiscountSettings_DefaultNonNegative CHECK (DefaultSalespersonDiscountPercent >= 0 AND DefaultSalespersonDiscountPercent <= 100),
        CONSTRAINT CK_BillingDiscountSettings_MaxNonNegative CHECK (MaxSalespersonDiscountPercent >= 0 AND MaxSalespersonDiscountPercent <= 100),
        CONSTRAINT CK_BillingDiscountSettings_DefaultLEMax CHECK (DefaultSalespersonDiscountPercent <= MaxSalespersonDiscountPercent),
        CONSTRAINT FK_BillingDiscountSettings_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id)
    );
END;

/* Baseline the current migration history after the complete current EF model has been created. */
IF OBJECT_ID(N'dbo.__EFMigrationsHistory', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.__EFMigrationsHistory
    (
        MigrationId nvarchar(150) NOT NULL CONSTRAINT PK___EFMigrationsHistory PRIMARY KEY,
        ProductVersion nvarchar(32) NOT NULL
    );
END;
'@

Add-Content -LiteralPath $Schema -Value $schemaAppend -Encoding UTF8

$migrationIds = Get-ChildItem -LiteralPath (Join-Path $ServerDir 'Migrations') -Filter '*.cs' -File |
    Where-Object { $_.Name -match '^\d{14}_.+\.cs$' -and $_.Name -notmatch '\.Designer\.cs$' } |
    ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name).Split('_', 2)[0..1] -join '_' } |
    Sort-Object -Unique

$historySql = "`r`n/* Current migrations are represented by the schema baseline above. */`r`n"
foreach ($migrationId in $migrationIds) {
    $escaped = $migrationId.Replace("'", "''")
    $historySql += "IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId = N'$escaped') INSERT INTO dbo.__EFMigrationsHistory (MigrationId, ProductVersion) VALUES (N'$escaped', N'9.0.8');`r`n"
}
Add-Content -LiteralPath $Schema -Value $historySql -Encoding UTF8

Write-Host "Fresh-install schema baseline generated: $Schema" -ForegroundColor Green

Write-Host '5/7 Creating EF upgrade bundle' -ForegroundColor Yellow
Push-Location $ServerDir
try {
    $ef = (& dotnet ef --version 2>$null | Select-Object -Last 1)
    if ($ef -notmatch '9\.0\.8') { throw "dotnet-ef 9.0.8 required; found $ef" }
    dotnet ef migrations bundle --project $ServerProject --startup-project $ServerProject --self-contained --target-runtime win-x64 --output $Bundle --force
    if ($LASTEXITCODE) { throw 'EF migration bundle failed' }
}
finally { Pop-Location }

Write-Host '6/7 Compiling installer' -ForegroundColor Yellow
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory $Out -Force | Out-Null
& $Inno $Iss
if ($LASTEXITCODE) { throw 'Inno Setup compilation failed' }

$Setup = Get-ChildItem $Out -Filter '*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $Setup) { throw 'Installer EXE was not produced' }

Write-Host '7/7 BUILD COMPLETE' -ForegroundColor Green
Write-Host $Setup.FullName -ForegroundColor Green
