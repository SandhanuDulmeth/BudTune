# BudTune

Free, open-source Windows companion for Soundcore earbuds. BudTune's multi-model edition uses the Rust desktop interface and device drivers from [OpenSCQ30 v2.13.0](https://github.com/Oppzippy/OpenSCQ30/tree/c730b832f8d409b215fcd7f59c07c8a624dea9aa), with its own settings directory, model guidance and release channel.

**[Download BudTune.exe](https://github.com/SandhanuDulmeth/BudTune/releases/latest/download/BudTune.exe)** · [All releases and SHA-256 checksums](https://github.com/SandhanuDulmeth/BudTune/releases)

## Use

1. Pair the earbuds in Windows Bluetooth settings and open BudTune.exe.
2. Add a device, choose the exact model, then select the paired earbuds. Leave demo mode off to control hardware.
3. Open the connected device. The available settings come from its driver and current device state. Use About to find the latest release.

## Requested models

| Profiles included in the multi-model build | ID |
|---|---|
| Liberty 5 | A3957 |
| Liberty 4 Pro | A3954 |
| Liberty 4 NC | A3947 |
| P31i | D1202 |
| P20i and R50i | A3949 |
| Sport X20 | A3968 |

Liberty 5 Pro, K20i, AeroClip 2 and AeroFit Pro await device-specific drivers. Never select a similarly named model for these earbuds. Physical testing of the BudTune distribution is pending. Feature availability varies by firmware.

## Build and release

On Windows x64 with Git, stable Rust and Visual Studio C++ build tools, run `./build-release.ps1 -TestProfiles` in PowerShell 7. The script fetches the pinned GPL source, applies `budtune.patch`, runs model tests and builds BudTune.exe. C# files and build.ps1 belong to the original A3949 preview. The current multi-model executable uses Rust.

Every push to main triggers the Windows release workflow. A successful build publishes a versioned GitHub Release. The download URL follows the latest successful release. Existing copies can be replaced manually.

## License

GNU GPL-3.0-or-later. The upstream interface and device drivers are by Kyle Scheuing and OpenSCQ30 contributors. See COPYING and the pinned source above. BudTune is independent of Soundcore and Anker.
