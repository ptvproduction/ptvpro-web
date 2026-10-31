param(
    [Parameter(Mandatory=$true)][Guid]$AccountId,
    [Parameter(Mandatory=$true)][string]$OwnerEvidence,
    [Parameter(Mandatory=$true)][string]$RecoveryEvidence,
    [Parameter(Mandatory=$false)][string]$ApprovalReference = 'ACC-PHASE1-PILOT-PTV001-20261026'
)

$ErrorActionPreference = 'Stop'

try {
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    Assert-Dev155ManualConsole

    if ($OwnerEvidence.Length -lt 8) { throw 'Owner evidence reference must be at least 8 characters.' }
    if ($RecoveryEvidence.Length -lt 8) { throw 'Recovery evidence reference must be at least 8 characters.' }
    if ($OwnerEvidence -eq $RecoveryEvidence) { throw 'Owner evidence and recovery evidence must be strictly independent.' }
    if ($ApprovalReference.Length -lt 8) { throw 'Approval reference must be at least 8 characters.' }

    $databaseSecret = Read-Dev155SecurePassword
    $dbPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($databaseSecret)

    try {
        $dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($dbPtr)
        $inputPacket = @{ database_password = $dbPasswordPlain } | ConvertTo-Json -Compress

        $start = [Diagnostics.ProcessStartInfo]::new()
        $start.FileName = (Get-Command node.exe -ErrorAction Stop).Source
        $start.Arguments = '"' + (Join-Path $PSScriptRoot 'get-phase1-enrollment-meta.mjs') + '" ' + $AccountId.ToString('D')
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.RedirectStandardInput = $true
        $start.RedirectStandardOutput = $true
        $start.RedirectStandardError = $true

        $child = [Diagnostics.Process]::new()
        $child.StartInfo = $start

        $null = $child.Start()
        $outputTask = $child.StandardOutput.ReadToEndAsync()
        $errTask = $child.StandardError.ReadToEndAsync()

        $writer = [IO.StreamWriter]::new($child.StandardInput.BaseStream, (New-Object Text.UTF8Encoding($false)), 4096, $false)
        try {
            $writer.Write($inputPacket)
        } finally {
            $writer.Dispose()
            $inputPacket = $null
            $dbPasswordPlain = $null
        }

        if (-not $child.WaitForExit(30000)) {
            $child.Kill()
            throw 'Timeout fetching enrollment metadata from Staging.'
        }

        $stdout = $outputTask.GetAwaiter().GetResult()
        $stderr = $errTask.GetAwaiter().GetResult()

        if ($child.ExitCode -ne 0) {
            Write-Host "Error details: $stderr"
            throw 'Failed to fetch enrollment metadata from Staging.'
        }

        $meta = $stdout | ConvertFrom-Json
        if (-not $meta.ok) { throw 'Metadata query failed.' }

        $root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PTVPRO-Phase1-Private'
        if (-not (Test-Path -LiteralPath $root)) {
            $null = New-Item -ItemType Directory -Path $root
            Set-Dev155PrivateAcl $root $true
        } else {
            Assert-Dev155Acl $root
        }

        $now = [DateTime]::UtcNow
        $reviewObj = [ordered]@{
            project_ref                = 'swadgljnyelsjstqqxbm'
            scope                      = 'ENROLL_INACTIVE_ACCOUNT_ONLY'
            operation_id               = [Guid]::NewGuid().ToString('D')
            account_id                 = $meta.account_id
            identity_id                = $meta.identity_id
            source_uuid                = $meta.source_uuid
            ptv_id                     = $meta.ptv_id
            username                   = $meta.username
            expected_account_version   = $meta.expected_account_version
            security_surface_sha256    = $meta.security_surface_sha256
            approval_reference         = $ApprovalReference
            privacy_logging_approved   = $true
            owner_verified             = $true
            owner_evidence_reference   = $OwnerEvidence
            recovery_evidence_reference= $RecoveryEvidence
            owner_verified_at          = $now.ToString('o')
            expires_at                 = $now.AddHours(24).ToString('o')
        }

        $reviewPath = Join-Path $root ($meta.ptv_id.ToLowerInvariant() + '-enrollment-review.json')
        $jsonContent = $reviewObj | ConvertTo-Json -Depth 10

        [IO.File]::WriteAllText($reviewPath, $jsonContent, (New-Object Text.UTF8Encoding($false)))
        Set-Dev155PrivateAcl $reviewPath $false
        Assert-Dev155Acl $reviewPath

        Write-Host "================================================================="
        Write-Host "ENROLLMENT REVIEW FILE PREPARED SUCCESSFULLY!"
        Write-Host "Target Account  : $($meta.ptv_id) ($($meta.username))"
        Write-Host "Account UUID    : $($meta.account_id)"
        Write-Host "Status Akun     : $($meta.status_akun)"
        Write-Host "Surface SHA256  : $($meta.security_surface_sha256)"
        Write-Host "Review File Path: $reviewPath"
        Write-Host "================================================================="
        Write-Host "Langkah berikutnya jalankan enrollment dengan perintah:"
        Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/enroll-phase1-private.ps1 -ReviewPath `"$reviewPath`""
        Write-Host "================================================================="

    } finally {
        if ($dbPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($dbPtr) }
        if ($databaseSecret) { $databaseSecret.Dispose() }
    }
} catch {
    Write-Host "PREPARATION FAILED: $_"
    exit 1
}
