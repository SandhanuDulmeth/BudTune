$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $fx = "$env:windir\Microsoft.NET\Framework64\v4.0.30319"
    $meta = "$env:windir\System32\WinMetadata"
    $refs = @('System.Runtime', 'System.Runtime.WindowsRuntime','System.Runtime.InteropServices.WindowsRuntime','System.Threading.Tasks','System.Collections','System.IO') | ForEach-Object { "/r:$fx\$_.dll" }
    $refs += @('Foundation','Devices','Storage','Networking') | ForEach-Object { "/r:$meta\Windows.$_.winmd" }
    & "$fx\csc.exe" /nologo /target:winexe /platform:x64 /optimize+ /out:BudTune.exe @refs /r:System.Windows.Forms.dll /r:System.Drawing.dll *.cs
    if ($LASTEXITCODE) { throw "Build failed" }
} finally { Pop-Location }
