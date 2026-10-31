Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Dev155Project = 'swadgljnyelsjstqqxbm'

function Test-Dev155TrustedDesktopLauncher($Process) {
    $executable = [string]$Process.ExecutablePath
    if (-not $executable) { return $false }
    $windows = [Environment]::GetFolderPath('Windows')
    $programFiles = [Environment]::GetFolderPath('ProgramFiles')
    $explorer = Join-Path $windows 'explorer.exe'
    $apps = (Join-Path $programFiles 'WindowsApps').TrimEnd('\') + '\'
    $isExplorer = $Process.Name -ieq 'explorer.exe' -and $executable -ieq $explorer
    $isTerminal = $Process.Name -ieq 'WindowsTerminal.exe' -and
        $executable.StartsWith($apps, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($executable)) -like 'Microsoft.WindowsTerminal*'
    if (-not ($isExplorer -or $isTerminal)) { return $false }
    $signature = Get-AuthenticodeSignature -LiteralPath $executable -ErrorAction Stop
    return $signature.Status -eq 'Valid' -and $null -ne $signature.SignerCertificate -and
        $signature.SignerCertificate.Subject -match '(^|,\s*)O=Microsoft Corporation(,|$)'
}

function Assert-Dev155TerminalAncestry {
    $script:Dev155Stage = 'C04-ANCESTRY'
    $ancestor = $PID
    $seen = @{}
    $trustedLauncher = $false
    while ($ancestor -gt 0 -and -not $seen.ContainsKey($ancestor)) {
        $seen[$ancestor] = $true
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ancestor" -ErrorAction Stop
        if (-not $process) {
            $script:Dev155Stage = 'C04-MISSING-PARENT'
            Write-Host ('DEV155: terminal ancestor PID ' + $ancestor + ' is unavailable. Open a fresh Windows PowerShell from Win+R; do not reuse this terminal.')
            throw 'Cannot verify terminal process ancestry; no credential or database access attempted.'
        }
        if ($process.Name -match '^(codex|node|electron|code|cursor|antigravity)(\.exe)?$') {
            $script:Dev155Stage = 'C04-AGENT-PARENT'
            throw 'Agent/editor process ancestry is not permitted.'
        }
        if (Test-Dev155TrustedDesktopLauncher $process) {
            $trustedLauncher = $true
            break
        }
        $ancestor = [int]$process.ParentProcessId
    }
    if (-not $trustedLauncher) { $script:Dev155Stage = 'C04-NO-TRUSTED-LAUNCHER'; throw 'No verified desktop launcher.' }
}

function Read-Dev155ManualConfirmation {
    $confirmation = Read-Host -Prompt 'MANUAL DEV155'
    if ($confirmation -cne 'MANUAL DEV155') {
        if ([string]::IsNullOrEmpty($confirmation)) {
            Write-Host 'DEV155 confirmation rejected: empty input.'
        } else {
            Write-Host 'DEV155 confirmation rejected: exact phrase required.'
        }
        throw 'Type MANUAL DEV155 to confirm the external console.'
    }
}

function Assert-Dev155ManualConsole {
    $script:Dev155Stage = 'C01-CONSOLE'
    if ($env:OS -ne 'Windows_NT' -or $Host.Name -ne 'ConsoleHost' -or
        [Console]::IsInputRedirected -or [Console]::IsOutputRedirected -or
        -not [Environment]::UserInteractive) { throw 'Use an external interactive Windows PowerShell console.' }
    $script:Dev155Stage = 'C02-LANGUAGE'
    if ($ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') { throw 'Unsupported PowerShell language mode.' }
    $script:Dev155Stage = 'C03-AGENT-ENV'
    foreach ($name in @('CODEX_THREAD_ID', 'CODEX_CI', 'CODEX_SANDBOX_NETWORK_DISABLED', 'VSCODE_PID')) {
        if ([Environment]::GetEnvironmentVariable($name)) { throw 'Agent/editor terminal is not permitted.' }
    }
    Assert-Dev155TerminalAncestry
    $script:Dev155Stage = 'C05-TRANSCRIPT-POLICY'
    foreach ($hive in @('HKLM:', 'HKCU:')) {
        foreach ($branch in @('Software\Policies\Microsoft\Windows\PowerShell\Transcription', 'Software\Policies\Microsoft\PowerShellCore\Transcription')) {
            $policy = Get-ItemProperty -LiteralPath "$hive\$branch" -ErrorAction SilentlyContinue
            if ($policy -and $policy.PSObject.Properties['EnableTranscripting'] -and $policy.EnableTranscripting -eq 1) {
                throw 'Mandatory transcription is enabled; use an approved secret-input environment.'
            }
        }
    }
    $script:Dev155Stage = 'C06-MANUAL-CONFIRM'
    try { $null = Stop-Transcript -ErrorAction Stop } catch { }
    Set-PSDebug -Off
    Write-Host 'Target: ptvpro-staging / swadgljnyelsjstqqxbm. No database connection will be made.'
    Write-Host 'External console only. Do not continue while screen/session recording is active.'
    Write-Host 'Type MANUAL DEV155 and press Enter to confirm.'
    Read-Dev155ManualConfirmation
}

function Get-Dev155CredentialLocation {
    $base = [Environment]::GetFolderPath('LocalApplicationData')
    if (-not $base) { throw 'Local application data unavailable.' }
    $root = Join-Path $base 'PTVPRO-DEV155-Private'
    $repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\') + '\'
    if ([IO.Path]::GetFullPath($root).StartsWith($repo, [StringComparison]::OrdinalIgnoreCase)) { throw 'Private directory must be outside repository.' }
    return $root
}

function Assert-Dev155Acl([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse points are not permitted.' }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = Get-Acl -LiteralPath $Path
    if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'Private ownership/inheritance check failed.' }
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    if ($rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid.Value -or
        $rules[0].AccessControlType -ne 'Allow' -or $rules[0].FileSystemRights -ne 'FullControl') { throw 'Private ACL check failed.' }
}

function Set-Dev155PrivateAcl([string]$Path, [bool]$Directory) {
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    if ($Directory) { $acl = New-Object Security.AccessControl.DirectorySecurity }
    else { $acl = New-Object Security.AccessControl.FileSecurity }
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $Path -AclObject $acl
    Assert-Dev155Acl $Path
}

function Read-Dev155SecurePassword {
    Assert-Dev155ManualConsole
    $script:Dev155Stage = 'R02-ACL'
    $root = Get-Dev155CredentialLocation
    Assert-Dev155Acl $root
    $path = Join-Path $root 'staging-password.dpapi'
    Assert-Dev155Acl $path
    if ((Get-Item -LiteralPath $path).Length -gt 65536) { throw 'Invalid credential file size.' }
    $script:Dev155Stage = 'R03-DPAPI'
    $secure = ConvertTo-SecureString -String ([IO.File]::ReadAllText($path)) -ErrorAction Stop
    if ($secure.Length -eq 0) { $secure.Dispose(); throw 'Empty credential.' }
    return $secure
}
