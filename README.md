<h1 align="center">BudTune</h1>

<p align="center"><strong>Soundcore earbuds, controlled from your desktop.</strong><br>Free and open source. Pair over Bluetooth and manage the controls available on your model.</p>

<p align="center">
  <a href="https://github.com/SandhanuDulmeth/BudTune/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/SandhanuDulmeth/BudTune?style=flat-square&color=147d69"></a>
  <a href="COPYING"><img alt="License GPL-3.0-or-later" src="https://img.shields.io/badge/license-GPL--3.0--or--later-334155?style=flat-square"></a>
  <a href="https://github.com/SandhanuDulmeth/BudTune/actions"><img alt="Windows build status" src="https://github.com/SandhanuDulmeth/BudTune/actions/workflows/windows.yml/badge.svg"></a>
</p>

<p align="center">
  <a href="#downloads">Downloads</a> · <a href="#device-compatibility">Device compatibility</a> · <a href="#getting-started">Getting started</a> · <a href="#contribute">Contribute</a>
</p>

## What you can control

- **Sound.** Pick an EQ preset and switch noise control modes where supported.
- **Earbud settings.** View battery and firmware details, or change available touch controls.
- **Demo mode.** Explore the interface with a simulated device before pairing your earbuds.

BudTune uses a device profile to show the controls available for the model and firmware you connect.

## Downloads

| Platform | Download | Status |
| --- | --- | --- |
| Windows x64 | **[BudTune.exe](https://github.com/SandhanuDulmeth/BudTune/releases/latest/download/BudTune.exe)** · [SourceForge mirror](https://sourceforge.net/projects/budtune/files/) | Portable preview. The current public EXE is unsigned. Windows Smart App Control may block it. [Code signing status](CODE_SIGNING.md) |
| Linux x64 | [Linux preview artifacts](https://github.com/SandhanuDulmeth/BudTune/actions/workflows/desktop-preview.yml?query=is%3Asuccess) | Built for Ubuntu 24.04 x64. Hardware testing welcome. |
| macOS | [Apple Silicon preview artifacts](https://github.com/SandhanuDulmeth/BudTune/actions/workflows/desktop-preview.yml?query=is%3Asuccess) | Apple Silicon preview. The app bundle is ad-hoc signed and awaits notarization. |

For Linux or macOS, sign in to GitHub, open a successful run and choose your platform under **Artifacts**. Windows version history and SHA-256 checksums are on [GitHub Releases](https://github.com/SandhanuDulmeth/BudTune/releases).

## Device compatibility

| Soundcore model | Model code |
| --- | --- |
| Liberty 5 | A3957 |
| Liberty 4 Pro | A3954 |
| Liberty 4 NC | A3947 |
| P31i | D1202 |
| P20i / R50i | A3949 |
| Sport X20 | A3968 |

These profiles are included in the multi-model build. Hardware coverage still needs testing. Liberty 5 Pro, K20i, AeroClip 2 and AeroFit Pro are awaiting device-specific drivers. Use the exact model name and code when selecting a device.

## Getting started

1. Pair the earbuds in your system Bluetooth settings.
2. Open BudTune and choose **Add Device**.
3. Select the exact model, then choose the paired device and connect to see its settings.

To explore without earbuds, enable **Demo Mode** when adding a device.

## Contribute

**Have a pair of Soundcore earbuds?** A compatibility report is a useful first contribution. Include the model code, firmware, OS and controls you tried. Keep serial numbers and Bluetooth addresses private.

| I want to… | Start here |
| --- | --- |
| Test on Linux or macOS | [Cross-platform testing thread](https://github.com/SandhanuDulmeth/BudTune/issues/1) |
| Report a missing model or Bluetooth issue | [Device compatibility form](https://github.com/SandhanuDulmeth/BudTune/issues/new/choose) |
| Pick up an issue or submit a patch | [Open issues](https://github.com/SandhanuDulmeth/BudTune/issues) · [Contribution guide](CONTRIBUTING.md) |
| Share the project | [BudTune website](https://sandhanudulmeth.github.io/BudTune/) |

Contributors from anywhere are welcome. English is the shared language for issues and pull requests. A short report with clear steps is enough to start.

## Build from source

Install Git, stable Rust, PowerShell 7 and the platform dependencies in the [contribution guide](CONTRIBUTING.md). From the repository root:

```powershell
pwsh -File ./build-desktop.ps1 -TestProfiles
```

The build fetches pinned OpenSCQ30 source and applies the BudTune patches. Windows produces `BudTune.exe`. Linux and macOS produce preview archives in `dist/`. The C# source is retained from the original A3949 preview.

## License and credits

[GPL-3.0-or-later](COPYING). BudTune is an independent community project based on [OpenSCQ30](https://github.com/Oppzippy/OpenSCQ30) by Kyle Scheuing and contributors. BudTune is unaffiliated with Anker or Soundcore. See the [code signing policy](CODE_SIGNING.md) for release signing details.

