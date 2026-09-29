import React from "react";
import { ArrowLeft, Building2, FileSpreadsheet } from "lucide-react";

interface HeaderProps {
  currentView: "dashboard" | "new-entry" | "training-phase" | "health-report" | "update-page" | "outstanding";
  onBackToDashboard: () => void;
  selectedCollegeName?: string;
  onResetSampleData?: () => void;
  onOpenGoogleSheetSync?: () => void;
  googleSheetCount?: number;
  isLiveSyncing?: boolean;
  lastLiveSyncTime?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onBackToDashboard,
  selectedCollegeName,
  onResetSampleData,
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

          {selectedCollegeName && currentView !== "dashboard" && (
            <div className="active-college-pill">
              <span className="live-status-dot"></span>
              <span className="active-college-name">{selectedCollegeName}</span>
            </div>
          )}

          {onResetSampleData && currentView === "dashboard" && (
            <button
              type="button"
              className="reset-demo-btn"
              onClick={() => {
                if (window.confirm("Restore the default 8 sample college records?")) {
                  onResetSampleData();
                }
              }}
              title="Reset Sample Data"
            >
              Restore Sample Data
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

