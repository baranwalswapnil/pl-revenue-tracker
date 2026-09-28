import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Link,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  ArrowRight,
  Database,
  Building2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  fetchGoogleSheetData,
  mapRowsToCollegeItems,
  parseCSV,
  loadSavedSheetConfig,
  saveSheetConfig,
  saveCachedSheetItems,
  type GoogleSheetCollegeItem,
} from "../lib/googleSheetsService";
import { formatINR } from "../lib/mockData";

interface GoogleSheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportColleges: (items: GoogleSheetCollegeItem[]) => void;
  cachedColleges: GoogleSheetCollegeItem[];
}

export const GoogleSheetSyncModal: React.FC<GoogleSheetSyncModalProps> = ({
  isOpen,
  onClose,
  onImportColleges,
  cachedColleges,
}) => {
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [activeTab, setActiveTab] = useState<"url" | "paste">("url");
  const [pastedText, setPastedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<GoogleSheetCollegeItem[]>([]);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Load saved config on open
  useEffect(() => {
    if (isOpen) {
      const config = loadSavedSheetConfig();
      setSheetUrl(config.sheetUrl || "");
      setSheetName(config.sheetName || "");
      setErrorMsg(null);
      setSyncSuccessMsg(null);
      if (cachedColleges.length > 0) {
        setPreviewItems(cachedColleges);
      }
    }
  }, [isOpen, cachedColleges]);

  if (!isOpen) return null;

  const handleFetchFromUrl = async () => {
    if (!sheetUrl.trim()) {
      setErrorMsg("Please enter a valid Google Spreadsheet URL or Sheet ID.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSyncSuccessMsg(null);

    try {
      const items = await fetchGoogleSheetData(sheetUrl.trim(), sheetName.trim());
      if (items.length === 0) {
        setErrorMsg("No college rows found in the spreadsheet. Please verify headers.");
        setIsLoading(false);
        return;
      }

      setPreviewItems(items);
      saveSheetConfig({
        sheetUrl: sheetUrl.trim(),
        sheetName: sheetName.trim(),
        lastSyncedAt: new Date().toISOString(),
      });
      saveCachedSheetItems(items);
      setSyncSuccessMsg(`Successfully fetched ${items.length} colleges from Google Sheet!`);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setErrorMsg(
        err.message ||
          "Could not fetch data from Google Sheet. Make sure the sheet sharing is set to 'Anyone with the link can view'."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleParsePastedData = () => {
    if (!pastedText.trim()) {
      setErrorMsg("Please paste your spreadsheet data or CSV.");
      return;
    }

    setErrorMsg(null);
    setSyncSuccessMsg(null);

    try {
      // Normalize tab-separated values from Excel/Google Sheets copy-paste to CSV
      const normalized = pastedText.includes("\t")
        ? pastedText
            .split("\n")
            .map((line) =>
              line
                .split("\t")
                .map((cell) => `"${cell.replace(/"/g, '""')}"`)
                .join(",")
            )
            .join("\n")
        : pastedText;

      const rows = parseCSV(normalized);
      const items = mapRowsToCollegeItems(rows);

      if (items.length === 0) {
        setErrorMsg("Could not parse college rows. Please make sure column headers are included in row 1.");
        return;
      }

      setPreviewItems(items);
      saveCachedSheetItems(items);
      setSyncSuccessMsg(`Parsed ${items.length} colleges successfully!`);
    } catch (e: any) {
      setErrorMsg(`Failed to parse data: ${e.message}`);
    }
  };

  const handleApplyToWebsite = () => {
    if (previewItems.length === 0) {
      setErrorMsg("Please fetch or paste data first.");
      return;
    }
    onImportColleges(previewItems);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="gsheet-sync-modal">
        {/* Header */}
        <div className="modal-hero-header">
          <div className="modal-hero-left">
            <div className="modal-icon-badge gsheet-badge">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="modal-title">Connect Google Spreadsheet</h2>
              <p className="modal-subtitle">
                Fetch colleges & contract details directly into Add & Update College forms.
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Sync Mode Tabs */}
        <div className="gsheet-tabs-row">
          <button
            type="button"
            className={`gsheet-tab-btn ${activeTab === "url" ? "active" : ""}`}
            onClick={() => setActiveTab("url")}
          >
            <Link size={15} />
            <span>Google Sheet Link / URL</span>
          </button>
          <button
            type="button"
            className={`gsheet-tab-btn ${activeTab === "paste" ? "active" : ""}`}
            onClick={() => setActiveTab("paste")}
          >
            <Upload size={15} />
            <span>Paste Copied Table / CSV</span>
          </button>
        </div>

        {/* Tab 1: Google Sheet URL Input */}
        {activeTab === "url" && (
          <div className="gsheet-tab-content">
            <div className="form-field-group">
              <label className="field-label-text" htmlFor="gsheetUrlInput">
                <Link size={15} className="label-icon" />
                <span>Google Spreadsheet Link or ID <span className="req-star">*</span></span>
              </label>
              <input
                id="gsheetUrlInput"
                type="text"
                className="styled-input-control"
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
              <span className="field-hint-text">
                💡 Make sure sharing is set to <strong>"Anyone with the link can view"</strong>.
              </span>
            </div>

            <div className="form-field-group">
              <label className="field-label-text" htmlFor="gsheetTabInput">
                <FileSpreadsheet size={15} className="label-icon" />
                <span>Sheet Tab Name (Optional, e.g. Sheet1)</span>
              </label>
              <input
                id="gsheetTabInput"
                type="text"
                className="styled-input-control"
                placeholder="Sheet1"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="gsheet-fetch-btn"
              onClick={handleFetchFromUrl}
              disabled={isLoading || !sheetUrl.trim()}
            >
              <RefreshCw size={16} className={isLoading ? "spinning" : ""} />
              <span>{isLoading ? "Fetching Spreadsheet..." : "Fetch & Sync Colleges"}</span>
            </button>
          </div>
        )}

        {/* Tab 2: Direct Paste Tab */}
        {activeTab === "paste" && (
          <div className="gsheet-tab-content">
            <div className="form-field-group">
              <label className="field-label-text" htmlFor="gsheetPasteArea">
                <Upload size={15} className="label-icon" />
                <span>Copy & Paste Data directly from Google Sheets / Excel</span>
              </label>
              <textarea
                id="gsheetPasteArea"
                className="styled-textarea-control"
                rows={6}
                placeholder="Select all rows in your Google Sheet (including header row), press Ctrl+C, and paste here..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="gsheet-fetch-btn"
              onClick={handleParsePastedData}
              disabled={!pastedText.trim()}
            >
              <Sparkles size={16} />
              <span>Parse & Map Columns</span>
            </button>
          </div>
        )}

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="gsheet-alert error-alert">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {syncSuccessMsg && (
          <div className="gsheet-alert success-alert">
            <CheckCircle2 size={18} />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {/* Preview of Fetched College Items */}
        {previewItems.length > 0 && (
          <div className="gsheet-preview-container">
            <div className="gsheet-preview-header">
              <div className="preview-title-group">
                <Database size={16} className="blue-text" />
                <h3 className="preview-title">
                  Fetched Colleges ({previewItems.length})
                </h3>
              </div>
              <span className="preview-ready-badge">Ready to Pre-fill</span>
            </div>

            <div className="gsheet-preview-table-wrap">
              <table className="gsheet-preview-table">
                <thead>
                  <tr>
                    <th>Project Code</th>
                    <th>College Name</th>
                    <th>Students</th>
                    <th>Cost/Student</th>
                    <th>Contract Total</th>
                    <th>Payment</th>
                    <th>Invoices</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.slice(0, 8).map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="font-mono text-blue">{item.project_code}</td>
                      <td className="font-semibold">{item.college_name}</td>
                      <td>{item.student_count}</td>
                      <td>{formatINR(item.cost_per_student)}</td>
                      <td>{formatINR(item.total_cost_value)}</td>
                      <td>
                        <span className="pay-tag">{item.payment_type}</span>
                      </td>
                      <td>{item.invoice_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewItems.length > 8 && (
                <div className="preview-more-hint">
                  + {previewItems.length - 8} more colleges ready
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="modal-bottom-actions">
          <button type="button" className="form-btn reset-btn" onClick={onClose}>
            Close
          </button>
          {previewItems.length > 0 && (
            <button
              type="button"
              className="form-btn primary-submit-btn"
              onClick={handleApplyToWebsite}
            >
              <CheckCircle2 size={16} />
              <span>Import All {previewItems.length} Colleges to Workspace</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
