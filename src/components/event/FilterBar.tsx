import React from "react";
import { Icon } from "@/components/ui/icons";

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedLocations: string[];
  setSelectedLocations: (locs: string[]) => void;
  selectedActions: string[];
  setSelectedActions: (acts: string[]) => void;
  selectedDepartments: string[];
  setSelectedDepartments: (depts: string[]) => void;
  selectedLeads: string[];
  setSelectedLeads: (leads: string[]) => void;
  startTimeFilter: string;
  setStartTimeFilter: (time: string) => void;
  endTimeFilter: string;
  setEndTimeFilter: (time: string) => void;
  hideUnscheduled: boolean;
  setHideUnscheduled: (hide: boolean) => void;
  locationOptions: string[];
  actionOptions: string[];
  departmentOptions: string[];
  leadOptions: string[];
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
  selectedDay: string | null;
  setSelectedDay: (day: string | null) => void;
  availableDates: { date: string; weekday: string; shortDate: string; fullLabel: string }[];
}

const formatFilterDateTime = (dtStr: string): string => {
  if (!dtStr) return "";
  const dateObj = new Date(dtStr);
  if (Number.isNaN(dateObj.getTime())) return dtStr;
  return dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  selectedLocations,
  setSelectedLocations,
  selectedActions,
  setSelectedActions,
  selectedDepartments,
  setSelectedDepartments,
  selectedLeads,
  setSelectedLeads,
  startTimeFilter,
  setStartTimeFilter,
  endTimeFilter,
  setEndTimeFilter,
  hideUnscheduled,
  setHideUnscheduled,
  locationOptions,
  actionOptions,
  departmentOptions,
  leadOptions,
  getColorStyle,
  selectedDay,
  setSelectedDay,
  availableDates,
}) => {
  return (
    <>
      <div className="legacy-search-row">
        <input
          id="portal-search-input"
          name="search"
          type="search"
          placeholder="Search description, action, dept, lead..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="legacy-search"
          aria-label="Search schedule"
        />
      </div>

      <div className="portal-dropdown-filters">
        <div className="filter-dropdown-group">
          <label htmlFor="filter-day">Day</label>
          <select
            id="filter-day"
            name="day"
            value={selectedDay || ""}
            onChange={(e) => setSelectedDay(e.target.value || null)}
          >
            <option value="">All Days</option>
            {availableDates.map((d) => (
              <option key={d.date} value={d.date}>
                {d.weekday}, {d.shortDate}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-dropdown-group">
          <label htmlFor="filter-location">Location</label>
          <select
            id="filter-location"
            name="location"
            value="all"
            onChange={(e) => {
              const val = e.target.value;
              if (val !== "all" && !selectedLocations.includes(val)) {
                setSelectedLocations([...selectedLocations, val]);
              }
            }}
          >
            <option value="all">Add Location Filter...</option>
            {locationOptions.map((loc) => (
              !selectedLocations.includes(loc) && (
                <option key={loc} value={loc} style={getColorStyle("Location", loc)}>
                  {loc}
                </option>
              )
            ))}
          </select>
        </div>

        <div className="filter-dropdown-group">
          <label htmlFor="filter-action">Action</label>
          <select
            id="filter-action"
            name="action"
            value="all"
            onChange={(e) => {
              const val = e.target.value;
              if (val !== "all" && !selectedActions.includes(val)) {
                setSelectedActions([...selectedActions, val]);
              }
            }}
          >
            <option value="all">Add Action Filter...</option>
            {actionOptions.map((act) => (
              !selectedActions.includes(act) && (
                <option key={act} value={act} style={getColorStyle("Action", act)}>
                  {act}
                </option>
              )
            ))}
          </select>
        </div>

        <div className="filter-dropdown-group">
          <label htmlFor="filter-department">Department</label>
          <select
            id="filter-department"
            name="department"
            value="all"
            onChange={(e) => {
              const val = e.target.value;
              if (val !== "all" && !selectedDepartments.includes(val)) {
                setSelectedDepartments([...selectedDepartments, val]);
              }
            }}
          >
            <option value="all">Add Department Filter...</option>
            {departmentOptions.map((dept) => (
              !selectedDepartments.includes(dept) && (
                <option key={dept} value={dept} style={getColorStyle("Department", dept)}>
                  {dept}
                </option>
              )
            ))}
          </select>
        </div>

        <div className="filter-dropdown-group">
          <label htmlFor="filter-lead">Lead</label>
          <select
            id="filter-lead"
            name="lead"
            value="all"
            onChange={(e) => {
              const val = e.target.value;
              if (val !== "all" && !selectedLeads.includes(val)) {
                setSelectedLeads([...selectedLeads, val]);
              }
            }}
          >
            <option value="all">Add Lead Filter...</option>
            {leadOptions.map((lead) => (
              !selectedLeads.includes(lead) && (
                <option key={lead} value={lead} style={getColorStyle("Personnel", lead)}>
                  {lead}
                </option>
              )
            ))}
          </select>
        </div>
      </div>

      {/* Time Range & Unscheduled Toggle Filters */}
      <div className="time-filter-row">
        <div className="time-input-group">
          <label htmlFor="time-start">Start Date &amp; Time</label>
          <input
            id="time-start"
            type="datetime-local"
            value={startTimeFilter}
            onChange={(e) => setStartTimeFilter(e.target.value)}
            className="time-picker-input"
          />
        </div>
        <div className="time-input-group">
          <label htmlFor="time-end">End Date &amp; Time</label>
          <input
            id="time-end"
            type="datetime-local"
            value={endTimeFilter}
            onChange={(e) => setEndTimeFilter(e.target.value)}
            className="time-picker-input"
          />
        </div>
        <div className="time-input-group unscheduled-toggle-group">
          <label id="date-tbd-toggle-label">Date TBD Events</label>
          <button
            type="button"
            className={`calendar-toggle-btn unscheduled-btn ${hideUnscheduled ? "active" : ""}`}
            onClick={() => setHideUnscheduled(!hideUnscheduled)}
            title={hideUnscheduled ? "Click to show events without a date" : "Click to hide events without a date"}
            aria-pressed={hideUnscheduled}
            aria-labelledby="date-tbd-toggle-label"
          >
            <Icon name={hideUnscheduled ? "eyeOff" : "eye"} size={12} />
            <span>{hideUnscheduled ? "Date TBD: Hidden" : "Date TBD: Shown"}</span>
          </button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {(selectedLocations.length > 0 ||
        selectedActions.length > 0 ||
        selectedDepartments.length > 0 ||
        selectedLeads.length > 0 ||
        startTimeFilter ||
        endTimeFilter ||
        selectedDay ||
        !hideUnscheduled ||
        searchQuery) && (
        <div className="active-filters-row">
          {searchQuery && (
            <span className="filter-chip search-chip">
              <Icon name="search" size={12} /> &quot;{searchQuery}&quot;
              <button type="button" className="clear-chip-btn" onClick={() => setSearchQuery("")} aria-label="Clear search"><Icon name="x" size={12} /></button>
            </span>
          )}
          {!hideUnscheduled && (
            <span className="filter-chip time-chip">
              <Icon name="calendar" size={12} /> Showing Date TBD
              <button type="button" className="clear-chip-btn" onClick={() => setHideUnscheduled(true)} aria-label="Hide Date TBD events"><Icon name="x" size={12} /></button>
            </span>
          )}
          {selectedDay && (() => {
            const found = availableDates.find((d) => d.date === selectedDay);
            const label = found ? `${found.weekday}, ${found.shortDate}` : selectedDay;
            return (
              <span className="filter-chip day-chip">
                <Icon name="calendar" size={12} /> Day: {label}
                <button type="button" className="clear-chip-btn" onClick={() => setSelectedDay(null)} aria-label="Clear day filter"><Icon name="x" size={12} /></button>
              </span>
            );
          })()}
          {selectedLocations.map((loc) => (
            <span key={`loc-${loc}`} className="filter-chip" style={getColorStyle("Location", loc)}>
              <Icon name="mapPin" size={12} /> {loc}
              <button type="button" className="clear-chip-btn" onClick={() => setSelectedLocations(selectedLocations.filter((l) => l !== loc))} aria-label="Clear location filter"><Icon name="x" size={12} /></button>
            </span>
          ))}
          {selectedActions.map((act) => (
            <span key={`act-${act}`} className="filter-chip" style={getColorStyle("Action", act)}>
              <Icon name="zap" size={12} /> {act}
              <button type="button" className="clear-chip-btn" onClick={() => setSelectedActions(selectedActions.filter((a) => a !== act))} aria-label="Clear action filter"><Icon name="x" size={12} /></button>
            </span>
          ))}
          {selectedDepartments.map((dept) => (
            <span key={`dept-${dept}`} className="filter-chip" style={getColorStyle("Department", dept)}>
              <Icon name="building" size={12} /> {dept}
              <button type="button" className="clear-chip-btn" onClick={() => setSelectedDepartments(selectedDepartments.filter((d) => d !== dept))} aria-label="Clear department filter"><Icon name="x" size={12} /></button>
            </span>
          ))}
          {selectedLeads.map((lead) => (
            <span key={`lead-${lead}`} className="filter-chip" style={getColorStyle("Personnel", lead)}>
              <Icon name="user" size={12} /> {lead}
              <button type="button" className="clear-chip-btn" onClick={() => setSelectedLeads(selectedLeads.filter((l) => l !== lead))} aria-label="Clear lead filter"><Icon name="x" size={12} /></button>
            </span>
          ))}
          {startTimeFilter && (
            <span className="filter-chip time-chip">
              <Icon name="clock" size={12} /> Start &ge; {formatFilterDateTime(startTimeFilter)}
              <button type="button" className="clear-chip-btn" onClick={() => setStartTimeFilter("")} aria-label="Clear start time filter"><Icon name="x" size={12} /></button>
            </span>
          )}
          {endTimeFilter && (
            <span className="filter-chip time-chip">
              <Icon name="clock" size={12} /> End &le; {formatFilterDateTime(endTimeFilter)}
              <button type="button" className="clear-chip-btn" onClick={() => setEndTimeFilter("")} aria-label="Clear end time filter"><Icon name="x" size={12} /></button>
            </span>
          )}

          <button
            type="button"
            className="clear-filters-btn"
            onClick={() => {
              setSelectedLocations([]);
              setSelectedActions([]);
              setSelectedDepartments([]);
              setSelectedLeads([]);
              setStartTimeFilter("");
              setEndTimeFilter("");
              setSearchQuery("");
              setSelectedDay(null);
              setHideUnscheduled(true);
            }}
          >
            Clear All Filters
          </button>
        </div>
      )}
    </>
  );
};
