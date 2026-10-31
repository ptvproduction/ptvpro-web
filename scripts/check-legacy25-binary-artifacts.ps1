$ErrorActionPreference='Stop'
try {
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    $reportPath=Join-Path $PSScriptRoot '../docs/PTVPRO-PHASE1-LEGACY25-BINARY-PACKAGE.json'
    $package=Get-Content -Raw -LiteralPath $reportPath | ConvertFrom-Json
    if($package.version -ne 'COPY_BINARY_V1' -or $package.artifactPrefix -notmatch '^phase1-legacy25-binary-[a-f0-9-]{36}$'){throw 'Package'}
    $root=Get-Dev155CredentialLocation;Assert-Dev155Acl $root;$texts=@{}
    foreach($kind in @('sql','manifest','postflight')){
        $path=Join-Path $root ($package.artifactPrefix+'.'+$kind+'.dpapi');Assert-Dev155Acl $path
        $secure=ConvertTo-SecureString ([IO.File]::ReadAllText($path));$ptr=[IntPtr]::Zero
        try {$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);$texts[$kind]=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
        finally {if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)};$secure.Dispose()}
        $hash=[Security.Cryptography.SHA256]::Create()
        try {$digest=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($texts[$kind])))).Replace('-','').ToLowerInvariant()}
        finally {$hash.Dispose()}
        $key=$kind+'Sha256';if($digest -cne [string]$package.$key){throw 'Hash mismatch'}
    }
    $m=$texts.manifest | ConvertFrom-Json
    if($m.targets.Count -ne 25 -or ([DateTimeOffset]$m.expires_at) -le [DateTimeOffset]::UtcNow){throw 'Count/expiry'}
    if($texts.sql.Contains('m jsonb :=') -or $texts.sql.Contains('__APPROVED_') -or -not $texts.sql.Contains([string]$package.manifestSha256)){throw 'Transport binding'}
    foreach($t in $m.targets){
        if($texts.sql.Contains([string]$t.canonical_full_name) -or $texts.sql.Contains([string]$t.source_uuid) -or $texts.sql.Contains([string]$t.account_uuid) -or $texts.sql.Contains([string]$t.membership_uuid)){throw 'Private literal in SQL'}
    }
    $package | Add-Member -NotePropertyName independentVerification -NotePropertyValue @{checkedAt=[DateTimeOffset]::UtcNow.ToString('o');dpapiDecryption=$true;privateAcl=$true;allThreeHashes=$true;noPersonnelNamesOrUuidsInSql=$true;manifestChecksumBound=$true;targetCount=25;databaseConnection=$false} -Force
    [IO.File]::WriteAllText($reportPath,($package | ConvertTo-Json -Depth 15)+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
    Write-Output 'PASS: DPAPI/ACL, three SHA256, 25 targets, metadata-free SQL and manifest binding. No credential read, database connection or migration.'
}catch{Write-Output 'BINARY_ARTIFACT_CHECK_BLOCKED; no raw diagnostics or metadata printed.';exit 1}
finally{$texts=$null;$m=$null}
