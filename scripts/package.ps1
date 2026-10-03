$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("qplug-" + [guid]::NewGuid().ToString("N"))

function Get-JsonString([string]$Value) {
    if (-not ("System.Web.Script.Serialization.JavaScriptSerializer" -as [type])) {
        Add-Type -AssemblyName System.Web.Extensions
    }
    if (-not $script:JsonSerializer) {
        $script:JsonSerializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    }
    return $script:JsonSerializer.Serialize($Value)
}

try {
    New-Item -ItemType Directory -Path (Join-Path $stage "META-INF") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $projectDir "dist") -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectDir "plugin.json") -Destination (Join-Path $stage "plugin.json")
    foreach ($directory in @("src", "ui", "assets")) {
        $source = Join-Path $projectDir $directory
        if (Test-Path -LiteralPath $source -PathType Container) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $stage $directory) -Recurse
        }
    }

    $manifestText = [System.IO.File]::ReadAllText((Join-Path $projectDir "plugin.json"), [System.Text.Encoding]::UTF8)
    $manifest = $manifestText | ConvertFrom-Json
    $pluginId = [string]$manifest.id
    $pluginVersion = [string]$manifest.version
    if (-not $pluginId -or -not $pluginVersion) { throw "plugin.json is missing id or version" }

    $pending = @{}
    $root = (Resolve-Path -LiteralPath $stage).Path
    Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($root.Length).TrimStart("\") -replace "\\", "/"
        $parts = $relative -split "/"
        if ($parts -contains "META-INF") { return }
        $pending[$relative] = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant()
    }
    $ordered = New-Object System.Collections.Specialized.OrderedDictionary
    foreach ($key in ($pending.Keys | Sort-Object)) { $ordered[$key] = $pending[$key] }

    $keys = @($ordered.Keys)
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("{")
    for ($i = 0; $i -lt $keys.Count; $i++) {
        $comma = ""
        if ($i -lt ($keys.Count - 1)) { $comma = "," }
        $lines.Add(("  {0}: {1}{2}" -f (Get-JsonString $keys[$i]), (Get-JsonString ([string]$ordered[$keys[$i]])), $comma))
    }
    $lines.Add("}")
    $json = ($lines -join "`n") + "`n"
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText((Join-Path $stage "META-INF\qplayer-files.json"), $json, $utf8)

    if ($env:QPLAYER_PLUGIN_SIGNING_KEY) {
        $openssl = Get-Command openssl -ErrorAction SilentlyContinue
        if (-not $openssl) { throw "openssl was not found" }
        $binary = Join-Path $stage "META-INF\qplayer.sig.bin"
        $signature = Join-Path $stage "META-INF\qplayer.sig"
        & $openssl.Source dgst -sha256 -sign $env:QPLAYER_PLUGIN_SIGNING_KEY -out $binary (Join-Path $stage "META-INF\qplayer-files.json")
        if ($LASTEXITCODE -ne 0) { throw "openssl sign failed" }
        & $openssl.Source base64 -A -in $binary -out $signature
        if ($LASTEXITCODE -ne 0) { throw "openssl base64 failed" }
        Remove-Item -LiteralPath $binary -Force
    }

    $jar = Get-Command jar -ErrorAction SilentlyContinue
    if (-not $jar) { throw "jar was not found" }
    $output = Join-Path $projectDir "dist\$pluginId-$pluginVersion.qplug"
    if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Force }
    & $jar.Source --create --file $output --no-manifest --date=2000-01-01T00:00:00Z -C $stage .
    if ($LASTEXITCODE -ne 0) { throw "jar failed" }
    Write-Output $output
} finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
