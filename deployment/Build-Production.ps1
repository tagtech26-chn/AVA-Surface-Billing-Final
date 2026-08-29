$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
$ServerProject = Join-Path $Root 'server-dotnet\AVASurface.Server.csproj'
$ServerDir = Join-Path $Root 'server-dotnet'
$FrontendDist = Join-Path $Root 'dist'
$WebRoot = Join-Path $ServerDir 'wwwroot'
$Artifacts = Join-Path $Root 'artifacts'
$PublishDir = Join-Path $Artifacts 'publish'
$EfBundle = Join-Path $Artifacts 'efbundle.exe'
$SqlMedia = Join-Path $Root 'deployment\prerequisites\SQLEXPR_x64_ENU.exe'
$InstallerScript = Join-Path $Root 'deployment\installer\VeroBilling.iss'

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found."
    }
}

Write-Host '=== Vero Billing System - Windows Production Build ===' -ForegroundColor Cyan

Require-Command 'node'
Require-Command 'npm'
Require-Command 'dotnet'

if (-not (Test-Path $SqlMedia)) {
    throw "SQL Server Express full-media installer is missing: $SqlMedia`nDownload the x64 SQL Server Express production media from Microsoft and place it at that path before building the offline installer."
}

if (-not (Test-Path $InstallerScript)) {
    throw "Installer script not found: $InstallerScript"
}

$inno = Get-Command 'ISCC.exe' -ErrorAction SilentlyContinue
if (-not $inno) {
    $candidates = @(
        "$env:ProgramFiles\Inno Setup 7\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 7\ISCC.exe"
    )
    $innoPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($innoPath) { $inno = @{ Source = $innoPath } }
}
if (-not $inno) {
    throw 'Inno Setup 7 ISCC.exe was not found. Install Inno Setup 7 x64 on the build machine.'
}

Write-Host '1/7 Installing frontend dependencies...' -ForegroundColor Yellow
Push-Location $Root
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

    Write-Host '2/7 TypeScript validation...' -ForegroundColor Yellow
    npm run lint
    if ($LASTEXITCODE -ne 0) { throw 'npm run lint failed.' }

    Write-Host '3/7 Building frontend...' -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'npm run build failed.' }
}
finally {
    Pop-Location
}

if (-not (Test-Path (Join-Path $FrontendDist 'index.html'))) {
    throw 'Vite build did not produce dist/index.html.'
}

Write-Host '4/7 Combining frontend into ASP.NET Core wwwroot...' -ForegroundColor Yellow
if (Test-Path $WebRoot) { Remove-Item $WebRoot -Recurse -Force }
New-Item -ItemType Directory -Path $WebRoot -Force | Out-Null
Copy-Item (Join-Path $FrontendDist '*') $WebRoot -Recurse -Force

Write-Host '5/7 Publishing self-contained Windows x64 backend...' -ForegroundColor Yellow
if (Test-Path $Artifacts) { Remove-Item $Artifacts -Recurse -Force }
New-Item -ItemType Directory -Path $PublishDir -Force | Out-Null

Push-Location $ServerDir
try {
    dotnet restore $ServerProject
    if ($LASTEXITCODE -ne 0) { throw 'dotnet restore failed.' }

    dotnet build $ServerProject -c Release --no-restore
    if ($LASTEXITCODE -ne 0) { throw 'dotnet build failed.' }

    dotnet publish $ServerProject -c Release -r win-x64 --self-contained true --no-restore `
        -p:PublishSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -p:DebugType=None `
        -o $PublishDir
    if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed.' }
}
finally {
    Pop-Location
}

Write-Host '6/7 Creating self-contained EF Core migration bundle...' -ForegroundColor Yellow
$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
$env:ASPNETCORE_ENVIRONMENT = 'Production'
try {
    dotnet ef --version *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Installing dotnet-ef 9.0.8 on the build machine...' -ForegroundColor DarkYellow
        dotnet tool update --global dotnet-ef --version 9.0.8 --allow-downgrade
        if ($LASTEXITCODE -ne 0) {
            dotnet tool install --global dotnet-ef --version 9.0.8
            if ($LASTEXITCODE -ne 0) { throw 'Unable to install dotnet-ef 9.0.8.' }
        }
    }

    Push-Location $ServerDir
    try {
        dotnet ef migrations bundle `
            --project $ServerProject `
            --startup-project $ServerProject `
            --self-contained `
            --target-runtime win-x64 `
            --output $EfBundle `
            --force
        if ($LASTEXITCODE -ne 0) { throw 'EF migration bundle creation failed.' }
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
}

Write-Host '7/7 Compiling offline Windows installer...' -ForegroundColor Yellow
$outputDir = Join-Path $Root 'deployment\output'
if (Test-Path $outputDir) { Remove-Item $outputDir -Recurse -Force }
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

& $inno.Source $InstallerScript
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compilation failed.' }

$setup = Get-ChildItem $outputDir -Filter '*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $setup) { throw 'Installer EXE was not produced.' }

Write-Host ''
Write-Host '=== BUILD COMPLETE ===' -ForegroundColor Green
Write-Host "Installer: $($setup.FullName)" -ForegroundColor Green
Write-Host 'The production machine will not need Node.js or the .NET runtime.' -ForegroundColor Green
Write-Host 'SQL Server Express is included only when the Microsoft full-media installer is placed in deployment\prerequisites.' -ForegroundColor Green
