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
  Code2,
  Copy,
  Check,
  Zap,
  Save,
} from "lucide-react";
import {
  fetchGoogleSheetData,
  fetchInvoiceTrackerData,
  mapRowsToCollegeItems,
  parseCSV,
  loadSavedSheetConfig,
  saveSheetConfig,
  saveCachedSheetItems,
  saveCachedInvoiceTrackerItems,
  testGoogleAppsScriptConnection,
  beautifySpreadsheetProofLinks,
  GOOGLE_APPS_SCRIPT_CODE,
  type GoogleSheetCollegeItem,
  type GoogleSheetInvoiceTrackerItem,
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
  const [scriptUrl, setScriptUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"url" | "paste" | "2way">("url");
  const [pastedText, setPastedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingScript, setIsTestingScript] = useState(false);
  const [testScriptResult, setTestScriptResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [beautifyResult, setBeautifyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<GoogleSheetCollegeItem[]>([]);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showCodeDetails, setShowCodeDetails] = useState(false);

  // Load saved config on open
  useEffect(() => {
    if (isOpen) {
      const config = loadSavedSheetConfig();
      setSheetUrl(config.sheetUrl || "");
      setSheetName(config.sheetName || "");
      setScriptUrl(config.scriptUrl || "");
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

      let invoiceCount = 0;
      try {
        const invItems = await fetchInvoiceTrackerData(sheetUrl.trim(), "Invoice Tracker");
        if (invItems.length > 0) {
          saveCachedInvoiceTrackerItems(invItems);
          invoiceCount = invItems.length;
        }
      } catch (invErr) {
        console.log("Note: 'Invoice Tracker' tab not found or skipped:", invErr);
      }

      setPreviewItems(items);
      saveSheetConfig({
        sheetUrl: sheetUrl.trim(),
        sheetName: sheetName.trim(),
        scriptUrl: scriptUrl.trim(),
        lastSyncedAt: new Date().toISOString(),
      });
      saveCachedSheetItems(items);

      if (invoiceCount > 0) {
        setSyncSuccessMsg(
          `Successfully fetched ${items.length} colleges and synchronized ${invoiceCount} milestones from 'Invoice Tracker' tab!`
        );
      } else {
        setSyncSuccessMsg(`Successfully fetched ${items.length} colleges from Google Sheet!`);
      }
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

  const handleSave2WayConfig = () => {
    if (!scriptUrl.trim()) {
      setErrorMsg("Please enter your Google Apps Script Web App URL.");
      return;
    }

    if (!scriptUrl.includes("script.google.com")) {
      setErrorMsg("Please enter a valid Google Apps Script URL (starts with https://script.google.com/macros/s/...)");
      return;
    }

    saveSheetConfig({
      sheetUrl: sheetUrl.trim(),
      sheetName: sheetName.trim(),
      scriptUrl: scriptUrl.trim(),
      lastSyncedAt: new Date().toISOString(),
    });

    setErrorMsg(null);
    setSyncSuccessMsg("2-Way Google Sheet Sync URL saved! Adding and editing colleges on the website will now write & update your Google Spreadsheet automatically in real-time.");
  };

  const handleTestScriptConnection = async () => {
    if (!scriptUrl.trim()) {
      setErrorMsg("Please enter your Google Apps Script Web App URL first.");
      return;
    }

    setIsTestingScript(true);
    setTestScriptResult(null);
    setErrorMsg(null);

    const result = await testGoogleAppsScriptConnection(scriptUrl.trim());
    setTestScriptResult(result);
    setIsTestingScript(false);
  };

  const handleBeautifyLinks = async () => {
    if (!scriptUrl.trim()) {
      setErrorMsg("Please enter your Google Apps Script Web App URL first.");
      return;
    }

    setIsBeautifying(true);
    setBeautifyResult(null);
    setErrorMsg(null);

    const result = await beautifySpreadsheetProofLinks(scriptUrl.trim());
    setBeautifyResult(result);
    setIsBeautifying(false);
  };

  const handleCopyScriptCode = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
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
              <h2 className="modal-title">Google Spreadsheet Sync</h2>
              <p className="modal-subtitle">
                Two-way live synchronization: Fetch pre-data and automatically add & update spreadsheet rows.
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
            <span>1. Google Sheet Link</span>
          </button>
          <button
            type="button"
            className={`gsheet-tab-btn ${activeTab === "2way" ? "active" : ""}`}
            onClick={() => setActiveTab("2way")}
          >
            <Zap size={15} />
            <span>2. Two-Way Add & Edit Sync</span>
          </button>
          <button
            type="button"
            className={`gsheet-tab-btn ${activeTab === "paste" ? "active" : ""}`}
            onClick={() => setActiveTab("paste")}
          >
            <Upload size={15} />
            <span>Manual Paste / CSV</span>
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
                placeholder="https://docs.google.com/spreadsheets/d/1JbDE4KDkwcQ72t7IJi-2siU46jUaK-m4BlYP1NjdJJw/edit"
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

        {/* Tab 2: Two-Way Sync / Write to Sheet */}
        {activeTab === "2way" && (
          <div className="gsheet-tab-content">
            <div className="gsheet-2way-banner">
              <Zap size={20} className="text-amber-500" />
              <div>
                <strong>Automatic 2-Way Sync & Google Drive Photo Uploads</strong>
                <p>
                  When you add or edit colleges, or upload invoice photo proofs, they are automatically saved into Google Drive and recorded into the matching college row in your live Google Spreadsheet.
                </p>
              </div>
            </div>

            <div className="form-field-group">
              <label className="field-label-text" htmlFor="gsheetScriptUrl">
                <Zap size={15} className="label-icon" />
                <span>Google Apps Script Web App URL <span className="req-star">*</span></span>
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  id="gsheetScriptUrl"
                  type="text"
                  className="styled-input-control"
                  style={{ flex: 1, minWidth: "220px" }}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={scriptUrl}
                  onChange={(e) => setScriptUrl(e.target.value)}
                />
                <button
                  type="button"
                  className="form-btn primary-submit-btn"
                  onClick={handleSave2WayConfig}
                  style={{ padding: "0 18px", whiteSpace: "nowrap" }}
                >
                  <Save size={15} />
                  <span>Save URL</span>
                </button>
                <button
                  type="button"
                  className="form-btn"
                  onClick={handleTestScriptConnection}
                  disabled={isTestingScript}
                  style={{
                    backgroundColor: "#0d9488",
                    color: "#fff",
                    padding: "0 16px",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: 600,
                  }}
                >
                  {isTestingScript ? <RefreshCw size={15} className="spinning" /> : <Zap size={15} />}
                  <span>{isTestingScript ? "Testing..." : "Test Connection"}</span>
                </button>
                <button
                  type="button"
                  className="form-btn"
                  onClick={handleBeautifyLinks}
                  disabled={isBeautifying}
                  style={{
                    backgroundColor: "#6366f1",
                    color: "#fff",
                    padding: "0 16px",
                    whiteSpace: "nowrap",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: 600,
                  }}
                >
                  {isBeautifying ? <RefreshCw size={15} className="spinning" /> : <Sparkles size={15} />}
                  <span>{isBeautifying ? "Beautifying..." : "✨ Beautify Proof Links"}</span>
                </button>
              </div>

              {testScriptResult && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "12.5px",
                    backgroundColor: testScriptResult.success ? "#ecfdf5" : "#fef2f2",
                    border: `1px solid ${testScriptResult.success ? "#a7f3d0" : "#fecaca"}`,
                    color: testScriptResult.success ? "#065f46" : "#991b1b",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {testScriptResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{testScriptResult.message}</span>
                </div>
              )}

              {beautifyResult && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "12.5px",
                    backgroundColor: beautifyResult.success ? "#f5f3ff" : "#fef2f2",
                    border: `1px solid ${beautifyResult.success ? "#ddd6fe" : "#fecaca"}`,
                    color: beautifyResult.success ? "#5b21b6" : "#991b1b",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {beautifyResult.success ? <Sparkles size={16} /> : <AlertCircle size={16} />}
                  <span>{beautifyResult.message}</span>
                </div>
              )}

              <span className="field-hint-text" style={{ marginTop: "8px", display: "block" }}>
                {scriptUrl ? (
                  <span style={{ color: "#10b981", fontWeight: 600 }}>
                    ✓ 2-Way sync is configured! All new uploads automatically format as aesthetic '=HYPERLINK()' badges.
                  </span>
                ) : (
                  "Follow the 3-step guide below to generate and test your Google Apps Script URL."
                )}
              </span>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="gsheet-steps-box">
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "var(--text-primary)" }}>
                🛠️ Quick 3-Step Setup for 2-Way Sync & Drive Uploads:
              </h4>
              <ol style={{ paddingLeft: "20px", margin: "0 0 12px 0", fontSize: "13px", lineHeight: "1.7", color: "var(--text-secondary)" }}>
                <li>
                  Open your <a href={sheetUrl || "https://docs.google.com/spreadsheets/d/1JbDE4KDkwcQ72t7IJi-2siU46jUaK-m4BlYP1NjdJJw/edit"} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Google Spreadsheet</a> and click <strong>Extensions &gt; Apps Script</strong> in the top menu.
                </li>
                <li>
                  Delete any existing code in the editor, click the <strong>"Copy Apps Script Code"</strong> button below, paste it into the editor, and click <strong>Save</strong> (💾 icon).
                </li>
                <li>
                  <strong>Authorize Drive Permissions (One-Time)</strong>: In the toolbar dropdown next to "Debug", select <code>authorizeDrive</code> &rarr; click <strong>Run</strong> (▶️) &rarr; click <strong>Review Permissions</strong> &rarr; choose your account &rarr; <strong>Advanced</strong> &rarr; <strong>Go to project (unsafe)</strong> &rarr; <strong>Allow</strong>.
                </li>
                <li>
                  Click <strong>Deploy &gt; New deployment</strong> (or <em>Manage deployments &gt; Edit &gt; New version</em>) &rarr; Set <em>Execute as: <strong>Me</strong></em> and <em>Who has access: <strong>Anyone</strong> (REQUIRED!)</em> &rarr; Click <strong>Deploy</strong> &rarr; Copy the Web App URL and paste it in the box above!
                </li>
                <li>
                  <strong>✨ Convert Existing Links to Badges</strong>: Click the <strong>"✨ Beautify Proof Links"</strong> button above or in your spreadsheet top menu click <strong>🚀 P&L Revenue Tools &gt; ✨ Beautify All Proof Links</strong> to instantly convert all existing raw URLs into clean badges!
                </li>
              </ol>

              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "6px",
                  padding: "10px 14px",
                  marginBottom: "12px",
                  fontSize: "12px",
                  color: "#92400e",
                  lineHeight: "1.5",
                }}
              >
                ⚠️ <strong>Important Note on Code Updates:</strong> If you already deployed earlier, you must go to <strong>Deploy &gt; Manage deployments &gt; Edit (pencil icon) &gt; Version: New version &gt; Deploy</strong> for the new Drive upload & Column creation code to take effect!
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  className="form-btn"
                  onClick={handleCopyScriptCode}
                  style={{
                    backgroundColor: copiedScript ? "#10b981" : "var(--color-primary)",
                    color: "#fff",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {copiedScript ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedScript ? "Copied Script Code!" : "Copy Apps Script Code"}</span>
                </button>

                <button
                  type="button"
                  className="form-btn reset-btn"
                  onClick={() => setShowCodeDetails(!showCodeDetails)}
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                >
                  <Code2 size={14} />
                  <span>{showCodeDetails ? "Hide Script Preview" : "View Script Code"}</span>
                </button>
              </div>

              {showCodeDetails && (
                <pre
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    background: "rgba(0,0,0,0.4)",
                    borderRadius: "8px",
                    fontSize: "11px",
                    maxHeight: "180px",
                    overflowY: "auto",
                    color: "#93c5fd",
                    fontFamily: "monospace",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Direct Paste Tab */}
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
