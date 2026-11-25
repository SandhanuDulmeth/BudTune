param([switch]$TestProfiles, [switch]$NoBundle)
$ErrorActionPreference = 'Stop'

$revision = 'c941bc465786e8ec8d66367efb263e3df62ed9d4'
$engine = Join-Path $PSScriptRoot 'engine-src'

function Invoke-Native([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed ($LASTEXITCODE)" }
}

if (!(Test-Path (Join-Path $engine '.git'))) {
    Invoke-Native git @('init', $engine)
}

Push-Location $engine
try {
    $head = git rev-parse --verify HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or $head -ne $revision) {
        Invoke-Native git @('fetch', '--depth', '1', 'https://github.com/Oppzippy/OpenSCQ30.git', $revision)
        Invoke-Native git @('checkout', '--detach', 'FETCH_HEAD')
    }
    if ($TestProfiles) {
        Invoke-Native cargo @('test', '--locked', '-p', 'openscq30-lib', '--lib', '--features', 'bundled-dependencies', 'devices::soundcore')
    }
} finally {
    Pop-Location
}

$uiDir = Join-Path $PSScriptRoot 'ui'
$npm = if ($IsWindows) { 'npm.cmd' } else { 'npm' }
if (!(Test-Path (Join-Path $uiDir 'node_modules'))) {
    Push-Location $uiDir
    try {
        Invoke-Native $npm @('ci')
    } finally {
        Pop-Location
    }
}

$tauriBin = Join-Path $uiDir 'node_modules/.bin/tauri'
if ($IsWindows) {
    $tauriBin = Join-Path $uiDir 'node_modules/.bin/tauri.cmd'
}

$tauriArgs = @('build')
if ($NoBundle) {
    $tauriArgs += '--no-bundle'
} elseif ($IsMacOS) {
    $tauriArgs += @('--bundles', 'app')
}
Push-Location $PSScriptRoot
try {
    Invoke-Native $tauriBin $tauriArgs
} finally {
    Pop-Location
}

$out = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Force $out | Out-Null

if ($IsWindows) {
    $exe = Join-Path $PSScriptRoot 'src-tauri/target/release/budtune.exe'
    Copy-Item -LiteralPath $exe -Destination (Join-Path $PSScriptRoot 'BudTune.exe') -Force
    Copy-Item -LiteralPath $exe -Destination (Join-Path $out 'BudTune.exe') -Force
} elseif ($IsMacOS) {
    $bundle = Join-Path $PSScriptRoot 'src-tauri/target/release/bundle/macos/BudTune.app'
    Invoke-Native ditto @('-c', '-k', '--keepParent', $bundle, (Join-Path $out 'BudTune-macOS-arm64.zip'))
} else {
    $bin = Join-Path $PSScriptRoot 'src-tauri/target/release/budtune'
    Copy-Item -LiteralPath $bin -Destination (Join-Path $out 'BudTune') -Force
    Invoke-Native chmod @('+x', (Join-Path $out 'BudTune'))
    Invoke-Native tar @('-C', $out, '-czf', (Join-Path $out 'BudTune-Linux-x64.tar.gz'), 'BudTune')
}
