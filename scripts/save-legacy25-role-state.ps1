try {
    [Console]::InputEncoding=New-Object Text.UTF8Encoding($false)
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    $packet=[Console]::In.ReadToEnd() | ConvertFrom-Json
    if($packet.prefix -notmatch '^phase1-(legacy25-binary|private-enrollment)-[a-f0-9-]{36}$'){throw 'Prefix'}
    $run=[Guid]::Parse($packet.run).ToString('D')
    $root=Get-Dev155CredentialLocation;Assert-Dev155Acl $root
    $path=Join-Path $root ($packet.prefix+'.'+$run+'.role-state.dpapi')
    if(Test-Path -LiteralPath $path){throw 'No overwrite'}
    $text=$packet.state | ConvertTo-Json -Depth 10 -Compress
    $secure=ConvertTo-SecureString $text -AsPlainText -Force
    try {
        $cipher=ConvertFrom-SecureString $secure
        $stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        try {$bytes=[Text.Encoding]::UTF8.GetBytes($cipher);$stream.Write($bytes,0,$bytes.Length)} finally {$stream.Dispose()}
        Set-Dev155PrivateAcl $path $false;Assert-Dev155Acl $path
        $roundtrip=ConvertTo-SecureString ([IO.File]::ReadAllText($path));$ptr=[IntPtr]::Zero
        try {$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($roundtrip);if([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) -cne $text){throw 'Roundtrip'}}finally{if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)};$roundtrip.Dispose()}
    } finally {$secure.Dispose();$text=$null;$cipher=$null;$packet=$null}
    Write-Output 'ROLE_STATE_DPAPI_VERIFIED'
} catch {Write-Output 'ROLE_STATE_BACKUP_BLOCKED';exit 1}
