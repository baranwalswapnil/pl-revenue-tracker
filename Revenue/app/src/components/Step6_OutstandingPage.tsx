import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  Layers,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  TrendingUp,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  Eye,
  Edit3,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { Project } from "../lib/models";
import { formatINR } from "../lib/mockData";
import {
  ALL_MONTHS,
  ALL_QUARTERS,
  calculatePeriodOutstanding,
  type OutstandingPeriod,
  type MonthMeta,
  type QuarterMeta,
  type EnrichedInvoiceItem,
} from "../lib/outstandingService";

interface Step6OutstandingPageProps {
  projects: Project[];
  initialPeriod: OutstandingPeriod;
  onBackToDashboard: () => void;
  onViewProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onOpenGoogleSheetSync?: () => void;
}

export const Step6_OutstandingPage: React.FC<Step6OutstandingPageProps> = ({
  projects,
  initialPeriod,
  onBackToDashboard,
  onViewProject,
  onEditProject,
  onOpenGoogleSheetSync,
}) => {
  const [currentPeriod, setCurrentPeriod] = useState<OutstandingPeriod>(initialPeriod);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "received">("all");
  const [selectedYear, setSelectedYear] = useState<number>(currentPeriod.year || 2026);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  // Re-calculate summary whenever period or projects change
  const summary = useMemo(() => {
    return calculatePeriodOutstanding(projects, currentPeriod);
  }, [projects, currentPeriod]);

  // Filter items by search term and status
  const filteredItems = useMemo(() => {
    return summary.items.filter((item) => {
      const matchesSearch =
        item.collegeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.projectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.invoiceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.academicYear.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "pending") return item.isPendingInPeriod || !item.isReceived;
      if (statusFilter === "received") return item.isReceived;

      return true;
    });
  }, [summary.items, searchTerm, statusFilter]);

  useEffect(() => {
    const updateWidth = () => {
      if (tableRef.current) {
        setTableScrollWidth(tableRef.current.scrollWidth);
      }
    };
    updateWidth();
    const timer = setTimeout(updateWidth, 100);
    window.addEventListener("resize", updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateWidth);
    };
  }, [filteredItems]);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  // Switch to specific quarter
  const handleSelectQuarter = (q: QuarterMeta) => {
    const nextPeriod: OutstandingPeriod = {
      type: "quarter",
      year: selectedYear,
      quarter: q.key,
      label: `${q.title} (${q.rangeText}) ${selectedYear}`,
    };
    setCurrentPeriod(nextPeriod);
  };

  // Switch to specific month
  const handleSelectMonth = (m: MonthMeta) => {
    const nextPeriod: OutstandingPeriod = {
      type: "month",
      year: selectedYear,
      month: m.num,
      label: `${m.name} ${selectedYear}`,
    };
    setCurrentPeriod(nextPeriod);
  };

  // Switch year
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setCurrentPeriod((prev) => ({
      ...prev,
      year,
      label:
        prev.type === "month"
          ? `${summary.monthName || "Month"} ${year}`
          : `${summary.quarterName || "Quarter"} ${year}`,
    }));
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "#",
      "Project Code",
      "College Name",
      "Academic Year",
      "Invoice Code",
      "Milestone Label",
      "Share %",
      "Invoice Amount (INR)",
      "Raised Status",
      "Date of Raised",
      "Raised Proof URL",
      "Received Status",
      "Date of Received",
      "Received Proof URL",
      "Outstanding Amount (INR)",
      "Payment Status",
    ];

    const rows = filteredItems.map((item, index) => [
      index + 1,
      `"${item.projectCode}"`,
      `"${item.collegeName}"`,
      `"${item.academicYear}"`,
      `"${item.invoiceCode}"`,
      `"${item.label}"`,
      `"${item.percentage}%"`,
      item.amount,
      item.isRaised ? "Raised" : "Pending",
      item.dateRaised || "",
      item.raisedProofUrl || "",
      item.isReceived ? "Received" : "Pending",
      item.dateReceived || "",
      item.receivedProofUrl || "",
      item.outstandingAmount,
      `"${item.status}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `outstanding_report_${currentPeriod.label.replace(/[^a-zA-Z0-9]/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="outstanding-page-container">
      {/* Top Header Banner & Breadcrumbs */}
      <div className="outstanding-header-card">
        <div className="outstanding-top-nav-row">
          <button
            type="button"
            className="outstanding-back-btn"
            onClick={onBackToDashboard}
            title="Return to Dashboard"
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>

          <div className="outstanding-breadcrumbs">
            <span className="crumb-item" onClick={onBackToDashboard} style={{ cursor: "pointer" }}>
              Dashboard
            </span>
            <ChevronRight size={14} className="crumb-separator" />
            <span className="crumb-item">Outstanding Invoices</span>
            <ChevronRight size={14} className="crumb-separator" />
            <span className="crumb-active">{currentPeriod.label}</span>
          </div>
        </div>

        <div className="outstanding-hero-title-row">
          <div className="hero-title-left">
            <div className="hero-icon-box">
              <Clock size={28} />
            </div>
            <div>
              <h1 className="hero-main-title">Outstanding & Collection Tracker</h1>
              <p className="hero-subtitle">
                Track invoices raised, collected, and outstanding payments for{" "}
                <strong>{currentPeriod.label}</strong>
              </p>
            </div>
          </div>

          <div className="hero-year-selector-wrap">
            <span className="year-selector-label">Financial Year:</span>
            <select
              className="styled-year-dropdown"
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
            </select>
          </div>
        </div>

        {/* IN-PAGE PERIOD SWITCHER: Quarters (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar) & Months (Jan to Dec) */}
        <div className="inpage-period-switcher-wrap">
          {/* 1. Quarterly Tabs */}
          <div className="switcher-section-group">
            <div className="switcher-group-label">
              <Layers size={14} />
              <span>Quarterly Reports:</span>
            </div>
            <div className="quarter-tabs-row">
              {ALL_QUARTERS.map((q) => {
                const isActive =
                  currentPeriod.type === "quarter" && currentPeriod.quarter === q.key;
                return (
                  <button
                    key={q.key}
                    type="button"
                    className={`quarter-tab-pill ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectQuarter(q)}
                  >
                    <span className="q-pill-code">{q.key}</span>
                    <span className="q-pill-range">{q.rangeText}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Monthly Tabs */}
          <div className="switcher-section-group" style={{ marginTop: "12px" }}>
            <div className="switcher-group-label">
              <Calendar size={14} />
              <span>Monthly Reports:</span>
            </div>
            <div className="month-tabs-row">
              {ALL_MONTHS.map((m) => {
                const isActive =
                  currentPeriod.type === "month" && currentPeriod.month === m.num;
                return (
                  <button
                    key={m.num}
                    type="button"
                    className={`month-tab-pill ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectMonth(m)}
                  >
                    <span className="m-pill-short">{m.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4 SUMMARY KPI CARDS */}
      <div className="outstanding-kpi-grid">
        {/* Card 1: Raised Invoices */}
        <div className="kpi-card raised-kpi-card">
          <div className="kpi-card-inner">
            <div className="kpi-header-row">
              <span className="kpi-title">Invoices Raised</span>
              <span className="kpi-badge-icon raised-badge-icon">
                <CheckCircle2 size={18} />
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-amount">{formatINR(summary.raisedAmount)}</span>
            </div>
            <div className="kpi-footer-row">
              <span className="kpi-count-text">
                <strong>{summary.raisedCount}</strong> invoice{summary.raisedCount === 1 ? "" : "s"} raised
              </span>
              <span className="kpi-period-tag">{currentPeriod.label}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Received Invoices */}
        <div className="kpi-card received-kpi-card">
          <div className="kpi-card-inner">
            <div className="kpi-header-row">
              <span className="kpi-title">Invoices Received / Collected</span>
              <span className="kpi-badge-icon received-badge-icon">
                <TrendingUp size={18} />
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-amount">{formatINR(summary.receivedAmount)}</span>
            </div>
            <div className="kpi-footer-row">
              <span className="kpi-count-text">
                <strong>{summary.receivedCount}</strong> received
              </span>
              <span className="kpi-efficiency-badge">
                {summary.collectionEfficiencyPct.toFixed(1)}% Collected
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Outstanding Balance */}
        <div className="kpi-card outstanding-kpi-card">
          <div className="kpi-card-inner">
            <div className="kpi-header-row">
              <span className="kpi-title">Outstanding / Pending Balance</span>
              <span className="kpi-badge-icon pending-badge-icon">
                <AlertCircle size={18} />
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-amount">{formatINR(summary.outstandingAmount)}</span>
            </div>
            <div className="kpi-footer-row">
              <span className="kpi-count-text">
                <strong>{summary.outstandingCount}</strong> pending invoice{summary.outstandingCount === 1 ? "" : "s"}
              </span>
              <span className="kpi-pending-status">
                {summary.outstandingAmount > 0 ? "Requires Collection" : "Fully Cleared"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Invoices in Scope */}
        <div className="kpi-card total-kpi-card">
          <div className="kpi-card-inner">
            <div className="kpi-header-row">
              <span className="kpi-title">Scope & Total Invoices</span>
              <span className="kpi-badge-icon total-badge-icon">
                <Building2 size={18} />
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-amount">{summary.totalInvoicesInScope} Invoices</span>
            </div>
            <div className="kpi-footer-row">
              <span className="kpi-count-text">
                Across <strong>{projects.length}</strong> colleges
              </span>
              <span className="kpi-period-tag">{selectedYear}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED INVOICE BREAKDOWN TABLE SECTION */}
      <div className="outstanding-table-section">
        {/* Table Controls & Filter Bar */}
        <div className="table-controls-bar">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search college, project code, or invoice..."
              className="table-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-tabs-wrap">
            <button
              type="button"
              className={`filter-tab-btn ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All Invoices ({summary.items.length})
            </button>
            <button
              type="button"
              className={`filter-tab-btn pending-tab ${statusFilter === "pending" ? "active" : ""}`}
              onClick={() => setStatusFilter("pending")}
            >
              Pending ({summary.outstandingCount})
            </button>
            <button
              type="button"
              className={`filter-tab-btn received-tab ${statusFilter === "received" ? "active" : ""}`}
              onClick={() => setStatusFilter("received")}
            >
              Received ({summary.receivedCount})
            </button>
          </div>

          <button
            type="button"
            className="export-csv-btn"
            onClick={handleExportCSV}
            title="Export this report to CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Top Synchronized Horizontal Sliding Scrollbar */}
        <div
          className="table-top-scrollbar-wrap"
          ref={topScrollRef}
          onScroll={handleTopScroll}
          title="Slide horizontally to view all table columns"
        >
          <div style={{ width: `${Math.max(tableScrollWidth, 1)}px`, height: "1px" }} />
        </div>

        {/* Invoices Table */}
        <div className="outstanding-table-scroll-wrap" ref={tableScrollRef} onScroll={handleTableScroll}>
          {filteredItems.length === 0 ? (
            <div className="empty-invoices-box">
              <Clock size={40} className="empty-icon" />
              <h3>No Invoices Found for {currentPeriod.label}</h3>
              <p>
                There are no invoices matching this period or filter. Try switching to another
                Quarter or Month above.
              </p>
            </div>
          ) : (
            <table className="outstanding-data-table" ref={tableRef}>
              <thead>
                <tr>
                  <th style={{ width: "45px" }}>#</th>
                  <th>College Name & Project Code</th>
                  <th>Milestone Code</th>
                  <th>Share (%)</th>
                  <th className="text-right">Invoice Amount (₹)</th>
                  <th>Tick Raised (Date & Proof)</th>
                  <th>Tick Received (Date & Proof)</th>
                  <th className="text-right">Outstanding (₹)</th>
                  <th className="text-center">Status</th>
                  <th className="text-center" style={{ width: "110px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  return (
                    <tr key={item.id} className={item.isReceived ? "row-received" : "row-pending"}>
                      <td className="text-muted font-mono">{idx + 1}</td>
                      <td>
                        <div className="college-info-cell">
                          <span className="college-main-name">{item.collegeName}</span>
                          <span className="project-code-sub">{item.projectCode} • {item.academicYear}</span>
                        </div>
                      </td>
                      <td>
                        <span className="invoice-code-badge">{item.invoiceCode}</span>
                        <span className="milestone-sub-label">{item.label}</span>
                      </td>
                      <td>
                        <span className="share-pct-pill">{item.percentage}%</span>
                      </td>
                      <td className="text-right font-semibold text-main">
                        {formatINR(item.amount)}
                      </td>
                      <td>
                        <div className="proof-cell-wrap">
                          {item.isRaised ? (
                            <span className="status-indicator-badge raised-badge">
                              ✓ Raised {item.dateRaised ? `(${item.dateRaised})` : ""}
                            </span>
                          ) : (
                            <span className="status-indicator-badge unraised-badge">Pending Raise</span>
                          )}
                          {item.raisedProofUrl && (
                            <a
                              href={item.raisedProofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="proof-link-pill"
                              title="View Raised Invoice Proof in Google Drive"
                            >
                              📄 View Proof
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="proof-cell-wrap">
                          {item.isReceived ? (
                            <span className="status-indicator-badge received-badge">
                              ✓ Received {item.dateReceived ? `(${item.dateReceived})` : ""}
                            </span>
                          ) : (
                            <span className="status-indicator-badge pending-received-badge">Pending</span>
                          )}
                          {item.receivedProofUrl && (
                            <a
                              href={item.receivedProofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="proof-link-pill received-proof-link"
                              title="View Received Invoice Proof in Google Drive"
                            >
                              📄 View Proof
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        {item.outstandingAmount > 0 ? (
                          <span className="pending-balance-text">
                            {formatINR(item.outstandingAmount)}
                          </span>
                        ) : (
                          <span className="cleared-balance-text">₹0 (Cleared)</span>
                        )}
                      </td>
                      <td className="text-center">
                        {item.isReceived ? (
                          <span className="status-pill-badge paid-pill">✓ Paid</span>
                        ) : item.isRaised ? (
                          <span className="status-pill-badge pending-pill">⏳ Pending</span>
                        ) : (
                          <span className="status-pill-badge unraised-pill">Not Raised</span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="table-actions-cell">
                          <button
                            type="button"
                            className="row-action-btn view-btn"
                            onClick={() => onViewProject(item.project)}
                            title="View Health Report"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="row-action-btn edit-btn"
                            onClick={() => onEditProject(item.project)}
                            title="Edit / Update Milestones"
                          >
                            <Edit3 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Summary Totals Row */}
              <tfoot>
                <tr className="table-totals-row">
                  <td colSpan={4} className="font-bold">
                    Total for {currentPeriod.label} ({filteredItems.length} Invoices)
                  </td>
                  <td className="text-right font-bold text-blue-600">
                    {formatINR(filteredItems.reduce((sum, item) => sum + item.amount, 0))}
                  </td>
                  <td colSpan={2} className="text-center font-semibold text-emerald-600">
                    Received: {formatINR(filteredItems.filter((i) => i.isReceived).reduce((sum, item) => sum + item.amount, 0))}
                  </td>
                  <td className="text-right font-bold text-amber-600">
                    {formatINR(filteredItems.reduce((sum, item) => sum + item.outstandingAmount, 0))}
                  </td>
                  <td colSpan={2} className="text-center text-muted font-medium">
                    {summary.collectionEfficiencyPct.toFixed(1)}% Collected
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
