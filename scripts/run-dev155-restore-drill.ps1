# Run manually in an external Windows PowerShell console. Never run through an agent tool.
$script:Dev155Stage = 'D00-LOAD'
$script:Dev155CloudPassword = $null
$script:Dev155Keeper = $null
$script:Dev155Bin = 'C:\Program Files\PostgreSQL\17\bin'
$script:Dev155RootCertificate = Join-Path $PSScriptRoot 'certificates\supabase-prod-ca-2021.crt'
$script:Dev155Run = $null
$script:Dev155Outcome = 'BLOCKED'

function Invoke-Dev155Native {
    param([string]$Tool, [string[]]$Arguments, [string]$InputText = '', [switch]$Cloud, [int]$TimeoutSeconds = 300, [string]$EncryptedOutput = '')
    # All arguments are fixed or generated paths/identifiers, never a password or connection URI.
    foreach ($argument in $Arguments) {
        if ($argument.Contains('"') -or $argument.Contains("`n") -or $argument.Contains("`r") -or $argument.EndsWith('\')) { throw 'Unsafe argument.' }
    }
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = Join-Path $script:Dev155Bin ($Tool + '.exe')
    $info.Arguments = ($Arguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($key in @($info.EnvironmentVariables.Keys)) {
        if ([string]$key -like 'PG*') { $info.EnvironmentVariables.Remove([string]$key) }
    }
    $info.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '10'
    if ($Cloud) {
        $info.EnvironmentVariables['PGHOST'] = 'db.swadgljnyelsjstqqxbm.supabase.co'
        $info.EnvironmentVariables['PGPORT'] = '5432'
        $info.EnvironmentVariables['PGUSER'] = 'postgres'
        $info.EnvironmentVariables['PGDATABASE'] = 'postgres'
        $info.EnvironmentVariables['PGSSLMODE'] = 'verify-full'
        $info.EnvironmentVariables['PGSSLROOTCERT'] = $script:Dev155RootCertificate
        $info.EnvironmentVariables['PGOPTIONS'] = '-c default_transaction_read_only=on -c lock_timeout=3000 -c statement_timeout=120000 -c idle_in_transaction_session_timeout=600000'
        $pointer = [IntPtr]::Zero
        try {
            $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($script:Dev155CloudPassword)
            $info.EnvironmentVariables['PGPASSWORD'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            $process = New-Object Diagnostics.Process
            $process.StartInfo = $info
            $null = $process.Start()
        } finally {
            $info.EnvironmentVariables.Remove('PGPASSWORD')
            if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
        }
    } else { throw 'This runner only permits read-only cloud children.' }
    $stdout = $null
    if (-not $EncryptedOutput) { $stdout = $process.StandardOutput.ReadToEndAsync() }
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.StandardInput.Write($InputText)
    $process.StandardInput.Close()
    try {
        if ($EncryptedOutput) {
            $null = Write-Dev155EnvelopeFile $EncryptedOutput $process.StandardOutput.BaseStream
            Set-Dev155PrivateAcl $EncryptedOutput $false
        }
    } catch {
        if (-not $process.HasExited) { $process.Kill() }
        $process.Dispose()
        throw 'Encrypted stream failed.'
    }
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        $process.Kill()
        $process.Dispose()
        throw 'Child process timeout.'
    }
    $status = $process.ExitCode
    $output = ''
    if ($stdout) { $output = $stdout.GetAwaiter().GetResult() }
    $null = $stderr.GetAwaiter().GetResult()
    $process.Dispose()
    if ($status -ne 0) { throw 'Child process failed; no raw diagnostics will be printed.' }
    return $output
}

function Write-Dev155PrivateText([string]$Path, [string]$Text) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
    $stream = New-Object IO.MemoryStream(,$bytes)
    try { $null = Write-Dev155EnvelopeFile ($Path + '.dpapi') $stream; Set-Dev155PrivateAcl ($Path + '.dpapi') $false }
    finally { $stream.Dispose(); [Array]::Clear($bytes, 0, $bytes.Length) }
}

try {
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    . (Join-Path $PSScriptRoot 'dev155-dpapi-envelope.ps1')
    Add-Type -AssemblyName System.Security
    $script:Dev155Stage = 'D01-CA-CERTIFICATE'
    if ((Get-FileHash -LiteralPath $script:Dev155RootCertificate -Algorithm SHA256).Hash -ne '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7') { throw 'Official CA file mismatch.' }
    # This reader performs the manual-console check before DPAPI access.
    $script:Dev155CloudPassword = Read-Dev155SecurePassword
    $script:Dev155Stage = 'D01-TOOLS'
    foreach ($tool in @('psql', 'pg_dump')) {
        if (-not (Test-Path -LiteralPath (Join-Path $script:Dev155Bin ($tool + '.exe')))) { throw 'PostgreSQL17 tools missing.' }
    }
    $script:Dev155Stage = 'D02-ENCRYPTED-STORAGE'
    $root = Get-Dev155CredentialLocation
    Assert-Dev155Acl $root
    $runName = 'drill155-' + [Guid]::NewGuid().ToString('N')
    $script:Dev155Run = Join-Path $root $runName
    $null = New-Item -ItemType Directory -Path $script:Dev155Run
    Set-Dev155PrivateAcl $script:Dev155Run $true
    Write-Dev155PrivateText (Join-Path $script:Dev155Run 'encryption-probe.txt') 'SYNTHETIC STORAGE PROBE'
    $script:Dev155Stage = 'D03-SOURCE-IDENTITY'
    $identitySql = "BEGIN READ ONLY; SELECT json_build_object('read_only',current_setting('transaction_read_only'),'fingerprint',md5((SELECT system_identifier::text FROM pg_control_system())),'version',current_setting('server_version_num'),'role',current_user,'database',current_database(),'ssl',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid())); ROLLBACK;"
    $identity = (Invoke-Dev155Native psql @('-X','-qAt','-w','-v','ON_ERROR_STOP=1') $identitySql -Cloud) | ConvertFrom-Json
    if ($identity.fingerprint -ne '72737c1de8ff53d24950c9d2b30bd42d' -or $identity.read_only -ne 'on' -or $identity.role -ne 'postgres' -or $identity.database -ne 'postgres' -or -not $identity.ssl -or [int]$identity.version -lt 170000 -or [int]$identity.version -ge 180000) { throw 'Source identity mismatch.' }
    $script:Dev155Stage = 'D04-SNAPSHOT'
    # Hold one read-only exported snapshot. Password is inherited only by this child process.
    $keeperInfo = New-Object Diagnostics.ProcessStartInfo
    $keeperInfo.FileName = Join-Path $script:Dev155Bin 'psql.exe'
    $keeperInfo.Arguments = '-X -qAt -w -v ON_ERROR_STOP=1'
    $keeperInfo.UseShellExecute = $false
    $keeperInfo.CreateNoWindow = $true
    $keeperInfo.RedirectStandardInput = $true
    $keeperInfo.RedirectStandardOutput = $true
    $keeperInfo.RedirectStandardError = $true
    foreach ($key in @($keeperInfo.EnvironmentVariables.Keys)) { if ([string]$key -like 'PG*') { $keeperInfo.EnvironmentVariables.Remove([string]$key) } }
    foreach ($entry in @{PGHOST='db.swadgljnyelsjstqqxbm.supabase.co';PGPORT='5432';PGUSER='postgres';PGDATABASE='postgres';PGSSLMODE='verify-full';PGSSLROOTCERT=$script:Dev155RootCertificate;PGCONNECT_TIMEOUT='10';PGOPTIONS='-c default_transaction_read_only=on -c lock_timeout=3000 -c idle_in_transaction_session_timeout=600000'}.GetEnumerator()) { $keeperInfo.EnvironmentVariables[$entry.Key]=$entry.Value }
    $pointer = [IntPtr]::Zero
    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($script:Dev155CloudPassword)
        $keeperInfo.EnvironmentVariables['PGPASSWORD'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        $script:Dev155Keeper = New-Object Diagnostics.Process
        $script:Dev155Keeper.StartInfo = $keeperInfo
        $null = $script:Dev155Keeper.Start()
    } finally {
        $keeperInfo.EnvironmentVariables.Remove('PGPASSWORD')
        if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    }
    $keeperError = $script:Dev155Keeper.StandardError.ReadToEndAsync()
    $script:Dev155Keeper.StandardInput.WriteLine('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();')
    $script:Dev155Keeper.StandardInput.Flush()
    $snapshotTask = $script:Dev155Keeper.StandardOutput.ReadLineAsync()
    if (-not $snapshotTask.Wait(30000)) { throw 'Snapshot timeout.' }
    $snapshot = $snapshotTask.Result
    if ($snapshot -notmatch '^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$') { throw 'Invalid exported snapshot.' }
    $checks = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\docs\PTVPRO-DEV-154-RESTORE-CHECKS.sql'))
    $sourceChecks = $checks.Replace('SET LOCAL TIME ZONE', "SET TRANSACTION SNAPSHOT '$snapshot';`nSET LOCAL TIME ZONE")
    $before = Invoke-Dev155Native psql @('-X','-qAt','-w','-v','ON_ERROR_STOP=1') $sourceChecks -Cloud
    $null = $before | ConvertFrom-Json
    Write-Dev155PrivateText (Join-Path $script:Dev155Run 'before.json') $before
    $roleSql = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '$snapshot'; SELECT coalesce(json_agg(json_build_object('name',rolname,'super',rolsuper,'bypass',rolbypassrls,'inherit',rolinherit,'login',rolcanlogin) ORDER BY rolname),'[]'::json) FROM pg_roles WHERE rolname !~ '^pg_'; ROLLBACK;"
    $rolesText = Invoke-Dev155Native psql @('-X','-qAt','-w','-v','ON_ERROR_STOP=1') $roleSql -Cloud
    Write-Dev155PrivateText (Join-Path $script:Dev155Run 'roles.json') $rolesText
    $archive = Join-Path $script:Dev155Run 'staging.dump.dpapi'
    $script:Dev155Stage = 'D05-DUMP'
    $null = Invoke-Dev155Native pg_dump @('-w','-Fc','--lock-wait-timeout=3000',('--snapshot='+$snapshot)) '' -Cloud -TimeoutSeconds 300 -EncryptedOutput $archive
    $script:Dev155Keeper.StandardInput.WriteLine('ROLLBACK;')
    $script:Dev155Keeper.StandardInput.Close()
    if (-not $script:Dev155Keeper.WaitForExit(10000) -or $script:Dev155Keeper.ExitCode -ne 0) { throw 'Snapshot close failed.' }
    $script:Dev155Keeper.Dispose(); $script:Dev155Keeper = $null
    $checksum = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
    Write-Dev155PrivateText (Join-Path $script:Dev155Run 'archive.json') (@{sha256=$checksum;bytes=(Get-Item -LiteralPath $archive).Length;project='swadgljnyelsjstqqxbm';snapshot_consistent=$true;sequence_freeze=$false;encrypted='DPAPI-CurrentUser framed stream v1';scope='Full logical database, without global roles/passwords or Storage bytes';restore='NOT_YET_VERIFIED'} | ConvertTo-Json)
    Write-Host 'Snapshot captured on verified Staging; source transaction closed. Restore is not yet verified.'
    $script:Dev155Stage = 'D06-RESTORE-DEPENDENCIES'
    $script:Dev155Outcome = 'PARTIAL'
    Write-Host 'Encrypted snapshot and envelope verification completed. Restore BLOCKED: managed vault, role/event-trigger baseline and encrypted clone storage require preparation.'
    Write-Host 'No local database created; snapshot consistency excludes sequence/writer freeze and platform state. Not migration GO.'

} catch {
    Write-Host ('DEV155 drill code: '+$script:Dev155Stage)
    Write-Host 'BLOCKED: no raw server errors or secret values will be printed. Preserve private artifacts; do not paste them into chat.'
} finally {
    if ($script:Dev155Keeper) {
        try { $script:Dev155Keeper.StandardInput.Close(); if(-not $script:Dev155Keeper.WaitForExit(5000)){$script:Dev155Keeper.Kill()} } catch { }
        $script:Dev155Keeper.Dispose()
    }
    if ($script:Dev155CloudPassword) { $script:Dev155CloudPassword.Dispose(); $script:Dev155CloudPassword=$null }
    Write-Host ('DEV155 outcome: '+$script:Dev155Outcome+'. No migration/bootstrap/account change/deployment performed.')
}
if ($script:Dev155Outcome -eq 'BLOCKED') { exit 1 }
exit 2 # PARTIAL is deliberately not a successful full-restore quality gate.
