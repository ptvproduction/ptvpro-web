$script:Dev155Stage = 'S01-LOAD'
try {
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    Assert-Dev155ManualConsole
    $script:Dev155Stage = 'S02-PRIVATE-LOCATION'
    $root = Get-Dev155CredentialLocation
    $path = Join-Path $root 'staging-password.dpapi'
    if (Test-Path -LiteralPath $path) { $script:Dev155Stage = 'S02-ALREADY-EXISTS'; throw 'Credential already exists; no overwrite permitted.' }
    $script:Dev155Stage = 'S03-DIRECTORY-ACL'
    if (Test-Path -LiteralPath $root) { Assert-Dev155Acl $root }
    else {
        $null = New-Item -ItemType Directory -Path $root -ErrorAction Stop
        Set-Dev155PrivateAcl $root $true
    }
    $password = $null
    $probe = $null
    try {
        $script:Dev155Stage = 'S04-SECRET-PROMPT'
        $password = Read-Host 'Password PostgreSQL STAGING (hidden)' -AsSecureString
        if ($password.Length -eq 0) { throw 'Empty password is not permitted.' }
        $script:Dev155Stage = 'S05-DPAPI-SAVE'
        $encrypted = ConvertFrom-SecureString -SecureString $password
        $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try {
            $bytes = [Text.Encoding]::UTF8.GetBytes($encrypted)
            $stream.Write($bytes, 0, $bytes.Length)
        } finally { $stream.Dispose() }
        $script:Dev155Stage = 'S06-FILE-ACL'
        Set-Dev155PrivateAcl $path $false
        $script:Dev155Stage = 'S07-DPAPI-CHECK'
        $probe = ConvertTo-SecureString -String ([IO.File]::ReadAllText($path)) -ErrorAction Stop
        if ($probe.Length -ne $password.Length) { throw 'Credential verification failed.' }
        Write-Host 'Credential saved with current-user Windows DPAPI; ACL and decrypt checks passed.'
        Write-Host 'No network request made. This does not verify database password correctness.'
    } finally {
        if ($probe) { $probe.Dispose() }
        if ($password) { $password.Dispose() }
        $encrypted = $null
    }
} catch {
    Write-Host ('DEV155 code: ' + $script:Dev155Stage)
    Write-Host 'Setup stopped. No credential details will be printed. Do not paste password or error dumps into chat.'
    exit 1
}
