param([switch]$TestProfiles)
$ErrorActionPreference = 'Stop'
$revision = 'c730b832f8d409b215fcd7f59c07c8a624dea9aa'
$engine = Join-Path $PSScriptRoot 'engine-src'
function Run([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}
if (!(Test-Path $engine)) {
    Run git @('clone','--depth','1','--branch','v2.13.0','https://github.com/Oppzippy/OpenSCQ30.git',$engine)
}
Push-Location $engine
try {
    if ((git rev-parse HEAD) -ne $revision) { throw 'The source revision differs from the pinned OpenSCQ30 release.' }
    $patch = Join-Path $PSScriptRoot 'budtune.patch'
    git apply --reverse --check $patch 2>$null
    if ($LASTEXITCODE -ne 0) { Run git @('apply','--whitespace=nowarn',$patch) }
    if ($TestProfiles) {
        foreach ($model in 'a3947','a3949','a3954','a3957','a3968','d1202') {
            Run cargo @('test','--locked','-p','openscq30-lib','--lib','--features','bundled-dependencies',$model)
        }
    }
    Run cargo @('build','--locked','-p','openscq30-gui','--features','bundled-dependencies','--profile','release-fast')
    Copy-Item 'target/release-fast/openscq30-gui.exe' (Join-Path $PSScriptRoot 'BudTune.exe') -Force
} finally { Pop-Location }
