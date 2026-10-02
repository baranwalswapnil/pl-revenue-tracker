import React from "react";
import { ArrowLeft, CalendarRange, Clock, FileSpreadsheet } from "lucide-react";
import timeLogo from "../assets/time_logo.jpg";
import gryphonLogo from "../assets/gryphon_logo.png";

interface HeaderProps {
  currentView: "dashboard" | "new-entry" | "training-phase" | "health-report" | "update-page" | "outstanding" | "tcv" | "college-timeline";
  onBackToDashboard: () => void;
  selectedCollegeName?: string;
  onOpenGoogleSheetSync?: () => void;
  onOpenCollegeTimeline?: () => void;
  googleSheetCount?: number;
  activeTimelineCount?: number;
  isLiveSyncing?: boolean;
  lastLiveSyncTime?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onBackToDashboard,
  selectedCollegeName,
  onOpenGoogleSheetSync,
  onOpenCollegeTimeline,
  googleSheetCount = 0,
  activeTimelineCount = 0,
  isLiveSyncing = false,
  lastLiveSyncTime = null,
}) => {
  return (
    <header className="app-topbar-header">
      <div className="topbar-inner-container">
        {/* Brand Logo & Back Action */}
        <div className="topbar-brand-section">
          <div
            className="topbar-brand-logo"
            onClick={onBackToDashboard}
            style={{ cursor: "pointer" }}
            title="Company Finance - Click to return to Dashboard"
          >
            <div className="brand-icon-box">
              <img src={gryphonLogo} alt="Gryphon Academy" className="brand-logo-img" />
            </div>
            <div className="brand-text-block">
              <span className="brand-name-main">Company Finance</span>
              <span className="brand-name-sub">Estimation & Tracking</span>
            </div>
          </div>

          {/* Active College Timeline & Schedule Header Nav Button with Modern Time Logo */}
          {onOpenCollegeTimeline && (
            <div className="topbar-timeline-nav-group">
              <button
                type="button"
                className={`topbar-timeline-circle-btn ${currentView === "college-timeline" ? "active" : ""}`}
                onClick={onOpenCollegeTimeline}
                title="Active College Timeline & Schedule"
                aria-label="Active College Timeline & Schedule"
              >
                <span className="timeline-pulse-ring" />
                <img
                  src={timeLogo}
                  alt="Active College Timeline & Schedule"
                  className="topbar-timeline-logo-img"
                />
                {activeTimelineCount > 0 && (
                  <span className="timeline-circle-badge" title={`${activeTimelineCount} Active Colleges`}>
                    {activeTimelineCount}
                  </span>
                )}
              </button>

              {/* Modern Timeline Pill Action */}
              <button
                type="button"
                className={`topbar-timeline-pill-btn ${currentView === "college-timeline" ? "active" : ""}`}
                onClick={onOpenCollegeTimeline}
                title="Active College Timeline & Schedule"
                aria-label="Active College Timeline & Schedule"
              >
                <CalendarRange size={15} className="timeline-pill-icon" />
                <span className="timeline-pill-text">College Timeline</span>
                <span className="timeline-pill-status-dot" />
              </button>
            </div>
          )}

          {currentView !== "dashboard" && currentView !== "college-timeline" && (
            <button
              type="button"
              className="topbar-back-button"
              onClick={onBackToDashboard}
              aria-label="Back to Dashboard"
              title="Return to Dashboard"
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
          )}
        </div>

        {/* Right Details */}
        <div className="topbar-user-section">
          {onOpenGoogleSheetSync && (
            <button
              type="button"
              className={`header-gsheet-btn ${isLiveSyncing ? "syncing" : ""}`}
              onClick={onOpenGoogleSheetSync}
              title={
                lastLiveSyncTime
                  ? `Live connected! Last synced at ${lastLiveSyncTime}. Click to manage.`
                  : "Connect & Sync Google Spreadsheet"
              }
            >
              <span className="live-sync-indicator-dot" />
              <FileSpreadsheet size={16} />
              <span>
                {isLiveSyncing
                  ? "Syncing Live..."
                  : googleSheetCount > 0
                  ? `Live Sheet (${googleSheetCount})`
                  : "Connect Google Sheet"}
              </span>
            </button>
          )}

          {selectedCollegeName && currentView !== "dashboard" && currentView !== "outstanding" && currentView !== "tcv" && (
            <div className="active-college-pill" title={`Currently working on: ${selectedCollegeName}`}>
              <span className="live-status-dot"></span>
              <span style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: "12px" }}>College:</span>
              <span className="active-college-name">{selectedCollegeName}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

