import React, { useState, useRef, useEffect } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Layers,
} from "lucide-react";
import {
  ALL_MONTHS,
  ALL_QUARTERS,
  type OutstandingPeriod,
  type QuarterMeta,
  type MonthMeta,
} from "../lib/outstandingService";

interface OutstandingDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPeriod: (period: OutstandingPeriod) => void;
  activePeriod?: OutstandingPeriod;
}

export const OutstandingDropdown: React.FC<OutstandingDropdownProps> = ({
  isOpen,
  onClose,
  onSelectPeriod,
  activePeriod,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isQuarterExpanded, setIsQuarterExpanded] = useState<boolean>(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectQuarter = (q: QuarterMeta) => {
    onSelectPeriod({
      type: "quarter",
      year: selectedYear,
      quarter: q.key,
      label: `${q.title} (${q.rangeText}) ${selectedYear}`,
    });
    onClose();
  };

  const handleSelectMonth = (m: MonthMeta) => {
    onSelectPeriod({
      type: "month",
      year: selectedYear,
      month: m.num,
      label: `${m.name} ${selectedYear}`,
    });
    onClose();
  };

  return (
    <div className="outstanding-dropdown-overlay" role="dialog" aria-modal="true">
      <div className="outstanding-dropdown-panel" ref={dropdownRef}>
        {/* Dropdown Header & Year Selector */}
        <div className="outstanding-dropdown-header">
          <div className="dropdown-title-wrap">
            <div className="dropdown-header-icon">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="dropdown-heading">Outstanding Invoices</h3>
              <p className="dropdown-subtext">Select Quarter or Month for Invoice & Collection Tracking</p>
            </div>
          </div>

          <div className="dropdown-year-select-wrap">
            <label className="year-label" htmlFor="outstanding-year-select">Year:</label>
            <select
              id="outstanding-year-select"
              className="dropdown-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
            </select>
          </div>
        </div>

        {/* SECTION 1: QUARTER REPORT (Top Section with expandable sub-options) */}
        <div className="dropdown-section quarter-section">
          <button
            type="button"
            className="quarter-report-trigger-btn"
            onClick={() => setIsQuarterExpanded(!isQuarterExpanded)}
          >
            <div className="quarter-trigger-left">
              <div className="quarter-badge-icon">
                <Layers size={16} />
              </div>
              <div className="quarter-trigger-text">
                <span className="quarter-main-label">📊 Quarter Report</span>
                <span className="quarter-sub-label">Apr-Jun, Jul-Sep, Oct-Dec, Jan-March</span>
              </div>
            </div>
            <div className="quarter-trigger-arrow">
              {isQuarterExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>
          </button>

          {/* Expanded Quarterly Options (Apr-Jun, Jul-Sep, Oct-Dec, Jan-March) */}
          {isQuarterExpanded && (
            <div className="quarter-options-grid animate-fade-in">
              {ALL_QUARTERS.map((q) => {
                const isSelected =
                  activePeriod?.type === "quarter" &&
                  activePeriod.quarter === q.key &&
                  activePeriod.year === selectedYear;

                return (
                  <button
                    key={q.key}
                    type="button"
                    className={`quarter-card-btn ${isSelected ? "active" : ""}`}
                    onClick={() => handleSelectQuarter(q)}
                  >
                    <div className="quarter-card-top">
                      <span className="quarter-code-pill" style={{ borderColor: q.color, color: q.color }}>
                        {q.key}
                      </span>
                      <span className="quarter-range-text">{q.rangeText}</span>
                    </div>
                    <div className="quarter-card-desc">{q.monthNames}</div>
                    <div className="quarter-card-footer">
                      <span className="view-report-text">View Report &rarr;</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="dropdown-divider-row">
          <span className="divider-line" />
          <span className="divider-label">OR CHOOSE MONTH</span>
          <span className="divider-line" />
        </div>

        {/* SECTION 2: MONTHLY REPORT (Jan to Dec Options) */}
        <div className="dropdown-section month-section">
          <div className="months-grid-container">
            {ALL_MONTHS.map((m) => {
              const isSelected =
                activePeriod?.type === "month" &&
                activePeriod.month === m.num &&
                activePeriod.year === selectedYear;

              return (
                <button
                  key={m.num}
                  type="button"
                  className={`month-chip-btn ${isSelected ? "active" : ""}`}
                  onClick={() => handleSelectMonth(m)}
                >
                  <span className="month-short">{m.short}</span>
                  <span className="month-full-name">{m.name}</span>
                  <span className="month-quarter-tag">{m.quarter}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dropdown Footer */}
        <div className="outstanding-dropdown-footer">
          <span className="footer-hint-text">
            💡 Shows Raised vs. Received Invoices & Pending Balances in that period.
          </span>
          <button type="button" className="dropdown-close-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
