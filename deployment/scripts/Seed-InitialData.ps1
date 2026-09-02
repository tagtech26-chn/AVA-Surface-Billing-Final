param(
    [string]$ConfigPath = '',
    [string]$AdminUserName = 'admin',
    [string]$AdminPassword = 'Admin@123'
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ConfigPath) -or -not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Production configuration file was not found: $ConfigPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$ServerInstance = [string]$config.Database.Server
$DatabaseName = [string]$config.Database.Database

if ([string]::IsNullOrWhiteSpace($ServerInstance)) { throw 'Database.Server is required.' }
if ([string]::IsNullOrWhiteSpace($DatabaseName)) { throw 'Database.Database is required.' }

function New-PasswordHash {
    param([Parameter(Mandatory)][string]$Password)

    $salt = New-Object byte[] 16
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($salt)
    $kdf = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
        $Password,
        $salt,
        100000,
        [System.Security.Cryptography.HashAlgorithmName]::SHA256)
    try {
        $hash = $kdf.GetBytes(32)
        return "PBKDF2-SHA256:100000:$([Convert]::ToBase64String($salt)):$([Convert]::ToBase64String($hash))"
    }
    finally {
        $kdf.Dispose()
    }
}

$connectionString = "Server=$ServerInstance;Database=$DatabaseName;Integrated Security=True;TrustServerCertificate=True;"
$connection = New-Object System.Data.SqlClient.SqlConnection $connectionString

try {
    $connection.Open()

    # 1. Create the one empty default company required to own application records.
    $companyCommand = $connection.CreateCommand()
    $companyCommand.CommandText = @"
DECLARE @CompanyId uniqueidentifier;
SELECT @CompanyId = Id FROM dbo.Companies WHERE Code = @Code;

IF @CompanyId IS NULL
BEGIN
    SET @CompanyId = NEWID();
    INSERT INTO dbo.Companies (Id, Code, LegalName, Gstin, Phone, Email, IsActive, CreatedAtUtc)
    VALUES (@CompanyId, @Code, @LegalName, NULL, NULL, NULL, 1, SYSUTCDATETIME());
END

SELECT @CompanyId;
"@
    [void]$companyCommand.Parameters.Add('@Code', [System.Data.SqlDbType]::NVarChar, 30)
    [void]$companyCommand.Parameters.Add('@LegalName', [System.Data.SqlDbType]::NVarChar, 200)
    $companyCommand.Parameters['@Code'].Value = 'AVA001'
    $companyCommand.Parameters['@LegalName'].Value = 'AVA Surfaces'
    $companyId = [Guid]$companyCommand.ExecuteScalar()

    # 2. Create the single bootstrap administrator. Do not overwrite an existing
    #    password on an existing database; preserve existing customer data/users.
    $adminCommand = $connection.CreateCommand()
    $adminCommand.CommandText = @"
SELECT Id, PasswordHash FROM dbo.AppUsers WHERE UserName = @UserName;
"@
    [void]$adminCommand.Parameters.Add('@UserName', [System.Data.SqlDbType]::NVarChar, 100)
    $adminCommand.Parameters['@UserName'].Value = $AdminUserName

    $existingId = $null
    $existingHash = $null
    $reader = $adminCommand.ExecuteReader()
    try {
        if ($reader.Read()) {
            $existingId = [Guid]$reader['Id']
            if (-not $reader.IsDBNull($reader.GetOrdinal('PasswordHash'))) {
                $existingHash = [string]$reader['PasswordHash']
            }
        }
    }
    finally {
        $reader.Close()
        $reader.Dispose()
    }

    if ($null -eq $existingId) {
        $passwordHash = New-PasswordHash -Password $AdminPassword
        $insertAdmin = $connection.CreateCommand()
        $insertAdmin.CommandText = @"
INSERT INTO dbo.AppUsers
    (Id, CompanyId, UserName, DisplayName, Role, PasswordHash, IsActive, CreatedAtUtc)
VALUES
    (NEWID(), @CompanyId, @UserName, N'Administrator', N'ADMIN', @PasswordHash, 1, SYSUTCDATETIME());
"@
        [void]$insertAdmin.Parameters.Add('@CompanyId', [System.Data.SqlDbType]::UniqueIdentifier)
        [void]$insertAdmin.Parameters.Add('@UserName', [System.Data.SqlDbType]::NVarChar, 100)
        [void]$insertAdmin.Parameters.Add('@PasswordHash', [System.Data.SqlDbType]::NVarChar, -1)
        $insertAdmin.Parameters['@CompanyId'].Value = $companyId
        $insertAdmin.Parameters['@UserName'].Value = $AdminUserName
        $insertAdmin.Parameters['@PasswordHash'].Value = $passwordHash
        [void]$insertAdmin.ExecuteNonQuery()
        $insertAdmin.Dispose()
    }
    else {
        $updateAdmin = $connection.CreateCommand()
        $updateAdmin.CommandText = @"
UPDATE dbo.AppUsers
SET CompanyId = COALESCE(CompanyId, @CompanyId),
    DisplayName = CASE WHEN NULLIF(DisplayName, N'') IS NULL THEN N'Administrator' ELSE DisplayName END,
    Role = N'ADMIN',
    IsActive = 1
WHERE Id = @Id;
"@
        [void]$updateAdmin.Parameters.Add('@CompanyId', [System.Data.SqlDbType]::UniqueIdentifier)
        [void]$updateAdmin.Parameters.Add('@Id', [System.Data.SqlDbType]::UniqueIdentifier)
        $updateAdmin.Parameters['@CompanyId'].Value = $companyId
        $updateAdmin.Parameters['@Id'].Value = $existingId
        [void]$updateAdmin.ExecuteNonQuery()
        $updateAdmin.Dispose()
    }

    # 3. Create the zero-value discount settings row for the default company.
    $settingsCommand = $connection.CreateCommand()
    $settingsCommand.CommandText = @"
IF NOT EXISTS (SELECT 1 FROM dbo.BillingDiscountSettings WHERE CompanyId = @CompanyId)
BEGIN
    INSERT INTO dbo.BillingDiscountSettings
        (Id, CompanyId, DefaultSalespersonDiscountPercent, MaxSalespersonDiscountPercent, UpdatedAtUtc, UpdatedByUserId)
    VALUES
        (NEWID(), @CompanyId, 0, 0, SYSUTCDATETIME(), NULL);
END;
"@
    [void]$settingsCommand.Parameters.Add('@CompanyId', [System.Data.SqlDbType]::UniqueIdentifier)
    $settingsCommand.Parameters['@CompanyId'].Value = $companyId
    [void]$settingsCommand.ExecuteNonQuery()
    $settingsCommand.Dispose()

    Write-Host "Initial data ready. Default company: AVA001 / AVA Surfaces" -ForegroundColor Green
    Write-Host "Bootstrap administrator: $AdminUserName / $AdminPassword" -ForegroundColor Green
}
finally {
    if ($connection.State -ne [System.Data.ConnectionState]::Closed) { $connection.Close() }
    $connection.Dispose()
}
