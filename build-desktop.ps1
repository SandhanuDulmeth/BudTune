param([switch]$TestProfiles)
$ErrorActionPreference = 'Stop'
if ($IsWindows) {
    & (Join-Path $PSScriptRoot 'build-release.ps1') -TestProfiles:$TestProfiles
    return
}
if (!$IsLinux -and !$IsMacOS) { throw 'Use PowerShell 7 on Linux or macOS.' }

$revision = 'c730b832f8d409b215fcd7f59c07c8a624dea9aa'
$patch = 'budtune.patch'
$platform = 'linux'
if ($IsMacOS) {
    $revision = 'c941bc465786e8ec8d66367efb263e3df62ed9d4'
    $patch = 'budtune-macos.patch'
    $platform = 'macos'
}
$engine = Join-Path $PSScriptRoot "engine-$platform"
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
    if ($LASTEXITCODE -ne 0) {
        Invoke-Native git @('fetch','--depth','1','https://github.com/Oppzippy/OpenSCQ30.git',$revision)
        Invoke-Native git @('checkout','--detach','FETCH_HEAD')
        $head = git rev-parse HEAD
    }
    if ($head -ne $revision) { throw "Expected pinned engine revision $revision." }
    $patchFile = Join-Path $PSScriptRoot $patch
    git apply --reverse --check $patchFile 2>$null
    if ($LASTEXITCODE -ne 0) { Invoke-Native git @('apply','--whitespace=nowarn',$patchFile) }
    $uiPatch = Join-Path $PSScriptRoot 'budtune-ui.patch'
    git apply --reverse --check $uiPatch 2>$null
    if ($LASTEXITCODE -ne 0) { Invoke-Native git @('apply','--whitespace=nowarn',$uiPatch) }
    if ($TestProfiles) {
        Invoke-Native cargo @('test','--locked','-p','openscq30-lib','--lib','--features','bundled-dependencies','devices::soundcore')
    }
    Invoke-Native cargo @('build','--locked','-p','openscq30-gui','--features','bundled-dependencies','--profile','release-fast')
    $out = Join-Path $PSScriptRoot 'dist'
    New-Item -ItemType Directory -Force $out | Out-Null
    $binary = 'target/release-fast/openscq30-gui'
    if ($IsMacOS) {
        $bundle = Join-Path $out 'BudTune.app'
        New-Item -ItemType Directory -Force "$bundle/Contents/MacOS" | Out-Null
        Copy-Item $binary "$bundle/Contents/MacOS/BudTune"
        $plist = (Get-Content -Raw 'packaging/macos/Info.plist').Replace('OpenSCQ30','BudTune').Replace('com.oppzippy.BudTune','io.github.SandhanuDulmeth.BudTune').Replace('openscq30-gui','BudTune')
        $plist | Set-Content -Encoding utf8 "$bundle/Contents/Info.plist"
        Invoke-Native plutil @('-lint',"$bundle/Contents/Info.plist")
        Invoke-Native codesign @('--force','--sign','-',$bundle)
        Invoke-Native codesign @('--verify',$bundle)
        Invoke-Native ditto @('-c','-k','--keepParent',$bundle,(Join-Path $out 'BudTune-macOS-arm64.zip'))
    } else {
        Copy-Item $binary (Join-Path $out 'BudTune')
        Invoke-Native chmod @('+x',(Join-Path $out 'BudTune'))
        Invoke-Native tar @('-C',$out,'-czf',(Join-Path $out 'BudTune-Linux-x64.tar.gz'),'BudTune')
    }
} finally { Pop-Location }
