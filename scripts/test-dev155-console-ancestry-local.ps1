$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
$script:Checks=0
$script:Fixture=@{}
function Get-CimInstance {
    param([string]$ClassName,[string]$Filter,[string]$ErrorAction)
    $processNumber=[int]($Filter -replace '^ProcessId=','')
    return $script:Fixture[$processNumber]
}
function Test-Dev155TrustedDesktopLauncher($Process) { return $Process.Name -eq 'signed-fixture-launcher' }
function Assert-Fixture([bool]$Condition) {
    if(-not $Condition){throw 'Synthetic ancestry assertion failed'}
    $script:Checks++
}
function Reject-Fixture([string]$Expected) {
    $failed=$false
    try { Assert-Dev155TerminalAncestry } catch { $failed=$true }
    Assert-Fixture ($failed -and $script:Dev155Stage -eq $Expected)
}
$script:Fixture=@{}
Reject-Fixture 'C04-MISSING-PARENT'
$script:Fixture=@{ $PID=[pscustomobject]@{Name='powershell.exe';ParentProcessId=900001} }
Reject-Fixture 'C04-MISSING-PARENT'
$script:Fixture[900001]=[pscustomobject]@{Name='node.exe';ParentProcessId=0}
Reject-Fixture 'C04-AGENT-PARENT'
$script:Fixture[900001]=[pscustomobject]@{Name='signed-fixture-launcher';ParentProcessId=0}
Assert-Dev155TerminalAncestry
Assert-Fixture ($script:Dev155Stage -eq 'C04-ANCESTRY')
$script:Fixture[900001]=[pscustomobject]@{Name='unsigned-fixture-launcher';ParentProcessId=0}
Reject-Fixture 'C04-NO-TRUSTED-LAUNCHER'
$script:Fixture[900001]=[pscustomobject]@{Name='powershell.exe';ParentProcessId=$PID}
Reject-Fixture 'C04-NO-TRUSTED-LAUNCHER'
Write-Output ('DEV155_ANCESTRY_SYNTHETIC_PASS='+$script:Checks+'; credential_reads=0; database_connections=0')
