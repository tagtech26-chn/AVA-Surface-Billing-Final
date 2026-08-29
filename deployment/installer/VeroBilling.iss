#define AppName "Vero Billing System"
#define AppPublisher "AVA Surfaces"
#define AppVersion "1.1.0"
#define ServiceName "VeroBillingService"
#define ServiceDisplayName "Vero Billing System"
#define AppExe "AVASurface.Server.exe"

[Setup]
AppId={{7A8B5E42-6D7D-4A9E-9A4A-VERO2026BILL}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\AVA Surfaces\Vero Billing System
DefaultGroupName={#AppName}
OutputDir=..\output
OutputBaseFilename=Vero-Billing-System-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#AppExe}
DisableProgramGroupPage=yes
CloseApplications=yes
RestartApplications=no

[Files]
Source: "..\..\artifacts\publish\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion; Excludes: "appsettings.Production.json"
Source: "..\..\artifacts\efbundle.exe"; DestDir: "{app}\database"; Flags: ignoreversion
Source: "..\scripts\Initialize-Sql.ps1"; DestDir: "{app}\database"; Flags: ignoreversion
Source: "..\prerequisites\SQLEXPR_x64_ENU.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "http://localhost:5080"
Name: "{autodesktop}\{#AppName}"; Filename: "http://localhost:5080"

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{sys}\sc.exe"; Parameters: "delete {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=\"Vero Billing System (TCP 5080)\""; Flags: runhidden waituntilterminated skipifdoesntexist

[Code]
const
  EnvKey = 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment';
  ServiceSid = 'NT SERVICE\VeroBillingService';
  ConnectionString = 'Server=.\SQLEXPRESS;Database=AVASurfaceBilling;Trusted_Connection=True;TrustServerCertificate=True';

function RunAndWait(const FileName, Params, WorkingDir: String; Show: Integer): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(FileName, Params, WorkingDir, Show, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function ServiceExists(const Name: String): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\sc.exe'), 'query "' + Name + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function GenerateSecret: String;
const
  Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
var
  I: Integer;
begin
  Result := '';
  Randomize;
  for I := 1 to 64 do
    Result := Result + Chars[Random(Length(Chars)) + 1];
end;

function GetJwtSecret: String;
var
  Existing: String;
begin
  if RegQueryStringValue(HKLM, EnvKey, 'Authentication__JwtSecret', Existing) and (Length(Existing) >= 32) then
    Result := Existing
  else
    Result := GenerateSecret;
end;

procedure WriteProductionConfig;
var
  ConfigPath: String;
  Secret: String;
  Json: String;
begin
  ConfigPath := ExpandConstant('{app}\appsettings.Production.json');
  if FileExists(ConfigPath) then
    Exit;

  Secret := GetJwtSecret;
  Json := '{' + #13#10 +
    '  "ConnectionStrings": {' + #13#10 +
    '    "DefaultConnection": "Server=.\\SQLEXPRESS;Database=AVASurfaceBilling;Trusted_Connection=True;TrustServerCertificate=True"' + #13#10 +
    '  },' + #13#10 +
    '  "Authentication": {' + #13#10 +
    '    "JwtSecret": "' + Secret + '"' + #13#10 +
    '  },' + #13#10 +
    '  "Cors": {' + #13#10 +
    '    "AllowedOrigins": []' + #13#10 +
    '  },' + #13#10 +
    '  "GstVerification": {' + #13#10 +
    '    "BaseUrl": "",' + #13#10 +
    '    "ApiToken": "",' + #13#10 +
    '    "ClientId": "",' + #13#10 +
    '    "ClientSecret": "",' + #13#10 +
    '    "RequesterGstin": "",' + #13#10 +
    '    "AuthToken": ""' + #13#10 +
    '  },' + #13#10 +
    '  "Logging": {' + #13#10 +
    '    "LogLevel": {' + #13#10 +
    '      "Default": "Information",' + #13#10 +
    '      "Microsoft.AspNetCore": "Warning",' + #13#10 +
    '      "Microsoft.EntityFrameworkCore.Database.Command": "Warning"' + #13#10 +
    '    },' + #13#10 +
    '    "EventLog": {' + #13#10 +
    '      "LogLevel": {' + #13#10 +
    '        "Default": "Information",' + #13#10 +
    '        "Microsoft": "Warning"' + #13#10 +
    '      }' + #13#10 +
    '    }' + #13#10 +
    '  },' + #13#10 +
    '  "AllowedHosts": "*"' + #13#10 +
    '}' + #13#10;

  SaveStringToFile(ConfigPath, Json, False);
  RegWriteStringValue(HKLM, EnvKey, 'Authentication__JwtSecret', Secret);
end;

procedure ProtectProductionConfig;
var
  ConfigPath: String;
  ResultCode: Integer;
begin
  ConfigPath := ExpandConstant('{app}\appsettings.Production.json');
  Exec(ExpandConstant('{sys}\icacls.exe'),
    '"' + ConfigPath + '" /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" "LOCAL SERVICE:R"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure ConfigureService;
var
  ExePath: String;
  ResultCode: Integer;
begin
  ExePath := ExpandConstant('{app}\{#AppExe}');

  if not ServiceExists('{#ServiceName}') then
    RunAndWait(ExpandConstant('{sys}\sc.exe'),
      'create "{#ServiceName}" binPath= "' + ExePath + '" start= auto obj= "NT AUTHORITY\LOCAL SERVICE" displayname= "{#ServiceDisplayName}"',
      '', SW_HIDE);

  RunAndWait(ExpandConstant('{sys}\sc.exe'),
    'config "{#ServiceName}" binPath= "' + ExePath + '" start= auto obj= "NT AUTHORITY\LOCAL SERVICE" displayname= "{#ServiceDisplayName}"',
    '', SW_HIDE);

  RunAndWait(ExpandConstant('{sys}\sc.exe'),
    'sidtype "{#ServiceName}" unrestricted',
    '', SW_HIDE);

  RunAndWait(ExpandConstant('{sys}\sc.exe'),
    'failure "{#ServiceName}" reset= 86400 actions= restart/60000/restart/60000/none/0',
    '', SW_HIDE);

  RunAndWait(ExpandConstant('{sys}\sc.exe'),
    'config "{#ServiceName}" depend= MSSQL$SQLEXPRESS',
    '', SW_HIDE);
end;

procedure InstallSqlExpressIfNeeded;
var
  SqlInstaller: String;
  ResultCode: Integer;
begin
  if ServiceExists('MSSQL$SQLEXPRESS') then
    Exit;

  SqlInstaller := ExpandConstant('{tmp}\SQLEXPR_x64_ENU.exe');
  if not FileExists(SqlInstaller) then
    RaiseException('SQL Server Express media was not found in the installer.');

  if not Exec(SqlInstaller,
    '/Q /ACTION=Install /FEATURES=SQL /INSTANCENAME=SQLEXPRESS /SQLSVCACCOUNT="NT SERVICE\MSSQL$SQLEXPRESS" /SQLSVCSTARTUPTYPE=Automatic /ADDCURRENTUSERASSQLADMIN=True /IACCEPTSQLSERVERLICENSETERMS',
    '', SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode) then
    RaiseException('Unable to start SQL Server Express setup.');

  if ResultCode <> 0 then
    RaiseException('SQL Server Express setup failed with exit code ' + IntToStr(ResultCode) + '.');
end;

procedure WaitForSql;
var
  I: Integer;
begin
  for I := 1 to 60 do
  begin
    if ServiceExists('MSSQL$SQLEXPRESS') then
      Exit;
    Sleep(1000);
  end;
  RaiseException('SQL Server Express service MSSQL$SQLEXPRESS was not detected after installation.');
end;

procedure PrepareExistingService;
var
  ResultCode: Integer;
begin
  if ServiceExists('{#ServiceName}') then
  begin
    Exec(ExpandConstant('{sys}\sc.exe'), 'stop "{#ServiceName}"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1500);
  end;
end;

procedure InitializeDatabase;
var
  ScriptPath: String;
  ResultCode: Integer;
  Params: String;
begin
  ScriptPath := ExpandConstant('{app}\database\Initialize-Sql.ps1');
  Params := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath + '"';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    RaiseException('Unable to start SQL initialization script.');
  if ResultCode <> 0 then
    RaiseException('SQL initialization failed with exit code ' + IntToStr(ResultCode) + '.');
end;

procedure ApplyMigrations;
var
  BundlePath: String;
  Params: String;
  ResultCode: Integer;
begin
  BundlePath := ExpandConstant('{app}\database\efbundle.exe');
  Params := '--connection "' + ConnectionString + '" --verbose';
  if not Exec(BundlePath, Params, ExpandConstant('{app}\database'), SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode) then
    RaiseException('Unable to start EF Core migration bundle.');
  if ResultCode <> 0 then
    RaiseException('Database migration failed with exit code ' + IntToStr(ResultCode) + '.');
end;

procedure ConfigureFirewall;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\netsh.exe'),
    'advfirewall firewall delete rule name="Vero Billing System (TCP 5080)"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\netsh.exe'),
    'advfirewall firewall add rule name="Vero Billing System (TCP 5080)" dir=in action=allow protocol=TCP localport=5080 profile=domain,private',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure StartBillingService;
var
  ResultCode: Integer;
begin
  if not RunAndWait(ExpandConstant('{sys}\sc.exe'), 'start "{#ServiceName}"', '', SW_HIDE) then
    RaiseException('Vero Billing System service could not be started.');

  Sleep(2000);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  PrepareExistingService;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    InstallSqlExpressIfNeeded;
    WaitForSql;
    ConfigureService;
    WriteProductionConfig;
    ProtectProductionConfig;
    InitializeDatabase;
    ApplyMigrations;
    ConfigureFirewall;
    StartBillingService;
  end;
end;
