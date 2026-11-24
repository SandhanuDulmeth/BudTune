# Contributing to BudTune

Contributors from any country are welcome. English is the shared language for issues and pull requests. Short notes, screenshots with private details removed, and translated reports are welcome.

1. Open a GitHub issue for a bug, compatibility report, or proposed device.
2. Fork this repository, create a branch, and keep the pull request focused on one change.
3. Describe how you verified it. For hardware changes, include the exact model code, firmware, operating system and Bluetooth adapter.
4. Open a pull request. The maintainer reviews device behavior and release changes before merging.

## Build from source

Install Git, stable Rust and PowerShell 7. On Windows, install Visual Studio C++ build tools. On Ubuntu, install `pkg-config libdbus-1-dev libxkbcommon-dev libudev-dev` and use a desktop session with BlueZ. On macOS, install Xcode command-line tools. The preview CI targets Ubuntu 24.04 x64 and Apple Silicon macOS 15.

```powershell
pwsh -File ./build-desktop.ps1 -TestProfiles
```

Windows creates BudTune.exe. Linux and macOS create archives under dist. The build uses pinned OpenSCQ30 source plus BudTune patches. If a fix belongs in the shared protocol driver, consider contributing it upstream and link that change from the BudTune issue.

## Good first contributions

- Test a listed earbud model on Linux or macOS and report what works.
- Improve setup instructions for a specific desktop or Bluetooth adapter.
- Help verify profiles for Liberty 5 Pro, K20i, AeroClip 2 and AeroFit Pro using accurate model codes and firmware. Keep Bluetooth device addresses and serial numbers private.

Contributions are licensed under GPL-3.0-or-later. See COPYING.
