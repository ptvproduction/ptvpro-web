# Synthetic bytes only. Does not load the credential reader or any database runner.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'dev155-dpapi-envelope.ps1')
Add-Type -AssemblyName System.Security
$passed = 0
function New-SyntheticEnvelope([int]$Size) {
    $bytes = New-Object byte[] $Size
    for ($i=0; $i -lt $bytes.Length; $i++) { $bytes[$i] = [byte]($i % 251) }
    $inputStream = New-Object IO.MemoryStream(,$bytes)
    $outputStream = New-Object IO.MemoryStream
    try { $null = Protect-Dev155Stream $inputStream $outputStream; return ,$outputStream.ToArray() }
    finally { $inputStream.Dispose(); $outputStream.Dispose() }
}
function Assert-Envelope([byte[]]$Bytes, [long]$Expected, [bool]$Reject = $false) {
    $stream = New-Object IO.MemoryStream(,$Bytes)
    $failed = $false
    try { $result=Test-Dev155Envelope $stream; if ($result.Bytes -ne $Expected) { throw 'Unexpected size.' } }
    catch { $failed=$true }
    finally { $stream.Dispose() }
    if ($failed -ne $Reject) { throw 'Synthetic integrity test failed.' }
    $script:passed++
}
foreach($size in @(0,1,1048576,2097169)) { Assert-Envelope (New-SyntheticEnvelope $size) $size }
$valid=New-SyntheticEnvelope 2097169
$bad=[byte[]]$valid.Clone();$bad[70]=$bad[70] -bxor 1;Assert-Envelope $bad 0 $true
$bad=[byte[]]$valid.Clone();$bad[10]=$bad[10] -bxor 1;Assert-Envelope $bad 0 $true
$bad=New-Object byte[] ($valid.Length-1);[Array]::Copy($valid,$bad,$bad.Length);Assert-Envelope $bad 0 $true
$bad=[byte[]]($valid+@(0));Assert-Envelope $bad 0 $true
$reader=New-Object IO.BinaryReader((New-Object IO.MemoryStream(,$valid)))
try {
    $header=$reader.ReadBytes(41)
    $records=New-Object 'Collections.Generic.List[byte[]]'
    while($reader.BaseStream.Position -lt $reader.BaseStream.Length) {
        $kind=$reader.ReadByte();$size=$reader.ReadInt32();$body=$reader.ReadBytes($size)
        $records.Add([byte[]](@($kind)+[BitConverter]::GetBytes($size)+$body))
    }
    $swapped=[byte[]]($header+$records[1]+$records[0]+$records[2]+$records[3])
    Assert-Envelope $swapped 0 $true
    $truncated=[byte[]]($header+$records[0]+$records[1]+$records[2])
    Assert-Envelope $truncated 0 $true
} finally { $reader.Dispose() }
foreach ($size in @(0,1,2097169)) {
    $encrypted = New-SyntheticEnvelope $size
    $inputStream = New-Object IO.MemoryStream(,$encrypted)
    $clear = $null
    try {
        $clear = Expand-Dev155EnvelopeToMemory $inputStream
        if ($clear.Length -ne $size) { throw 'Replay size failed.' }
        for ($i=0; $i -lt $size; $i++) { if ($clear.ReadByte() -ne ($i % 251)) { throw 'Replay content failed.' } }
        $passed++
    } finally { if ($clear) { [Array]::Clear($clear.GetBuffer(),0,[int]$clear.Length); $clear.Dispose() }; $inputStream.Dispose() }
}
$inputStream=New-Object IO.MemoryStream(,$valid)
try {
    $rejected=$false
    try { $unexpected=Expand-Dev155EnvelopeToMemory $inputStream 10; $unexpected.Dispose() } catch { $rejected=$true }
    if(-not $rejected){throw 'Memory bound test failed'}
    $passed++
} finally {$inputStream.Dispose()}
Write-Output ('PASS: '+$passed+' synthetic DPAPI envelope checks. No credential files or database access.')
