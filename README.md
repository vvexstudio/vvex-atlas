# The Portal Map App

This repository provides a Next.js interactive map and run-of-show (ROS) schedule interface dedicated to **The Portal** event production client.

## Overview

The app displays an interactive Schedule Grid, a Running Chronological Schedule, and an interactive Map View populated from a live event database.

## Data Sources & Remote Integration

The application utilizes a remote-first architecture synced with a live Google Sheet:
- **`ROS by TIME`**: The canonical run-of-show master schedule.
- **`Locations`**: Mapped coordinates (latitude/longitude), names, and aliases to place map markers.
- **`Personnel`**: Contact directory.
- **`Departments`**: Department settings and accents.

### Sheets API & Public CSV Fallback
- The data layer fetches sheet tabs using the Google Sheets API with Service Account credentials.
- **Fallback Loader**: If OAuth authentication fails or credentials expire (e.g. 401 Unauthorized), the loader automatically catches the error and falls back to loading the public Google Sheets CSV export URLs. This ensures the app is highly available and functional.

## Key Features

- **Google Sheet Color-Coding**: Badge styling for Location, Action, Department, and Lead Point Person automatically maps to background and text hex values fetched dynamically from the source Google Sheet conditional formatting rules (saved in `src/data/sheet-colors.json`).
- **Additive Multi-Select Filters**: Select multiple locations, actions, departments, or leads from the dropdown filters. Each selection creates an independent dismissible chip. Filtering executes an **OR** search within the same category and an **AND** search across different categories.
- **Date-Time Range Filters**: Upgraded datetime inputs (`datetime-local`) allow range filtering across days. Employs timezone-safe Date comparisons and handles overnight rollover logic (events starting late and ending the next morning).
- **Opaque Sticky Date Headers**: Day/date headers stick to the top of both the left Schedule Grid and the right Running Schedule. The top scroll gap has been eliminated to prevent scrolled-past items from showing.

## App Structure

- `src/app/page.tsx`: Server entry point that triggers the remote sheet load.
- `src/components/festival-map-app.tsx`: Main client view with tabs (Schedule Grid & Map View), dropdown filters, chips, and the sidebar list.
- `src/lib/festival-data.ts`: Core data loader managing remote fetches, public CSV fallbacks, date/time normalization, and name matching.
- `src/lib/google-sheets-api.ts`: API client interfacing with Google Sheets.
- `src/data/sheet-colors.json`: Cached conditional formatting palette extracted from the Google Sheet.

## Local Setup

Ensure you have a Node environment set up:
```bash
npm install
npm run dev
```

Set the Google Maps key in `.env.local`:
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

## Useful Commands

```bash
npm run lint
npm run build
```
