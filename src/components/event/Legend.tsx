import React from "react";
import { Icon } from "@/components/ui/icons";

interface LegendProps {
  categories: string[];
  activeCategories: string[];
  onToggleCategory: (category: string) => void;
  getColorStyle: (category: "Location" | "Action" | "Department" | "Personnel", value: string | undefined) => React.CSSProperties;
}

export const Legend: React.FC<LegendProps> = ({
  categories,
  activeCategories,
  onToggleCategory,
  getColorStyle,
}) => {
  return (
    <div className="map-legend-card">
      <h3 className="legend-title"><Icon name="mapPin" size={14} /> Map Pins Legend</h3>
      <div className="legend-categories">
        {categories.map((cat) => {
          const isActive = activeCategories.includes(cat);
          const style = getColorStyle("Location", cat);
          return (
            <button
              key={cat}
              type="button"
              className={`legend-item ${isActive ? "active" : "inactive"}`}
              onClick={() => onToggleCategory(cat)}
            >
              <span 
                className="legend-color-dot" 
                style={{ backgroundColor: style.backgroundColor || "var(--accent)" }}
              ></span>
              <span className="legend-label">{cat}</span>
              <span className="legend-toggle-status">{isActive ? <Icon name="eye" size={12} /> : <Icon name="eyeOff" size={12} />}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
