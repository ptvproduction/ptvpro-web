param([Parameter(Mandatory=$true)][Guid]$AccountId)

# Offline preparation only. Reuse the existing verified external-console and private-ACL guards.
try {
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    Assert-Dev155ManualConsole
    if ($AccountId -eq [Guid]::Empty) { throw 'Existing approved account UUID required.' }
    $root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PTVPRO-Phase1-Private'
    if (Test-Path -LiteralPath $root) { Assert-Dev155Acl $root }
    else { $null = New-Item -ItemType Directory -Path $root; Set-Dev155PrivateAcl $root $true }
    $path = Join-Path $root ($AccountId.ToString('D') + '.password.dpapi')
    if (Test-Path -LiteralPath $path) { throw 'Existing private artifact must not be overwritten.' }
    Write-Host 'OFFLINE ONLY. Account UUID must come from approved provisioning, not from a testing account.'
    Write-Host 'Existing console guard uses its historical MANUAL DEV155 confirmation; no backup or database operation follows.'
    if ((Read-Host 'Retype the approved account UUID') -cne $AccountId.ToString('D')) { throw 'Account confirmation mismatch.' }
    $first = $null; $second = $null; $probe = $null
    $firstPtr = [IntPtr]::Zero; $secondPtr = [IntPtr]::Zero
    try {
        $first = Read-Host 'New owner-selected portal password (hidden)' -AsSecureString
        $second = Read-Host 'Repeat password (hidden)' -AsSecureString
        if ($first.Length -lt 12 -or $first.Length -ne $second.Length) { throw 'Password policy or confirmation mismatch.' }
        $firstPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
        $secondPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
        $different = 0
        for ($i = 0; $i -lt $first.Length; $i++) {
            $different = $different -bor ([Runtime.InteropServices.Marshal]::ReadInt16($firstPtr, 2*$i) -bxor [Runtime.InteropServices.Marshal]::ReadInt16($secondPtr, 2*$i))
        }
        if ($different -ne 0) { throw 'Password confirmation mismatch.' }
        # Byte count matches the existing bcrypt verifier; plaintext is transient process memory only.
        $transient = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPtr)
        try { if ([Text.Encoding]::UTF8.GetByteCount($transient) -gt 72) { throw 'Password exceeds bcrypt byte limit.' } }
        finally { $transient = $null }
        $encrypted = ConvertFrom-SecureString -SecureString $first
        $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $bytes = [Text.Encoding]::UTF8.GetBytes($encrypted); $stream.Write($bytes,0,$bytes.Length) }
        finally { $stream.Dispose() }
        Set-Dev155PrivateAcl $path $false
        Assert-Dev155Acl $path
        $probe = ConvertTo-SecureString -String ([IO.File]::ReadAllText($path))
        if ($probe.Length -ne $first.Length) { throw 'Local DPAPI verification failed.' }
        Write-Host 'Private current-user DPAPI artifact prepared. No account, credential or login was changed; no network request made.'
    } finally {
        if ($firstPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPtr) }
        if ($secondPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPtr) }
        if ($first) { $first.Dispose() }; if ($second) { $second.Dispose() }; if ($probe) { $probe.Dispose() }
        $encrypted = $null; $bytes = $null
    }
} catch {
    Write-Host 'PREPARATION STOPPED. No secret or raw error details printed. Do not paste private artifacts into chat.'
    exit 1
}
