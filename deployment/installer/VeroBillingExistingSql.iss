#define AppName "Vero Billing System"
#define AppPublisher "AVA Surfaces"
#define AppVersion "1.1.0"
#define ServiceName "VeroBillingService"
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

[Files]
Source: "..\..\artifacts\publish\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion; Excludes: "appsettings.Production.json"
Source: "..\..\artifacts\efbundle.exe"; DestDir: "{app}\database"; Flags: ignoreversion
Source: "..\scripts\Initialize-Sql.ps1"; DestDir: "{app}\database"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{code:GetAppUrl}"
Name: "{autodesktop}\{#AppName}"; Filename: "{code:GetAppUrl}"

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{sys}\sc.exe"; Parameters: "delete {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=\"Vero Billing System (TCP 5080)\""; Flags: runhidden waituntilterminated skipifdoesntexist

[Code]
var
  ServerPage: TInputQueryWizardPage;
  DbPage: TInputQueryWizardPage;
  ServerAddress: String;
  DatabaseServer: String;
  DatabaseName: String;

function ExecWait(const FileName, Params: String): Boolean;
var
  R: Integer;
begin
  Result := Exec(FileName, Params, '', SW_HIDE, ewWaitUntilTerminated, R) and (R = 0);
end;

function ServiceExists(const Name: String): Boolean;
var
  R: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\sc.exe'), 'query "' + Name + '"', '', SW_HIDE, ewWaitUntilTerminated, R) and (R = 0);
end;

function NormalizeAddress(V: String): String;
begin
  Result := Trim(V);
  if Pos('http://', Lowercase(Result)) = 1 then
    Delete(Result, 1, 7)
  else if Pos('https://', Lowercase(Result)) = 1 then
    Delete(Result, 1, 8);
  while (Length(Result) > 0) and (Result[Length(Result)] = '/') do
    Delete(Result, Length(Result), 1);
end;

function GetAppUrl(P: String): String;
begin
  Result := 'http://' + ServerAddress + ':5080';
end;

function NewSecret: String;
const
  C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
var
  I: Integer;
begin
  Result := '';
  Randomize;
  for I := 1 to 64 do
    Result := Result + C[Random(Length(C)) + 1];
end;

procedure InitializeWizard;
begin
  ServerPage := CreateInputQueryPage(wpSelectDir, 'Production Server', 'Configure application server', 'Enter the LAN/static IP address or DNS hostname clients will use.');
  ServerPage.Add('Server IP / hostname:', False);
  ServerPage.Values[0] := '192.168.1.50';

  DbPage := CreateInputQueryPage(ServerPage.ID, 'Production Database', 'Configure existing SQL Server', 'SQL Server must already be installed on this machine or reachable over the network.');
  DbPage.Add('SQL Server instance:', False);
  DbPage.Add('Database name:', False);
  DbPage.Values[0] := '.\SQLEXPRESS';
  DbPage.Values[1] := 'AVASurfaceBilling';
end;

function NextButtonClick(PageID: Integer): Boolean;
begin
  Result := True;
  if PageID = ServerPage.ID then
  begin
    ServerAddress := NormalizeAddress(ServerPage.Values[0]);
    if ServerAddress = '' then
    begin
      MsgBox('Enter the production server IP/hostname.', mbError, MB_OK);
      Result := False;
    end;
  end
  else if PageID = DbPage.ID then
  begin
    DatabaseServer := Trim(DbPage.Values[0]);
    DatabaseName := Trim(DbPage.Values[1]);
    if DatabaseServer = '' then
    begin
      MsgBox('Enter the SQL Server instance.', mbError, MB_OK);
      Result := False;
    end
    else if DatabaseName = '' then
    begin
      MsgBox('Enter the database name.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure WriteConfig;
var
  P: String;
  S: String;
  J: String;
begin
  P := ExpandConstant('{app}\AVA-Surface-Production.json');
  if FileExists(P) then
    Exit;
  S := NewSecret;
  J := '{' + #13#10 +
       '  "Server":{"IpAddress":"' + ServerAddress + '","Port":5080},' + #13#10 +
       '  "Database":{"Server":"' + DatabaseServer + '","Database":"' + DatabaseName + '","Authentication":"Windows"},' + #13#10 +
       '  "Authentication":{"JwtSecret":"' + S + '"},' + #13#10 +
       '  "Cors":{"AllowedOrigins":["http://' + ServerAddress + ':5080"]},' + #13#10 +
       '  "GstVerification":{"BaseUrl":"","ApiToken":"","ClientId":"","ClientSecret":"","RequesterGstin":"","AuthToken":""},' + #13#10 +
       '  "AllowedHosts":"*"' + #13#10 +
       '}';
  SaveStringToFile(P, J, False);
end;

procedure ProtectConfig;
var
  R: Integer;
begin
  Exec(ExpandConstant('{sys}\icacls.exe'),
       '"' + ExpandConstant('{app}\AVA-Surface-Production.json') + '" /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" "LOCAL SERVICE:R"',
       '', SW_HIDE, ewWaitUntilTerminated, R);
end;

procedure ConfigureService;
var
  E: String;
  B: String;
begin
  E := ExpandConstant('{app}\{#AppExe}');
  B := '"' + E + '" --urls "http://' + ServerAddress + ':5080"';
  if not ServiceExists('{#ServiceName}') then
    ExecWait(ExpandConstant('{sys}\sc.exe'), 'create "{#ServiceName}" binPath= "' + B + '" start= auto obj= "NT AUTHORITY\LOCAL SERVICE" displayname= "{#AppName}"');
  ExecWait(ExpandConstant('{sys}\sc.exe'), 'config "{#ServiceName}" binPath= "' + B + '" start= auto obj= "NT AUTHORITY\LOCAL SERVICE" displayname= "{#AppName}"');
  ExecWait(ExpandConstant('{sys}\sc.exe'), 'sidtype "{#ServiceName}" unrestricted');
end;

procedure InitDb;
var
  P: String;
  R: Integer;
begin
  P := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\database\Initialize-Sql.ps1') + '" -ConfigPath "' + ExpandConstant('{app}\AVA-Surface-Production.json') + '" -ServiceName "{#ServiceName}"';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), P, '', SW_HIDE, ewWaitUntilTerminated, R) or (R <> 0) then
    RaiseException('SQL initialization failed.');
end;

procedure MigrateDb;
var
  P: String;
  R: Integer;
begin
  P := '--connection "Server=' + DatabaseServer + ';Database=' + DatabaseName + ';Trusted_Connection=True;TrustServerCertificate=True" --verbose';
  if not Exec(ExpandConstant('{app}\database\efbundle.exe'), P, ExpandConstant('{app}\database'), SW_SHOWNORMAL, ewWaitUntilTerminated, R) or (R <> 0) then
    RaiseException('Database migration failed.');
end;

procedure Firewall;
var
  R: Integer;
begin
  Exec(ExpandConstant('{sys}\netsh.exe'), 'advfirewall firewall add rule name="Vero Billing System (TCP 5080)" dir=in action=allow protocol=TCP localport=5080 profile=domain,private', '', SW_HIDE, ewWaitUntilTerminated, R);
end;

procedure CurStepChanged(Step: TSetupStep);
begin
  if Step = ssPostInstall then
  begin
    WriteConfig;
    ProtectConfig;
    InitDb;
    MigrateDb;
    ConfigureService;
    Firewall;
    if not ExecWait(ExpandConstant('{sys}\sc.exe'), 'start "{#ServiceName}"') then
      RaiseException('Vero Billing System service could not be started.');
  end;
end;

procedure CurUninstallStepChanged(Step: TUninstallStep);
begin
  if Step = usUninstall then
  begin
    ExecWait(ExpandConstant('{sys}\sc.exe'), 'stop "{#ServiceName}"');
    ExecWait(ExpandConstant('{sys}\sc.exe'), 'delete "{#ServiceName}"');
  end;
end;
