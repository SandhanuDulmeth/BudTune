$ErrorActionPreference = 'Stop'
$uiDir = Join-Path $PSScriptRoot 'ui'
$npm = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }

Push-Location $uiDir
try {
    if (!(Test-Path 'node_modules')) {
        & $npm install
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    & $npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

cargo run --manifest-path (Join-Path $PSScriptRoot 'src-tauri/Cargo.toml') --features custom-protocol
