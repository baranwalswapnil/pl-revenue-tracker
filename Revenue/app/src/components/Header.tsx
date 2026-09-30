import React from "react";
import { ArrowLeft, Building2, FileSpreadsheet, Moon, Sun } from "lucide-react";

interface HeaderProps {
  currentView: "dashboard" | "new-entry" | "training-phase" | "health-report" | "update-page" | "outstanding" | "tcv";
  onBackToDashboard: () => void;
  selectedCollegeName?: string;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onOpenGoogleSheetSync?: () => void;
  googleSheetCount?: number;
  isLiveSyncing?: boolean;
  lastLiveSyncTime?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onBackToDashboard,
  selectedCollegeName,
  isDarkMode = false,
  onToggleTheme,
  onOpenGoogleSheetSync,
  googleSheetCount = 0,
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
              <Building2 size={22} />
            </div>
            <div className="brand-text-block">
              <span className="brand-name-main">Company Finance</span>
              <span className="brand-name-sub">Estimation & Tracking</span>
            </div>
          </div>

          {currentView !== "dashboard" && (
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

          {onToggleTheme && (
            <button
              type="button"
              className={`theme-switch-btn ${isDarkMode ? "is-dark" : "is-light"}`}
              onClick={onToggleTheme}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Black Theme"}
              aria-label="Toggle Theme"
            >
              {isDarkMode ? (
                <>
                  <Sun size={16} className="theme-toggle-icon sun-icon" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon size={16} className="theme-toggle-icon moon-icon" />
                  <span>Black Theme</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

