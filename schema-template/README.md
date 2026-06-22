# The Portal Map & Run-of-Show App — Master Schema & Data intake Guide

This document defines the canonical database schema and sheet formats used by the Portal Map and Run-of-Show (ROS) application. The application is **remote-first** and loads data dynamically at runtime from the live Google Sheet.

- **Spreadsheet ID:** `19Xs3TScHhS369n_A8VvUGxszoxncx1p32T8iwNHSKTU`
- **Tuscan Sample Event:** Montalcino estate production ("MARTIANS")

---

## 1. Google Sheets Database Architecture

The Google Sheet acts as a relational database with 6 active tabs:
1. `Locations` - Canonical place index, mapping spatial metadata to names.
2. `Personnel` - Contacts directory for crew, artist, and vendor coordination.
3. `Departments` - Operational department registry and contact info.
4. `Actions` - Category-level grouping and color palette index.
5. `ROS by TIME` - Master timeline of scheduled events, joins on Locations, Personnel, and Departments.
6. `Approved Emails` - Authorization whitelist for Google OAuth.

### Dynamic Formatting Colors
Every tab (Locations, Personnel, Departments, Actions) contains a `Color` column. If configured, the app parses the background fill color of the cell (via Sheets API) to dynamically color-code markers, calendar lanes, dropdown selections, and tags in the application.

---

## 2. Tab Schema Details

### 1. `Locations` Tab
Contains metadata for mapped geographic places. Matches schedule locations to render markers on Google Maps.

| Column | Required | Expected Value & Notes |
|---|---|---|
| `Location` | ✓ | Display name. Must match the exact spelling in `ROS by TIME`. |
| `Lat` | ✓ | Decimal latitude degrees (e.g. `43.056123`). Enables marker rendering. |
| `Long` | ✓ | Decimal longitude degrees (e.g. `11.488342`). Enables marker rendering. |
| `Description` | | Long-form notes describing the location. |
| `Color` | | Hex color code (e.g. `#8b5cf6`). Syncs map marker colors. |

---

### 2. `Personnel` Tab
Directory of individuals and vendor teams on site.

| Column | Required | Expected Value & Notes |
|---|---|---|
| `Name` | ✓ | Full name of the person or team. Matches `Lead Point Person` in `ROS by TIME`. |
| `Color` | | Hex color code (e.g. `#6366f1`). Styles contact badges. |
| `Role` | | Job title or role definition. |
| `Department`| | FK to `Departments`. |
| `Email` | | Email address (use synthetic addresses only like `name@example.com` in codebases). |
| `Phone` | | Contact phone number. |
| `Org` | | Employer or vendor organization name. |

---

### 3. `Departments` Tab
Stores department-level details and lead contact information. Feeds tooltips on the calendar grid department headers.

| Column | Required | Expected Value & Notes |
|---|---|---|
| `Department` | ✓ | Department name. Matches `Department` in `ROS by TIME`. |
| `Aliases` | | Alternate spellings/abbreviations separated by `\|` or `,`. |
| `Lead Point Person` | | Name of the primary point of contact for this department. |
| `Lead Phone` | | Lead contact phone number. |
| `Lead Email` | | Lead contact email address. |
| `Color` | | Hex color code. Sets the color of the department column lane. |
| `Lat` / `Long` | | Optional geographic coordinates for the department headquarters. |

---

### 4. `Actions` Tab
Categorizes individual schedule categories and defines their interface accents.

| Column | Required | Expected Value & Notes |
|---|---|---|
| `Action` | ✓ | Action category name (e.g., `Load In`, `Crew Meal`, `Sanitation`). |
| `Color` | | Hex color code. Dynamic accent for events matching this action. |

---

### 5. `ROS by TIME` Tab
The master timeline. Each row is a scheduled event that links to Locations, Personnel, and Departments.

| Column | Required | Expected Value & Notes |
|---|---|---|
| `Action` | ✓ | Category slug. Matches an entry in the `Actions` tab. |
| `Description` | ✓ | Narrative text. The first line/phrase serves as the display title in the UI. |
| `Location` or `SOLARIS ROS Location` | ✓ | Mapped location name. Must match an entry in the `Locations` tab. |
| `Start Day` | ✓ | ISO Date (`YYYY-MM-DD`) or day string (e.g. `Sun, Mar 16`). |
| `Start` | ✓ | 24-hour start time (`HH:MM` or standard format). |
| `End Time` | | 24-hour end time (`HH:MM` or standard format). |
| `event_id` | | Optional unique stable event UUID/slug. |
| `event_type` | | Optional type mapping to: `services`, `food`, `venue`, `music`, `community`, `performance`, `installation`. |
| `Lead Point Person` | | Lead contact. Matches `Name` in `Personnel`. |
| `Department` | | Lead department. Matches `Department` in `Departments`. |

---

### 6. `Approved Emails` Tab
Controls access control gating for OAuth authentication logins.

| Column | Required | Expected Value & Notes |
|---|---|---|
| `email` | ✓ | Authorized Google account email address. |
| `name` | | Friendly name for the whitelist entry. |

---

## 3. How to Deploy Future Events

To configure a new production event:
1. **Duplicate the Template:** Copy the Google Sheet tab structure to a new spreadsheet.
2. **Fill in the Tabs:**
   - Define `Locations` with accurate GPS coordinates.
   - Populate `Personnel` and `Departments` for proper crew assignments.
   - Define `Actions` for default event categorizations.
   - Author the master timeline in `ROS by TIME` using matching keys.
3. **Configure Access Whitelist:** Populate `Approved Emails` with crew members authorized to log in.
4. **Deploy Environment Variables:** Set `GOOGLE_SHEETS_SPREADSHEET_ID` in `.env.local` or the hosting provider (e.g., Vercel) to point to the new spreadsheet ID.
