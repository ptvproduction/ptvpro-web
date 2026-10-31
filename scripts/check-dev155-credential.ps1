$script:Dev155Stage = 'R01-LOAD'
try {
    . (Join-Path $PSScriptRoot 'dev155-credential-common.ps1')
    $password = $null
    try {
        $password = Read-Dev155SecurePassword
        Write-Host 'PASS: private ACL and current-user DPAPI decryption. No database access or plaintext output.'
    } finally { if ($password) { $password.Dispose() } }
} catch {
    Write-Host ('DEV155 code: ' + $script:Dev155Stage)
    Write-Host 'Credential check stopped. Use the same Windows user and computer; do not paste credential files into chat.'
    exit 1
}
