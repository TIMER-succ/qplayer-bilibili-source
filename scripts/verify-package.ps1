param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Archive
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    [Console]::Error.WriteLine("invalid qplug: $Message")
    exit 1
}

if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) { Fail "archive not found: $Archive" }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-EntryBytes($Zip, [string]$Name) {
    $entry = $Zip.GetEntry($Name)
    if (-not $entry) { return $null }
    $stream = $entry.Open()
    try {
        $memory = New-Object System.IO.MemoryStream
        $stream.CopyTo($memory)
        return $memory.ToArray()
    } finally {
        $stream.Dispose()
    }
}

function Get-Sha256Hex([byte[]]$Bytes) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace("-", "").ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Archive).Path)
try {
    $entries = New-Object System.Collections.Generic.List[string]
    foreach ($item in $zip.Entries) {
        if ($item.FullName.EndsWith("/")) { continue }
        $entries.Add($item.FullName)
    }
    $unique = New-Object "System.Collections.Generic.HashSet[string]"
    foreach ($name in $entries) {
        if (-not $unique.Add($name)) { Fail "duplicate archive path" }
        $unsafe = $name.Contains("\") -or $name.StartsWith("/")
        if (-not $unsafe) {
            foreach ($part in ($name -split "/")) {
                if ($part -eq "..") { $unsafe = $true }
            }
        }
        if ($unsafe) { Fail "unsafe archive path: $name" }
    }

    $hashesPath = "META-INF/qplayer-files.json"
    if (-not $unique.Contains($hashesPath)) { Fail "missing $hashesPath" }
    $hashText = [System.Text.Encoding]::UTF8.GetString((Read-EntryBytes $zip $hashesPath))
    $hashes = $hashText | ConvertFrom-Json
    $hashNames = @($hashes.PSObject.Properties.Name)
    $expected = New-Object "System.Collections.Generic.HashSet[string]"
    foreach ($name in $entries) {
        if ($name -ne $hashesPath -and $name -ne "META-INF/qplayer.sig") { [void]$expected.Add($name) }
    }
    if ($hashNames.Count -ne $expected.Count) { Fail "hash manifest does not cover exactly the package files" }
    foreach ($name in $hashNames) {
        if (-not $expected.Contains($name)) { Fail "hash manifest does not cover exactly the package files" }
        $actual = Get-Sha256Hex (Read-EntryBytes $zip $name)
        $declared = [string]$hashes.PSObject.Properties[$name].Value
        if ($actual -ne $declared.ToLowerInvariant()) { Fail "digest mismatch: $name" }
    }

    if ($hashNames -notcontains "plugin.json") { Fail "plugin.json is not covered" }
    $manifest = [System.Text.Encoding]::UTF8.GetString((Read-EntryBytes $zip "plugin.json")) | ConvertFrom-Json
    $entry = [string]$manifest.entry
    if ($hashNames -notcontains $entry) { Fail "entry module is not covered: $entry" }
    Write-Output ("verified {0} ({1} files, id={2}, version={3})" -f $Archive, $hashNames.Count, [string]$manifest.id, [string]$manifest.version)
} finally {
    if ($zip) { $zip.Dispose() }
}
