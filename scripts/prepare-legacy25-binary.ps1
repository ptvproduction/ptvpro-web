try {
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    $root=Get-Dev155CredentialLocation;Assert-Dev155Acl $root
    $old='phase1-legacy25-901ea015-5017-405b-9fc9-256eb30bfda1';$texts=@{}
    foreach($kind in @('sql','manifest','postflight')){
        $path=Join-Path $root ($old+'.'+$kind+'.dpapi');Assert-Dev155Acl $path
        $secure=ConvertTo-SecureString ([IO.File]::ReadAllText($path));$ptr=[IntPtr]::Zero
        try {$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure);$texts[$kind]=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}
        finally {if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)};$secure.Dispose()}
    }
    $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=(Get-Command node.exe).Source
    $start.Arguments='"'+(Join-Path $PSScriptRoot 'prepare-legacy25-binary.mjs')+'"'
    $start.WorkingDirectory=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $child=[Diagnostics.Process]::new();$child.StartInfo=$start;$null=$child.Start()
    try {
        $output=$child.StandardOutput.ReadToEndAsync();$errors=$child.StandardError.ReadToEndAsync()
        $pipe=[IO.StreamWriter]::new($child.StandardInput.BaseStream,(New-Object Text.UTF8Encoding($false)),4096,$false)
        try {$pipe.Write(($texts | ConvertTo-Json -Depth 20 -Compress))} finally {$pipe.Dispose()}
        if(-not $child.WaitForExit(30000)){$child.Kill();throw 'Timeout'}
        $encoded=$output.GetAwaiter().GetResult();$null=$errors.GetAwaiter().GetResult()
        if($child.ExitCode -ne 0){throw 'Preparation failed'}
        $built=$encoded | ConvertFrom-Json;$encoded=$null
        $prefix=[string]$built.descriptor.artifactPrefix
        if($prefix -notmatch '^phase1-legacy25-binary-[a-f0-9-]{36}$'){throw 'Prefix'}
        $texts.sql=[string]$built.sql
        $paths=@{}
        foreach($kind in @('sql','manifest','postflight')){
            $path=Join-Path $root ($prefix+'.'+$kind+'.dpapi')
            if(Test-Path -LiteralPath $path){throw 'No overwrite'}
            $secure=ConvertTo-SecureString $texts[$kind] -AsPlainText -Force
            try {
                $cipher=ConvertFrom-SecureString $secure
                $file=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
                try {$bytes=[Text.Encoding]::UTF8.GetBytes($cipher);$file.Write($bytes,0,$bytes.Length)}finally{$file.Dispose()}
                Set-Dev155PrivateAcl $path $false;Assert-Dev155Acl $path
                $check=ConvertTo-SecureString ([IO.File]::ReadAllText($path));$ptr=[IntPtr]::Zero
                try {$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($check);if([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) -cne $texts[$kind]){throw 'Roundtrip'}}
                finally {if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)};$check.Dispose()}
            }finally{$secure.Dispose();$cipher=$null;$bytes=$null}
            $paths[$kind]=$path
        }
        $built.descriptor | Add-Member -NotePropertyName paths -NotePropertyValue $paths
        $built.descriptor | Add-Member -NotePropertyName dpapiAndPrivateAclVerified -NotePropertyValue $true
        $reportPath=Join-Path $PSScriptRoot '../docs/PTVPRO-PHASE1-LEGACY25-BINARY-PACKAGE.json'
        [IO.File]::WriteAllText($reportPath,($built.descriptor | ConvertTo-Json -Depth 15)+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
        Write-Output ($built.descriptor | ConvertTo-Json -Depth 15 -Compress)
    } finally {$child.Dispose();$texts=$null;$built=$null}
}catch {Write-Output 'BINARY_ARTIFACT_PREPARATION_BLOCKED; no raw diagnostics or metadata printed.';exit 1}
