param([Parameter(Mandatory=$true)][string]$ReviewPath)

try {
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    $databaseSecret = Read-Dev155SecurePassword
    $portalSecret = $null; $dbPtr = [IntPtr]::Zero; $portalPtr = [IntPtr]::Zero
    try {
        $reviewFile = [IO.Path]::GetFullPath($ReviewPath)
        $repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\') + '\'
        if ($reviewFile.StartsWith($repo,[StringComparison]::OrdinalIgnoreCase)) { throw 'Review must remain private outside Git.' }
        Assert-Dev155Acl $reviewFile
        if ((Get-Item -LiteralPath $reviewFile).Length -gt 65536) { throw 'Review size limit.' }
        $review = [IO.File]::ReadAllText($reviewFile) | ConvertFrom-Json
        if ($review.scope -cne 'ENROLL_INACTIVE_ACCOUNT_ONLY' -or $review.privacy_logging_approved -ne $true) { throw 'Separate reviewed enrollment/privacy ACC required.' }
        $accountId = [Guid]::Parse($review.account_id)
        $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
        if (@($listeners | Where-Object LocalPort -eq 5174).Count) { throw 'Writer active.' }
        $writers = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
            $_.Name -match '^(node|python|php|psql)(\.exe)?$' -and
            $_.CommandLine -match '(?i)(vite.*--mode\s+staging|sync-legacy|legacy-data-importer|migrate-legacy|importer.*ptvpro)'
        })
        if ($writers.Count) { throw 'Writer active.' }
        $leaseRoot = Get-Dev155CredentialLocation; Assert-Dev155Acl $leaseRoot
        $pendingPath = Join-Path $leaseRoot 'phase1-private-enrollment.in-progress.json'
        if (Test-Path -LiteralPath $pendingPath) { throw 'Prior enrollment unresolved; preserve private role-state backup and maintenance.' }
        $root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PTVPRO-Phase1-Private'
        Assert-Dev155Acl $root
        $passwordFile = Join-Path $root ($accountId.ToString('D') + '.password.dpapi')
        Assert-Dev155Acl $passwordFile
        if ((Get-Item -LiteralPath $passwordFile).Length -gt 65536) { throw 'Credential size limit.' }
        Write-Host 'This enrolls a private password on an existing INACTIVE Staging account only. It does not activate login.'
        Write-Host 'Only continue after separate enrollment ACC and independent owner/recovery verification.'
        if ((Read-Host 'Type ENROLL INACTIVE ONLY') -cne 'ENROLL INACTIVE ONLY') { throw 'Confirmation required.' }
        $portalSecret = ConvertTo-SecureString -String ([IO.File]::ReadAllText($passwordFile))
        $dbPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($databaseSecret)
        $portalPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($portalSecret)
        $packet = @{manual_console_confirmed=$true;review=$review;
            database_password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($dbPtr);
            password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($portalPtr);
            approved_ca_sha256=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'certificates/supabase-prod-ca-2021.crt') -Algorithm SHA256).Hash.ToLowerInvariant()}
        $start = [Diagnostics.ProcessStartInfo]::new()
        $start.FileName = (Get-Command node.exe -ErrorAction Stop).Source
        $start.Arguments = '"' + (Join-Path $PSScriptRoot 'enroll-phase1-private.mjs') + '" --execute-reviewed-enrollment'
        $start.UseShellExecute = $false; $start.CreateNoWindow = $true
        $start.RedirectStandardInput = $true; $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
        foreach ($key in @($start.EnvironmentVariables.Keys)) { if ([string]$key -like 'PG*' -or [string]$key -in @('NODE_OPTIONS','NODE_PATH')) { $start.EnvironmentVariables.Remove([string]$key) } }
        $child = [Diagnostics.Process]::new(); $child.StartInfo = $start
        try {
            $lease = [IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
            try { $bytes=[Text.Encoding]::UTF8.GetBytes('{"state":"RUNNING_OR_UNRESOLVED","maintenance":"ON"}');$lease.Write($bytes,0,$bytes.Length) } finally { $lease.Dispose() }
            Set-Dev155PrivateAcl $pendingPath $false
            $null = $child.Start()
            $output = $child.StandardOutput.ReadToEndAsync(); $errors = $child.StandardError.ReadToEndAsync()
            $writer = [IO.StreamWriter]::new($child.StandardInput.BaseStream,(New-Object Text.UTF8Encoding($false)),4096,$false)
            try { $writer.Write(($packet | ConvertTo-Json -Depth 20 -Compress)) } finally { $writer.Dispose(); $packet=$null }
            if (-not $child.WaitForExit(180000)) { $child.Kill(); throw 'Enrollment timed out; keep maintenance and inspect private role backup.' }
            $safeOutput = $output.GetAwaiter().GetResult()
            $null = $errors.GetAwaiter().GetResult()
            $result = $safeOutput | ConvertFrom-Json
            if ($result.privacyRestored -eq $true -and $result.code -in @('PASS','BLOCKED')) { Remove-Item -LiteralPath $pendingPath -ErrorAction Stop }
            if ($result.code -eq 'LOGGING_RESTORE_FAILED' -or $result.code -eq 'COMMIT_OUTCOME_UNKNOWN') { Write-Host 'CONTAINMENT: preserve private role-state backup and keep maintenance ON. Do not retry blindly.' }
            if ($child.ExitCode -ne 0) { throw 'Enrollment rejected.' }
            if ($result.success -ne $true -or $result.accountActivated -ne $false -or $result.gateChanged -ne $false -or $result.privacyRestored -ne $true) { throw 'Unexpected result.' }
            Write-Host 'PASS: private enrollment completed; account remains inactive, gate unchanged, no session issued.'
        } finally { $child.Dispose(); $packet=$null; $safeOutput=$null }
    } finally {
        if ($dbPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($dbPtr) }
        if ($portalPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($portalPtr) }
        if ($portalSecret) { $portalSecret.Dispose() }; if ($databaseSecret) { $databaseSecret.Dispose() }
    }
} catch {
    Write-Host 'ENROLLMENT BLOCKED. No secret or raw server details printed. Preserve private artifacts.'
    exit 1
}
