# Portal Map App — Data Schema & Production-Data Template

This folder is the **schema template** we hand to The Portal so a future event's data plugs into the app with no from-scratch build. It mirrors the tabs now in the working Google Sheet.

TEST

- **Sample event:** synthetic 3-day Tuscan estate production, 2027-03-16 → 03-18.
- The app reads the sheet at runtime (CSV export today; Google Sheets API once credentials exist). Local files in `OFFLINE/` are archived and ignored.

## Tabs

### `Locations` (canonical place index) — `Locations.csv`
One row per physical place. Feeds map markers and is the join target for `ROS.location_id`.

| Column | Required | Notes |
|---|---|---|
| `location_id` | ✓ | Stable slug, e.g. `loc-forest`. Referenced by `ROS.location_id`. |
| `name` | ✓ | Display name. |
| `aliases` | | `|`-separated alternates; used to match free-text schedule entries. |
| `category` | ✓ | Transport / Accommodation / Amenity / Production / Performance / Crew Ops / F&B / Venue / Service. |
| `foh_boh_default` | ✓ | `front` or `back`. Default visibility hint (BOH = crew-only). |
| `lat`, `lng` | ✓ for map | Decimal degrees. **Currently synthetic** (clustered near the estate) — replace with real coordinates, or share the Google My Map so we can pull them (the `/edit` link is private → KML export 403s). |
| `capacity` | | Optional integer. |
| `notes` | | Free text. |

### `Personnel` (people & vendors directory) — `Personnel.csv`
One row per person/team. Feeds the Contacts Directory (Option B) and `ROS.lead_point_person`.

| Column | Required | Notes |
|---|---|---|
| `personnel_id` | ✓ | Stable id, e.g. `per-001`. |
| `name` | ✓ | Person or team/vendor name. |
| `role` | | Job title. |
| `department` | | Production / Lighting / Audio / Transport / Hospitality / Catering / Build / Design / Logistics / Venue Ops. |
| `org` | | Employer / vendor company. |
| `type` | | `lead` / `crew` / `artist` / `vendor`. |
| `email`, `phone` | | **Synthetic** (`*.example`, `+39 333 …`). Never commit real PII. |
| `location_default` | | FK → `Locations.location_id`. |
| `visibility` | | Role tags that may see this record, e.g. `admin,lead,crew`. |
| `app_role` | ✓ | Access level controls: `admin` / `crew` / `guest`. |
| `send_invite` | | Checkbox: `TRUE` / `FALSE`. Set `TRUE` to trigger Google Calendar subscription invite email. |
| `invite_status` | | Auto-updated sync status log (e.g. `Access Synchronized on 2026-07-04`). |
| `notes` | | Free text. |

### `Departments` (production divisions index) — `Departments.csv`
One row per operational division. Used to create separate calendar views.

| Column | Required | Notes |
|---|---|---|
| `dept_id` | ✓ | Stable ID, e.g. `dep-lighting`. |
| `name` | ✓ | Display name. |
| `lead_contact_id` | | FK → `Personnel.personnel_id`. |
| `color` | | Hex code used for UI accent styling. |
| `google_calendar_id`| | Automatically populated Google Calendar ID, e.g., `xxxx@group.calendar.google.com`. |

### `ROS` (structured run-of-show) — `ROS.csv`
One row per schedule item — the normalized form of the free-text `ROS BY AREA` grid. **91 sample rows**, every row mapped to a `location_id`.

| Column | Required | Notes |
|---|---|---|
| `event_id` | ✓ | Stable id, e.g. `ros-001`. |
| `date` | ✓ | ISO `YYYY-MM-DD`. |
| `start_time` | ✓ | 24h `HH:MM` (parsed from the entry text). |
| `end_time` | | 24h `HH:MM` when a range was stated. |
| `location_id` | ✓ | FK → `Locations`. |
| `foh_boh` | | Inherited from the location default; override per row. |
| `action` | ✓ | Category: Transportation / Crew Meal / Sanitation / Load In / Setup / Sound & Light / Check-in / Security / Review / Meeting / Hospitality / Performance / General. |
| `event_type` | ✓ | Maps to the app's `EventType` (services, food, venue, music, community, performance, installation). |
| `description` | ✓ | Original entry text. |
| `lead_point_person` | | FK → `Personnel` (parsed from `// Name`). |
| `support_personnel` | | `;`-separated FKs → `Personnel`. |
| `notes` | | Free text. |

### Legacy tabs (kept, treated as source/derived — not read by the app)
- `ROS BY TIME` — sparse original timeline (dates/times + free-text Description). Source for `ROS`.
- `ROS BY AREA` — wide Date×Area grid. The richest free-text source; `ROS` is generated from it.

## How to give us production data
1. Copy this template's tab structure into your event's Google Sheet (or fill these tabs).
2. Keep the **header rows exactly** as above — the loader matches on these column names.
3. Fill `Locations` first (with real `lat`/`lng`), then `Personnel`, then `ROS` referencing their ids.
4. Share the sheet (and the Google My Map, set to "anyone with link can view") with our service account so the app can read it.
5. Keep real contact details out of any committed copy — production PII stays in the live sheet only.

## Regenerating the sample
`ROS.csv` is generated from the `ROS BY AREA` grid (location = column, lead parsed from `// Name`, times parsed from the entry text). `Locations.csv` / `Personnel.csv` are hand-authored synthetic data derived only from names/places present in this sheet.
