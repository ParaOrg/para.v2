# Para PH — Commute Tracker

[![Android Debug APK](https://github.com/ParaOrg/para.v2/actions/workflows/android-debug.yml/badge.svg?branch=feat/tracker-apk)](https://github.com/ParaOrg/para.v2/actions/workflows/android-debug.yml)

**Para PH** is a community-driven platform for mapping Philippine public transport. Commuters record their trips via a background GPS tracker; aggregated, anonymized data becomes an open dataset of jeepney, bus, and UV Express routes.

Live site: [www.para-commute.org](https://www.para-commute.org) · Tracker: [/contribute](https://www.para-commute.org/contribute)

---

## What's In This Repo

| Path | What it is |
|---|---|
| `src/` | Vite + React 19 web app (tracker UI, map, community pages) |
| `android/` | Capacitor Android shell — the **Para PH Tracker APK** |
| `scripts/` | `doctor.ps1` (env check) + `build.ps1` (one-command APK build) |
| `.github/workflows/` | CI — builds debug APK on every push to `feat/tracker-apk` |
| `supabase/` | Postgres schema + Edge Functions (`commute-save`, `fare-report`, `poi-add`) |
| `lambda-route-search/` | AWS Lambda — route search over the transit graph |
| `docs/` | Grant applications, admin flows, architecture notes |

---

## The Tracker APK

An Android app for commuters who want to contribute route data. Records GPS in the background — screen off, pocket, doze — via a native foreground service.

**Download:** [latest release](https://github.com/ParaOrg/para.v2/releases)

### Features

- Native background GPS via `@capacitor-community/background-geolocation`
- Foreground service notification — survives screen lock and app switch
- OEM battery onboarding (Xiaomi, OPPO, Realme, Vivo, Samsung, Huawei)
- Session persistence across force-stop (native SharedPreferences)
- Offline-first — tracks without network, syncs when back online
- Live direction cone on the map (compass + GPS course blend)

### Requirements

- Android 7.0+ (API 24)
- Location permission — "Allow all the time" for background tracking
- Notification permission (Android 13+)

### Install

1. Download the APK from [Releases](https://github.com/ParaOrg/para.v2/releases)
2. Android will warn about installing from an unknown source — enable **Allow from this source** in Settings
3. Open the app and follow the first-run setup (battery → permissions)

---

## Development

### Prerequisites

- Node ≥ 20 (≥ 22 for Capacitor 8 CLI)
- Android Studio + Android SDK Platform 36 + Build Tools 36
- JDK 21 (Adoptium recommended)

Run the environment check:

```powershell
.\scripts\doctor.ps1