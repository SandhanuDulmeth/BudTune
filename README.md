# BudTune for Windows

A free, unofficial Windows x64 companion for Soundcore R50i, P20i and P25i (A3949). Choose one of 22 earbud EQ presets, switch gaming mode and touch tones, and read battery, charging and firmware for each side. The app talks to the paired earbuds over Windows Bluetooth RFCOMM. Changes are confirmed by requesting fresh device state. R50i NC uses a different protocol and is outside this release.

**[Download BudTune for Windows x64](https://github.com/SandhanuDulmeth/BudTune/raw/refs/heads/main/BudTune-Windows-x64.zip)** · Free portable ZIP

## Start

1. Extract the whole ZIP. Open BudTune.exe on Windows 10 (version 1809 or later) or Windows 11 x64 with .NET Framework 4.8.
2. Pair the earbuds in Windows Bluetooth settings. Take them out of the case, select Scan, choose the device and click Connect.
3. Select a preset and click Apply preset, or click Gaming mode or Touch tone to switch it. Refresh requests current battery and firmware readings.
4. If the control service is busy, close the mobile companion app, disconnect the earbuds from your phone and reconnect in BudTune.

## Build

Run build.ps1 in PowerShell on Windows x64 with .NET Framework 4.8. The build uses the Windows metadata and the framework compiler already installed on the machine.

## License and credits

GPL-3.0-or-later. See COPYING. A3949 protocol details and EQ data are based on Kyle Scheuing and contributors' [OpenSCQ30](https://github.com/Oppzippy/OpenSCQ30), specifically lib/src/devices/soundcore/a3949.rs and its common EQ and DRC structures. The C# UI and transport are implemented for BudTune. Independent community project, unaffiliated with Anker or Soundcore.

## Preview status

This is an unsigned preview. Compilation and EQ packet fixture checks have been performed. Physical-earbud compatibility still needs testing. Some managed Windows PCs restrict unsigned applications.
