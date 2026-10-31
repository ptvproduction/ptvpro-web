param([Parameter(Mandatory=$true)][Guid]$AccountId)

$ErrorActionPreference = 'Stop'
$taskSecret = $null
$taskPointer = [IntPtr]::Zero
$taskStage = 'pipe'
try {
    if (-not [Console]::IsOutputRedirected -or $AccountId -eq [Guid]::Empty) { throw 'Private pipe required.' }
    $taskStage = 'load_guard'
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    $taskRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PTVPRO-Phase1-Private'
    $taskStage = 'root_acl'
    Assert-Dev155Acl $taskRoot
    $taskFile = Join-Path $taskRoot ($AccountId.ToString('D') + '.password.dpapi')
    $taskStage = 'artifact_acl'
    Assert-Dev155Acl $taskFile
    if ((Get-Item -LiteralPath $taskFile).Length -gt 65536) { throw 'Invalid artifact size.' }
    $taskStage = 'dpapi'
    $taskSecret = ConvertTo-SecureString -String ([IO.File]::ReadAllText($taskFile)) -ErrorAction Stop
    if ($taskSecret.Length -eq 0) { throw 'Empty credential.' }
    $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecret)
    [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer))
} catch {
    [Console]::Error.Write('PRIVATE_PORTAL_READER_BLOCKED:' + $taskStage)
    exit 1
} finally {
    if ($taskPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer) }
    if ($taskSecret) { $taskSecret.Dispose() }
}
