try {
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    $package=Get-Content -Raw (Join-Path $PSScriptRoot '../docs/PTVPRO-PHASE1-LEGACY25-BINARY-PACKAGE.json') | ConvertFrom-Json
    if($package.version -ne 'COPY_BINARY_V1' -or $package.executionApproved -ne $true -or $package.approvedSqlSha256 -cne $package.sqlSha256){Write-Host 'LEGACY25 BLOCKED: PENDING_NEW_HASH_ACC. No credential read or database connection.';exit 1}
    Write-Host 'Approved Legacy25 migration: database connection follows credential loading only if every guard passes.'
    # This reader retains C01-CONSOLE, ancestry, transcription and manual-console checks.
    $databaseSecret = Read-Dev155SecurePassword
    $dbPtr = [IntPtr]::Zero
    $texts = @{}
    try {
        $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
        if (@($listeners | Where-Object LocalPort -eq 5174).Count) { throw 'WRITER_ACTIVE' }
        $writers = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
            $_.Name -match '^(node|python|php|psql)(\.exe)?$' -and
            $_.CommandLine -match '(?i)(vite.*--mode\s+staging|sync-legacy|legacy-data-importer|migrate-legacy|importer.*ptvpro)'
        })
        if ($writers.Count) { throw 'WRITER_ACTIVE' }
        $root = Get-Dev155CredentialLocation
        Assert-Dev155Acl $root
        $prefix = [string]$package.artifactPrefix
        if($prefix -notmatch '^phase1-legacy25-binary-[a-f0-9-]{36}$'){throw 'ARTIFACT_PREFIX'}
        $pendingPath=Join-Path $root ($prefix+'.in-progress.json')
        if(Test-Path -LiteralPath $pendingPath){Write-Host 'LEGACY25 CONTAINMENT: PRIOR_RUN_UNRESOLVED. Preserve role-state backup and keep maintenance ON.';exit 2}
        foreach ($kind in @('sql','manifest','postflight')) {
            $path = Join-Path $root ($prefix + '.' + $kind + '.dpapi')
            Assert-Dev155Acl $path
            if ((Get-Item -LiteralPath $path).Length -gt 1048576) { throw 'ARTIFACT_SIZE' }
            $secure = ConvertTo-SecureString ([IO.File]::ReadAllText($path))
            $ptr = [IntPtr]::Zero
            try {
                $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
                $texts[$kind] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
            } finally {
                if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
                $secure.Dispose()
            }
        }
        $dbPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($databaseSecret)
        $packet = @{operator_console_verified=$true;maintenance_checked_at=[DateTimeOffset]::UtcNow.ToString('o');
            database_password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($dbPtr);
            sql=$texts.sql;manifest=$texts.manifest;postflight=$texts.postflight;private_root=$root}
        $start = [Diagnostics.ProcessStartInfo]::new()
        $start.FileName = (Get-Command node.exe -ErrorAction Stop).Source
        $start.Arguments = '"' + (Join-Path $PSScriptRoot 'run-legacy25-staging.mjs') + '" --operator-execute-approved-legacy25'
        $start.WorkingDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
        $start.UseShellExecute=$false; $start.CreateNoWindow=$true
        $start.RedirectStandardInput=$true; $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
        $start.StandardOutputEncoding=New-Object Text.UTF8Encoding($false)
        foreach($key in @($start.EnvironmentVariables.Keys)) {
            if([string]$key -like 'PG*') { $start.EnvironmentVariables.Remove([string]$key) }
        }
        $child=[Diagnostics.Process]::new();$child.StartInfo=$start
        try {
            $lease=[IO.File]::Open($pendingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
            try {$bytes=[Text.Encoding]::UTF8.GetBytes('{"state":"RUNNING_OR_UNRESOLVED","maintenance":"ON"}');$lease.Write($bytes,0,$bytes.Length)}finally{$lease.Dispose()}
            Set-Dev155PrivateAcl $pendingPath $false
            $null=$child.Start()
            $output=$child.StandardOutput.ReadToEndAsync();$errors=$child.StandardError.ReadToEndAsync()
            $pipe=[IO.StreamWriter]::new($child.StandardInput.BaseStream,(New-Object Text.UTF8Encoding($false)),4096,$false)
            try {$pipe.Write(($packet | ConvertTo-Json -Depth 25 -Compress))} finally {$pipe.Dispose()}
            $packet=$null;$texts=$null
            if(-not $child.WaitForExit(900000)){ $child.Kill(); Write-Host 'LEGACY25 CONTAINMENT: TIMEOUT_OUTCOME_UNKNOWN. Keep maintenance ON; role-state DPAPI must be checked; do not rerun blindly.';exit 2 }
            $safe=$output.GetAwaiter().GetResult();$null=$errors.GetAwaiter().GetResult()
            try {$result=$safe | ConvertFrom-Json} catch {Write-Host 'LEGACY25 CONTAINMENT: RESULT_UNAVAILABLE. Keep maintenance ON; do not rerun blindly.';exit 2}
            if($result.status -notin @('EXECUTED_VERIFIED','NOOP_VERIFIED','BLOCKED','CONTAINMENT')){throw 'INVALID_RESULT'}
            # Only explicitly allowlisted aggregate fields are returned to the console.
            $summary=@{status=$result.status;code=$result.code;rows=$result.rows;receiptId=$result.receiptId;
                transactionId=$result.transactionId;postflight=$result.postflight;root=$result.root;gate=$result.gate;
                credentials=$result.credentials;maintenance='ON';privacyRestored=$result.privacyRestored;privacyBackup=$result.privacyBackup} | ConvertTo-Json -Depth 5 -Compress
            Write-Host $summary
            $resultPath=Join-Path $root ($prefix+'.execution-result.json')
            [IO.File]::WriteAllText($resultPath,$summary,(New-Object Text.UTF8Encoding($false)))
            Set-Dev155PrivateAcl $resultPath $false
            if($result.status -ne 'CONTAINMENT' -and ($result.privacyRestored -eq $true -or $result.privacyRestored -eq 'NOT_CHANGED')){Remove-Item -LiteralPath $pendingPath -ErrorAction Stop}
            if($child.ExitCode -ne 0){exit $child.ExitCode}
        } finally {$child.Dispose();$packet=$null;$safe=$null}
    } finally {
        if($dbPtr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($dbPtr)}
        $databaseSecret.Dispose();$texts=$null
    }
} catch {Write-Host 'LEGACY25 BLOCKED: LOCAL_GUARD. No raw diagnostics or secrets printed; keep maintenance ON.';exit 1}
