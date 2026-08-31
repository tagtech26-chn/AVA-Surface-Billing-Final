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
Name: "{group}\{#AppName}"; Filename: "http://localhost:5080"
Name: "{autodesktop}\{#AppName}"; Filename: "http://localhost:5080"

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{sys}\sc.exe"; Parameters: "delete {#ServiceName}"; Flags: runhidden waituntilterminated skipifdoesntexist

[Code]
var
  ServerPage: TInputQueryWizardPage;
  DbPage: TInputQueryWizardPage;
  ServerAddress: String;
  DatabaseServer: String;
  DatabaseName: String;

function NormalizeAddress(Value: String): String;
begin
  Result := Trim(Value);
  if Pos('http://', LowerCase(Result)) = 1 then
    Result := Copy(Result, 8, Length(Result));
  if Pos('https://', LowerCase(Result)) = 1 then
    Result := Copy(Result, 9, Length(Result));
  while (Length(Result) > 0) and (Result[Length(Result)] = '/') do
    Result := Copy(Result, 1, Length(Result) - 1);
end;

procedure InitializeWizard;
begin
  ServerPage := CreateInputQueryPage(wpSelectDir, 'Production Server', 'Configure application server', 'Enter the IP address or DNS hostname used by client machines.');
  ServerPage.Add('Server IP / hostname:', False);
  ServerPage.Values[0] := '192.168.1.50';
  DbPage := CreateInputQueryPage(ServerPage.ID, 'Production Database', 'Configure existing SQL Server', 'Enter the existing SQL Server instance and database name.');
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
      MsgBox('Please enter the production server IP address or hostname.', mbError, MB_OK);
      Result := False;
    end;
  end;
  if PageID = DbPage.ID then
  begin
    DatabaseServer := Trim(DbPage.Values[0]);
    DatabaseName := Trim(DbPage.Values[1]);
    if DatabaseServer = '' then
    begin
      MsgBox('Please enter the SQL Server instance.', mbError, MB_OK);
      Result := False;
    end;
    if DatabaseName = '' then
    begin
      MsgBox('Please enter the database name.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure WriteConfig;
var
  ConfigPath: String;
  ConfigText: String;
begin
  ConfigPath := ExpandConstant('{app}\AVA-Surface-Production.json');
  ConfigText := '{' + #13#10;
  ConfigText := ConfigText + '  "Server": { "IpAddress": "' + ServerAddress + '", "Port": 5080 },' + #13#10;
  ConfigText := ConfigText + '  "Database": { "Server": "' + DatabaseServer + '", "Database": "' + DatabaseName + '", "Authentication": "Windows" },' + #13#10;
  ConfigText := ConfigText + '  "Authentication": { "JwtSecret": "AVA-Production-Secret-1.1.0" },' + #13#10;
  ConfigText := ConfigText + '  "Cors": { "AllowedOrigins": [ "http://' + ServerAddress + ':5080" ] },' + #13#10;
  ConfigText := ConfigText + '  "AllowedHosts": "*"' + #13#10;
  ConfigText := ConfigText + '}';
  if not SaveStringToFile(ConfigPath, ConfigText, False) then
    RaiseException('Unable to create production configuration file.');
end;

procedure StartService;
var
  ResultCode: Integer;
  ExePath: String;
  ServiceCommand: String;
begin
  ExePath := ExpandConstant('{app}\{#AppExe}');
  ServiceCommand := 'create "{#ServiceName}" binPath= "' + ExePath + ' --urls http://0.0.0.0:5080" start= auto';
  if not Exec(ExpandConstant('{sys}\sc.exe'), ServiceCommand, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    RaiseException('Unable to create Windows service.');
  Exec(ExpandConstant('{sys}\sc.exe'), 'start "{#ServiceName}"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure AddFirewallRule;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\netsh.exe'), 'advfirewall firewall add rule name="Vero Billing System TCP 5080" dir=in action=allow protocol=TCP localport=5080 profile=domain,private', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  PowerShellParams: String;
  MigrationParams: String;
begin
  if CurStep = ssPostInstall then
  begin
    WriteConfig;
    PowerShellParams := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\database\Initialize-Sql.ps1') + '" -ConfigPath "' + ExpandConstant('{app}\AVA-Surface-Production.json') + '" -ServiceName "{#ServiceName}"';
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), PowerShellParams, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      RaiseException('Unable to start SQL initialization.');
    MigrationParams := '--connection "Server=' + DatabaseServer + ';Database=' + DatabaseName + ';Trusted_Connection=True;TrustServerCertificate=True"';
    if not Exec(ExpandConstant('{app}\database\efbundle.exe'), MigrationParams, ExpandConstant('{app}\database'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      RaiseException('Unable to start database migration.');
    StartService;
    AddFirewallRule;
  end;
end;
