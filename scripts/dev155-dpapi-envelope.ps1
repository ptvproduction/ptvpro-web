Set-StrictMode -Version Latest

function Get-Dev155BlockEntropy([byte[]]$Nonce, [long]$Index, [byte]$Kind) {
    return ,([byte[]]($Nonce + [BitConverter]::GetBytes($Index) + @($Kind)))
}

function Protect-Dev155Stream([IO.Stream]$InputStream, [IO.Stream]$OutputStream) {
    $writer = New-Object IO.BinaryWriter($OutputStream, [Text.Encoding]::UTF8, $true)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $hash = [Security.Cryptography.SHA256]::Create()
    $nonce = New-Object byte[] 32
    $buffer = New-Object byte[] 1048576
    $index = [long]0
    $total = [long]0
    $clock = [Diagnostics.Stopwatch]::StartNew()
    try {
        $rng.GetBytes($nonce)
        $writer.Write([Text.Encoding]::ASCII.GetBytes('PTV155D01'))
        $writer.Write($nonce)
        while ($true) {
            if ($clock.Elapsed.TotalSeconds -gt 300) { throw 'Stream timeout.' }
            $read = $InputStream.ReadAsync($buffer, 0, $buffer.Length)
            if (-not $read.Wait(30000)) { throw 'Stream read timeout.' }
            $count = $read.Result
            if ($count -eq 0) { break }
            $plain = New-Object byte[] $count
            [Array]::Copy($buffer, $plain, $count)
            try {
                $null = $hash.TransformBlock($plain, 0, $plain.Length, $plain, 0)
                $cipher = [Security.Cryptography.ProtectedData]::Protect($plain, (Get-Dev155BlockEntropy $nonce $index 1), [Security.Cryptography.DataProtectionScope]::CurrentUser)
                $writer.Write([byte]1)
                $writer.Write([int]$cipher.Length)
                $writer.Write([byte[]]$cipher)
            } finally { [Array]::Clear($plain, 0, $plain.Length) }
            $total += $count
            $index++
        }
        $null = $hash.TransformFinalBlock((New-Object byte[] 0), 0, 0)
        $digest = [BitConverter]::ToString($hash.Hash).Replace('-', '')
        $footer = [Text.Encoding]::UTF8.GetBytes(($index.ToString() + '|' + $total.ToString() + '|' + $digest))
        $sealed = [Security.Cryptography.ProtectedData]::Protect($footer, (Get-Dev155BlockEntropy $nonce $index 2), [Security.Cryptography.DataProtectionScope]::CurrentUser)
        $writer.Write([byte]2)
        $writer.Write([int]$sealed.Length)
        $writer.Write([byte[]]$sealed)
        $writer.Flush()
        return [pscustomobject]@{ Bytes = $total; Blocks = $index }
    } finally {
        [Array]::Clear($buffer, 0, $buffer.Length)
        $hash.Dispose(); $rng.Dispose(); $writer.Dispose()
    }
}

function Test-Dev155Envelope([IO.Stream]$InputStream) {
    if (-not $InputStream.CanSeek) { throw 'Seekable encrypted input required.' }
    $reader = New-Object IO.BinaryReader($InputStream, [Text.Encoding]::UTF8, $true)
    $hash = [Security.Cryptography.SHA256]::Create()
    $index = [long]0
    $total = [long]0
    try {
        if ([Text.Encoding]::ASCII.GetString($reader.ReadBytes(9)) -cne 'PTV155D01') { throw 'Invalid envelope.' }
        $nonce = $reader.ReadBytes(32)
        if ($nonce.Length -ne 32) { throw 'Invalid nonce.' }
        while ($true) {
            $kind = $reader.ReadByte()
            if ($kind -ne 1 -and $kind -ne 2) { throw 'Invalid record.' }
            $size = $reader.ReadInt32()
            if ($size -le 0 -or $size -gt 2097152) { throw 'Invalid block size.' }
            $cipher = $reader.ReadBytes($size)
            if ($cipher.Length -ne $size) { throw 'Truncated block.' }
            $plain = [Security.Cryptography.ProtectedData]::Unprotect($cipher, (Get-Dev155BlockEntropy $nonce $index $kind), [Security.Cryptography.DataProtectionScope]::CurrentUser)
            try {
                if ($kind -eq 1) {
                    if ($plain.Length -le 0 -or $plain.Length -gt 1048576) { throw 'Invalid plaintext block size.' }
                    $null = $hash.TransformBlock($plain, 0, $plain.Length, $plain, 0)
                    $total += $plain.Length; $index++
                } else {
                    $null = $hash.TransformFinalBlock((New-Object byte[] 0), 0, 0)
                    $expected = $index.ToString() + '|' + $total.ToString() + '|' + [BitConverter]::ToString($hash.Hash).Replace('-', '')
                    if ([Text.Encoding]::UTF8.GetString($plain) -cne $expected -or $InputStream.Position -ne $InputStream.Length) { throw 'Envelope final integrity failed.' }
                    return [pscustomobject]@{ Bytes = $total; Blocks = $index; Verified = $true }
                }
            } finally { [Array]::Clear($plain, 0, $plain.Length) }
        }
    } finally { $reader.Dispose(); $hash.Dispose() }
}

function Write-Dev155EnvelopeFile([string]$Path, [IO.Stream]$InputStream) {
    # CreateNew preserves existing artifacts. Only DPAPI ciphertext is written to disk.
    $file = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try {
        $written = Protect-Dev155Stream $InputStream $file
        $file.Flush()
        $file.Position = 0
        $checked = Test-Dev155Envelope $file
        if ($checked.Bytes -ne $written.Bytes -or $checked.Blocks -ne $written.Blocks) { throw 'Envelope roundtrip failed.' }
        return $checked
    } finally { $file.Dispose() }
}

function Expand-Dev155EnvelopeToMemory([IO.Stream]$InputStream, [long]$MaxBytes = 268435456) {
    # Verify the whole envelope before releasing any plaintext to a consumer.
    if ($MaxBytes -le 0 -or -not $InputStream.CanSeek) { throw 'Invalid bounded memory consumer.' }
    $start = $InputStream.Position
    $checked = Test-Dev155Envelope $InputStream
    if ($checked.Bytes -gt $MaxBytes) { throw 'Envelope exceeds memory limit.' }
    $InputStream.Position = $start
    $reader = New-Object IO.BinaryReader($InputStream, [Text.Encoding]::UTF8, $true)
    $output = New-Object IO.MemoryStream
    $index = [long]0
    try {
        $null = $reader.ReadBytes(9)
        $nonce = $reader.ReadBytes(32)
        while ($true) {
            $kind = $reader.ReadByte()
            $size = $reader.ReadInt32()
            if (($kind -ne 1 -and $kind -ne 2) -or $size -le 0 -or $size -gt 2097152) { throw 'Invalid record on replay.' }
            $cipher = $reader.ReadBytes($size)
            if ($cipher.Length -ne $size) { throw 'Truncated replay.' }
            $plain = [Security.Cryptography.ProtectedData]::Unprotect($cipher, (Get-Dev155BlockEntropy $nonce $index $kind), [Security.Cryptography.DataProtectionScope]::CurrentUser)
            try {
                if ($kind -eq 2) { break }
                if ($output.Length + $plain.Length -gt $MaxBytes) { throw 'Memory bound exceeded.' }
                $output.Write($plain, 0, $plain.Length)
                $index++
            } finally { [Array]::Clear($plain, 0, $plain.Length) }
        }
        if ($output.Length -ne $checked.Bytes -or $InputStream.Position -ne $InputStream.Length) { throw 'Verified replay mismatch.' }
        $output.Position = 0
        return ,$output
    } catch {
        if ($output.Length) { [Array]::Clear($output.GetBuffer(), 0, [int]$output.Length) }
        $output.Dispose()
        throw
    } finally { $reader.Dispose() }
}
