import React, { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
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
  ChevronRight,
  ChevronDown,
  X,
  Eye,
  Edit3,
  RefreshCw,
  Check,
} from "lucide-react";
import type { Project } from "../lib/models";
import { formatINR } from "../lib/mockData";
import {
  ALL_MONTHS,
  ALL_QUARTERS,
  calendarYearForMonth,
  fiscalYearLabel,
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
  onRefreshData?: () => Promise<void>;
  isSyncing?: boolean;
}

type StatusFilter = "all" | "pending" | "received";

/* ------------------------------------------------------------------ */
/* Helpers (single source of truth for rules used in several places)   */
/* ------------------------------------------------------------------ */

type InvoiceBucket = "pending" | "received" | "other";

// Single source of truth: Invoice Tracker column N (item.status)
//   Received            -> "received"
//   Pending / Raised / Processed -> "pending"
//   anything else       -> "other" (visible only under "All Invoices")
const getBucket = (i: EnrichedInvoiceItem): InvoiceBucket => {
  const s = String(i.status ?? "").trim().toLowerCase();
  if (s === "received") return "received";
  if (
    s === "pending" ||
    s === "pending payment" ||
    s === "raised" ||
    s === "processed"
  ) {
    return "pending";
  }
  return "other";
};

const isPendingItem = (i: EnrichedInvoiceItem): boolean => getBucket(i) === "pending";
const isReceivedItem = (i: EnrichedInvoiceItem): boolean => getBucket(i) === "received";

// Invoice amount used for display and totals (falls back to `amount`).
const getInvoiceAmount = (i: EnrichedInvoiceItem): number | undefined | null =>
  i.amountRaised || i.amount;

const getInvoiceAmountNum = (i: EnrichedInvoiceItem): number =>
  getInvoiceAmount(i) || 0;

const isPrinted = (printed: unknown): boolean => {
  if (typeof printed === "string") {
    const v = printed.trim().toLowerCase();
    return v === "yes" || v === "true";
  }
  return Boolean(printed);
};

const formatDate = (value?: string | null): string => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value; // keep raw text if not a parseable date
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const labelForPeriod = (p: OutstandingPeriod, year: number): string => {
  // `year` is the year the financial year STARTS (2026 = Apr 2026 to Mar 2027)
  if (p.type === "month") {
    const m = ALL_MONTHS.find((x) => x.num === p.month);
    return m ? `${m.name} ${calendarYearForMonth(year, m.num)}` : `Month ${fiscalYearLabel(year)}`;
  }
  if (p.type === "quarter") {
    const q = ALL_QUARTERS.find((x) => x.key === p.quarter);
    return q ? `${q.title} (${q.rangeText}) ${fiscalYearLabel(year)}` : `Quarter ${fiscalYearLabel(year)}`;
  }
  return `${fiscalYearLabel(year)} (Apr – Mar)`;
};

// Safe CSV cell: always quoted, quotes escaped, formulas neutralised
const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

const YEAR_OPTIONS = [2027, 2026, 2025, 2024, 2023];

export const Step6_OutstandingPage: React.FC<Step6OutstandingPageProps> = ({
  projects,
  initialPeriod,
  onBackToDashboard,
  onViewProject,
  onEditProject,
  onOpenGoogleSheetSync,
  onRefreshData,
  isSyncing = false,
}) => {
  const [currentPeriod, setCurrentPeriod] = useState<OutstandingPeriod>(initialPeriod);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCollege, setSelectedCollege] = useState<string>("all");
  const [collegeSearchTerm, setCollegeSearchTerm] = useState<string>("");
  const [isCollegeDropdownOpen, setIsCollegeDropdownOpen] = useState<boolean>(false);
  const [isLocalRefreshing, setIsLocalRefreshing] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Year is derived from the period so the two can never drift apart
  const selectedYear: number = currentPeriod.year || 2026;
  const isRefreshing = isLocalRefreshing || isSyncing;

  const yearOptions = useMemo(
    () =>
      YEAR_OPTIONS.includes(selectedYear)
        ? YEAR_OPTIONS
        : [selectedYear, ...YEAR_OPTIONS].sort((a, b) => b - a),
    [selectedYear]
  );

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const collegeDropdownRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const isSyncingScroll = useRef(false);

  // If the parent passes a different initial period later, follow it
  useEffect(() => {
    setCurrentPeriod(initialPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialPeriod.type,
    initialPeriod.year,
    initialPeriod.month,
    initialPeriod.quarter,
    initialPeriod.label,
  ]);

  // Close college dropdown on outside click or Escape
  useEffect(() => {
    if (!isCollegeDropdownOpen) return;

    const close = () => {
      setIsCollegeDropdownOpen(false);
      setCollegeSearchTerm("");
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (
        collegeDropdownRef.current &&
        !collegeDropdownRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCollegeDropdownOpen]);

  const closeCollegeDropdown = () => {
    setIsCollegeDropdownOpen(false);
    setCollegeSearchTerm("");
  };

  // Distinct colleges (case-insensitive) with invoice and project counts
  const collegeOptions = useMemo(() => {
    const map = new Map<string, { name: string; invoiceCount: number; projectCount: number }>();
    projects.forEach((p) => {
      const name = (p.college_name || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name, invoiceCount: 0, projectCount: 0 });
      }
      const data = map.get(key)!;
      data.projectCount++;
      data.invoiceCount += (p.invoices || []).length;
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filteredCollegeOptions = useMemo(() => {
    if (!collegeSearchTerm) return collegeOptions;
    const term = collegeSearchTerm.toLowerCase().trim();
    return collegeOptions.filter((c) => c.name.toLowerCase().includes(term));
  }, [collegeOptions, collegeSearchTerm]);

  // Projects filtered by selected college
  const filteredProjects = useMemo(() => {
    if (selectedCollege === "all") return projects;
    const target = selectedCollege.toLowerCase().trim();
    return projects.filter((p) => (p.college_name || "").toLowerCase().trim() === target);
  }, [projects, selectedCollege]);

  // Summary for current period + college
  const summary = useMemo(() => {
    return calculatePeriodOutstanding(filteredProjects, currentPeriod);
  }, [filteredProjects, currentPeriod]);

  // Dev check: duplicate ids in the data break React row reconciliation
  useEffect(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    summary.items.forEach((i) => {
      const k = String(i.id);
      if (seen.has(k)) dupes.add(k);
      seen.add(k);
    });
    if (dupes.size > 0) {
      console.warn("Step6: duplicate invoice ids in data:", Array.from(dupes));
    }
  }, [summary.items]);

  // Tab counts use exactly the same predicates as the filter below
  const pendingTabCount = useMemo(
    () => summary.items.filter(isPendingItem).length,
    [summary.items]
  );
  const receivedTabCount = useMemo(
    () => summary.items.filter(isReceivedItem).length,
    [summary.items]
  );

  // Colleges that actually have invoices in this period
  const collegesInScope = useMemo(() => {
    const set = new Set<string>();
    summary.items.forEach((i) => {
      const n = (i.collegeName || "").trim().toLowerCase();
      if (n) set.add(n);
    });
    return set.size;
  }, [summary.items]);

  // Search + status filter, then a stable sort
  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    const matchesStatus = (i: EnrichedInvoiceItem) =>
      statusFilter === "pending"
        ? isPendingItem(i)
        : statusFilter === "received"
        ? isReceivedItem(i)
        : true; // "all" = every invoice, whatever its status

    const matchesSearch = (i: EnrichedInvoiceItem) => {
      if (!term) return true;
      return (
        (i.collegeName || "").toLowerCase().includes(term) ||
        (i.projectCode || "").toLowerCase().includes(term) ||
        (i.invoiceCode || "").toLowerCase().includes(term) ||
        (i.academicYear || "").toLowerCase().includes(term) ||
        (!!i.gaInvoiceCode && i.gaInvoiceCode.toLowerCase().includes(term)) ||
        (!!i.invoiceType && i.invoiceType.toLowerCase().includes(term)) ||
        (!!i.remarks && i.remarks.toLowerCase().includes(term)) ||
        (!!i.tdsStatus && i.tdsStatus.toLowerCase().includes(term)) ||
        (!!i.status && String(i.status).toLowerCase().includes(term))
      );
    };

    return summary.items
      .filter((i) => matchesSearch(i) && matchesStatus(i))
      .sort(
        (a, b) =>
          (a.collegeName || "").localeCompare(b.collegeName || "") ||
          (a.invoiceCode || "").localeCompare(b.invoiceCode || "", undefined, { numeric: true })
      );
  }, [summary.items, searchTerm, statusFilter]);

  // Footer totals, computed once (based on the same status rule as the tabs)
  const totals = useMemo(() => {
    const raised = filteredItems.reduce((sum, i) => sum + getInvoiceAmountNum(i), 0);
    const received = filteredItems.reduce(
      (sum, i) =>
        sum + (isReceivedItem(i) ? i.amountReceived ?? getInvoiceAmountNum(i) : 0),
      0
    );
    const outstanding = filteredItems.reduce(
      (sum, i) =>
        sum + (isPendingItem(i) ? i.outstandingAmount ?? getInvoiceAmountNum(i) : 0),
      0
    );
    const pct = raised > 0 ? (received / raised) * 100 : 0;
    return { raised, received, outstanding, pct };
  }, [filteredItems]);

  const isEmpty = filteredItems.length === 0;
  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "all";

  // Keep the top scrollbar width in sync with the real table width
  useEffect(() => {
    const el = tableRef.current;
    if (!el) {
      setTableScrollWidth(0);
      return;
    }
    const updateWidth = () => {
      setTableScrollWidth(Math.max(el.scrollWidth, el.offsetWidth));
    };
    updateWidth();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateWidth);
      observer.observe(el);
    }
    window.addEventListener("resize", updateWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [isEmpty]);

  const handleTopScroll = () => {
    if (!isSyncingScroll.current && topScrollRef.current && tableScrollRef.current) {
      isSyncingScroll.current = true;
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handleTableScroll = () => {
    if (!isSyncingScroll.current && topScrollRef.current && tableScrollRef.current) {
      isSyncingScroll.current = true;
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  const handleRefreshClick = async () => {
    if (!onRefreshData || isRefreshing) return;
    setIsLocalRefreshing(true);
    setRefreshError(null);
    try {
      await onRefreshData();
    } catch (e) {
      console.error("Step6 refresh error:", e);
      setRefreshError("Could not sync invoices. Check your connection and try again.");
    } finally {
      setIsLocalRefreshing(false);
    }
  };

  // Period switchers (labels all come from the same helper shape)
  const handleSelectAllYear = () => {
    setCurrentPeriod({
      type: "all",
      year: selectedYear,
      label: labelForPeriod({ type: "all", year: selectedYear, label: "" }, selectedYear),
    });
  };

  const handleSelectQuarter = (q: QuarterMeta) => {
    setCurrentPeriod({
      type: "quarter",
      year: selectedYear,
      quarter: q.key,
      label: `${q.title} (${q.rangeText}) ${fiscalYearLabel(selectedYear)}`,
    });
  };

  const handleSelectMonth = (m: MonthMeta) => {
    setCurrentPeriod({
      type: "month",
      year: selectedYear,
      month: m.num,
      label: `${m.name} ${calendarYearForMonth(selectedYear, m.num)}`,
    });
  };

  const handleYearChange = (year: number) => {
    setCurrentPeriod((prev) => ({
      ...prev,
      year,
      label: labelForPeriod(prev, year),
    }));
  };

  // Export to Excel (.xlsx format with formatted column widths)
  const handleExportExcel = () => {
    const headers = [
      "#",
      "Project Code",
      "College Name",
      "Academic Year",
      "Invoice Code",
      "GA Invoice Code",
      "Invoice Type",
      "Milestone Label",
      "Percentage",
      "Payment Term",
      "Amount from MOU (INR)",
      "Invoice Amount Raised (INR)",
      "Raised Date",
      "Raised Proof URL",
      "Received Status",
      "Date of Received",
      "Received Proof URL",
      "Outstanding Amount (INR)",
      "Payment Status",
      "TDS Status",
      "Printed Hardcopy",
      "Remarks",
    ];

    const rows = filteredItems.map((item, index) => [
      index + 1,
      item.projectCode || "",
      item.collegeName || "",
      item.academicYear || "",
      item.invoiceCode || "",
      item.gaInvoiceCode || "",
      item.invoiceType || "",
      item.label || "",
      item.percentage !== undefined && item.percentage !== null ? `${item.percentage}%` : "",
      item.paymentTerm || "",
      item.amountFromMou ?? 0,
      getInvoiceAmountNum(item),
      item.isRaised ? "Raised" : "Pending",
      item.dateRaised || "",
      item.raisedProofUrl || "",
      item.isReceived ? "Received" : "Pending",
      item.dateReceived || "",
      item.receivedProofUrl || "",
      item.outstandingAmount || 0,
      item.status || "",
      item.tdsStatus || "",
      isPrinted(item.printed) ? "Yes" : "No",
      item.remarks || "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 25 },
      { wch: 35 },
      { wch: 15 },
      { wch: 18 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
      { wch: 12 },
      { wch: 20 },
      { wch: 22 },
      { wch: 25 },
      { wch: 14 },
      { wch: 14 },
      { wch: 30 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outstanding Report");
    XLSX.writeFile(
      wb,
      `outstanding_report_${currentPeriod.label.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`
    );
  };

  const onKeyActivate =
    (fn: () => void) => (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fn();
      }
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
            <span
              className="crumb-item"
              role="button"
              tabIndex={0}
              onClick={onBackToDashboard}
              onKeyDown={onKeyActivate(onBackToDashboard)}
              style={{ cursor: "pointer" }}
            >
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
                {selectedCollege !== "all" && (
                  <span className="hero-selected-college-tag">
                    {" • "}
                    <Building2
                      size={13}
                      style={{ display: "inline", verticalAlign: "-1px", marginRight: "3px" }}
                    />
                    {selectedCollege}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div
            className="hero-year-selector-wrap"
            style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}
          >
            <span className="year-selector-label">Financial Year:</span>
            <select
              className="styled-year-dropdown"
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {fiscalYearLabel(y)}
                </option>
              ))}
            </select>

            {onRefreshData && (
              <button
                type="button"
                className={`outstanding-refresh-btn ${isRefreshing ? "spinning" : ""}`}
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                title="Sync latest invoices from Invoice Tracker sheet"
              >
                <RefreshCw size={15} />
                <span>{isRefreshing ? "Syncing..." : "Sync Invoices"}</span>
              </button>
            )}

            {onOpenGoogleSheetSync && (
              <button
                type="button"
                className="outstanding-refresh-btn"
                onClick={onOpenGoogleSheetSync}
                title="Open Google Sheet sync settings"
              >
                <FileSpreadsheet size={15} />
                <span>Google Sheet</span>
              </button>
            )}
          </div>
        </div>

        {refreshError && (
          <div
            role="alert"
            style={{
              marginTop: "10px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: "0.85rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>{refreshError}</span>
            <button
              type="button"
              onClick={() => setRefreshError(null)}
              aria-label="Dismiss error"
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* IN-PAGE PERIOD & COLLEGE SWITCHER */}
        <div className="inpage-period-switcher-wrap">
          {/* College Selector Dropdown */}
          <div className="outstanding-college-filter-bar" ref={collegeDropdownRef}>
            <div className="switcher-group-label">
              <Building2 size={15} />
              <span>Filter by College:</span>
              {selectedCollege !== "all" && <span className="active-filter-badge">Active</span>}
            </div>

            <div className="tcv-custom-select-wrap outstanding-college-select-wrap">
              <button
                type="button"
                className={`tcv-select-trigger-btn ${isCollegeDropdownOpen ? "active" : ""}`}
                aria-haspopup="listbox"
                aria-expanded={isCollegeDropdownOpen}
                onClick={() =>
                  isCollegeDropdownOpen ? closeCollegeDropdown() : setIsCollegeDropdownOpen(true)
                }
              >
                <span className="tcv-trigger-text">
                  {selectedCollege === "all"
                    ? `All Colleges (${collegeOptions.length})`
                    : selectedCollege}
                </span>
                <ChevronDown size={16} className="tcv-chevron-icon" />
              </button>

              {isCollegeDropdownOpen && (
                <div className="tcv-dropdown-menu">
                  <div className="tcv-dropdown-search-box">
                    <Search size={14} className="dropdown-search-icon" />
                    <input
                      type="text"
                      placeholder="Search college name..."
                      value={collegeSearchTerm}
                      onChange={(e) => setCollegeSearchTerm(e.target.value)}
                      className="tcv-dropdown-search-input"
                      autoFocus
                    />
                    {collegeSearchTerm && (
                      <button
                        type="button"
                        className="clear-dropdown-search"
                        onClick={() => setCollegeSearchTerm("")}
                        aria-label="Clear college search"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  <div className="tcv-dropdown-options-list" role="listbox">
                    <div
                      role="option"
                      aria-selected={selectedCollege === "all"}
                      tabIndex={0}
                      className={`tcv-dropdown-option ${selectedCollege === "all" ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedCollege("all");
                        closeCollegeDropdown();
                      }}
                      onKeyDown={onKeyActivate(() => {
                        setSelectedCollege("all");
                        closeCollegeDropdown();
                      })}
                    >
                      <div className="option-name-row">
                        <span className="option-name font-semibold">All Colleges</span>
                        <span className="option-meta-badge">{collegeOptions.length} colleges</span>
                      </div>
                      {selectedCollege === "all" && <Check size={16} className="check-mark-icon" />}
                    </div>

                    {filteredCollegeOptions.map((c) => {
                      const isSelected =
                        selectedCollege.toLowerCase().trim() === c.name.toLowerCase();
                      const pick = () => {
                        setSelectedCollege(c.name);
                        closeCollegeDropdown();
                      };
                      return (
                        <div
                          key={c.name}
                          role="option"
                          aria-selected={isSelected}
                          tabIndex={0}
                          className={`tcv-dropdown-option ${isSelected ? "selected" : ""}`}
                          onClick={pick}
                          onKeyDown={onKeyActivate(pick)}
                        >
                          <div className="option-name-row">
                            <span className="option-name">{c.name}</span>
                            <span className="option-val-tag">
                              {c.invoiceCount} invoice{c.invoiceCount === 1 ? "" : "s"}
                            </span>
                          </div>
                          {isSelected && <Check size={16} className="check-mark-icon" />}
                        </div>
                      );
                    })}

                    {filteredCollegeOptions.length === 0 && (
                      <div className="tcv-dropdown-empty">
                        No college matching "{collegeSearchTerm}"
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedCollege !== "all" && (
                <button
                  type="button"
                  className="clear-college-filter-btn"
                  onClick={() => setSelectedCollege("all")}
                  title="Clear college filter"
                >
                  <X size={14} />
                  <span>Clear Filter</span>
                </button>
              )}
            </div>
          </div>

          <div className="outstanding-filter-divider" />

          {/* Full Year & Quarterly Tabs */}
          <div className="switcher-section-group">
            <div className="switcher-group-label">
              <Layers size={14} />
              <span>Period Reports:</span>
            </div>
            <div className="quarter-tabs-row">
              <button
                type="button"
                className={`quarter-tab-pill all-pill ${currentPeriod.type === "all" ? "active" : ""}`}
                onClick={handleSelectAllYear}
              >
                <span className="q-pill-code">All Months</span>
                <span className="q-pill-range">({fiscalYearLabel(selectedYear)})</span>
              </button>

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

          {/* Monthly Tabs */}
          <div className="switcher-section-group" style={{ marginTop: "12px" }}>
            <div className="switcher-group-label">
              <Calendar size={14} />
              <span>Monthly Reports:</span>
            </div>
            <div className="month-tabs-row">
              {ALL_MONTHS.map((m) => {
                const isActive = currentPeriod.type === "month" && currentPeriod.month === m.num;
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
                <strong>{summary.raisedCount}</strong> invoice{summary.raisedCount === 1 ? "" : "s"}{" "}
                raised
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
                <strong>{summary.outstandingCount}</strong> pending invoice
                {summary.outstandingCount === 1 ? "" : "s"}
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
                Across <strong>{collegesInScope}</strong> college{collegesInScope === 1 ? "" : "s"}
              </span>
              <span className="kpi-period-tag">{fiscalYearLabel(selectedYear)}</span>
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
              Pending ({pendingTabCount})
            </button>
            <button
              type="button"
              className={`filter-tab-btn received-tab ${statusFilter === "received" ? "active" : ""}`}
              onClick={() => setStatusFilter("received")}
            >
              Received ({receivedTabCount})
            </button>
          </div>

          <button
            type="button"
            className="export-csv-btn export-excel-btn"
            onClick={handleExportExcel}
            disabled={isEmpty}
            title="Export this report to Excel (.xlsx)"
          >
            <Download size={15} />
            <span>Export Excel</span>
          </button>
        </div>

        {/* Top Synchronized Horizontal Scrollbar (hidden when there is no table) */}
        {!isEmpty && (
          <div
            className="table-top-scrollbar-wrap"
            ref={topScrollRef}
            onScroll={handleTopScroll}
            title="Slide horizontally to view all table columns"
          >
            <div style={{ width: `${Math.max(tableScrollWidth, 1)}px`, height: "1px" }} />
          </div>
        )}

        {/* Invoices Table */}
        <div
          className="outstanding-table-scroll-wrap"
          ref={tableScrollRef}
          onScroll={handleTableScroll}
        >
          {isEmpty ? (
            <div className="empty-invoices-box">
              <Clock size={40} className="empty-icon" />
              <h3>
                {hasActiveFilters
                  ? "No invoices match your search or filter"
                  : `No Invoices Found for ${currentPeriod.label}`}
              </h3>
              <p>
                {hasActiveFilters
                  ? "Try clearing the search box or switching back to All Invoices."
                  : "There are no invoices in this period. Try another quarter or month above, or view all months."}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                  marginTop: "1rem",
                  flexWrap: "wrap",
                }}
              >
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="outstanding-refresh-btn"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                    }}
                  >
                    <span>Clear search & filter</span>
                  </button>
                )}
                {!hasActiveFilters && currentPeriod.type !== "all" && (
                  <button
                    type="button"
                    className="outstanding-refresh-btn"
                    onClick={handleSelectAllYear}
                  >
                    <span>View All Months ({fiscalYearLabel(selectedYear)})</span>
                  </button>
                )}
                {onRefreshData && (
                  <button
                    type="button"
                    className="outstanding-refresh-btn"
                    onClick={handleRefreshClick}
                    disabled={isRefreshing}
                  >
                    <RefreshCw size={15} className={isRefreshing ? "spinning" : ""} />
                    <span>{isRefreshing ? "Syncing..." : "Sync Invoices"}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <table className="outstanding-data-table" ref={tableRef}>
              <thead>
                <tr>
                  <th style={{ width: "45px" }}>#</th>
                  <th>College Name & Project Code</th>
                  <th>Remarks</th>
                  <th>Percentage</th>
                  <th>Payment Term</th>
                  <th className="text-right">Invoice Amount (₹)</th>
                  <th>Raised date</th>
                  <th className="text-center">Status</th>
                  <th className="text-center" style={{ width: "110px" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody key={`${statusFilter}|${currentPeriod.label}|${selectedCollege}`}>
                {filteredItems.map((item, idx) => {
                  const amount = getInvoiceAmount(item);
                  const showMouAmount =
                    !!item.amountFromMou && item.amountFromMou !== (amount ?? 0);
                  const bucket = getBucket(item);

                  return (
                    <tr
                      key={`${item.id ?? ""}|${item.projectCode ?? ""}|${item.invoiceCode ?? ""}|${idx}`}
                      className={bucket === "received" ? "row-received" : "row-pending"}
                    >
                      {/* Running row number for the current view */}
                      <td className="text-muted font-mono">{idx + 1}</td>
                      <td>
                        <div className="college-info-cell">
                          <span className="college-main-name">
                            {item.collegeName ? (
                              item.collegeName
                            ) : (
                              <span className="missing-data-text">Missing data</span>
                            )}
                          </span>
                          <span className="project-code-sub">
                            {item.projectCode ? (
                              item.projectCode
                            ) : (
                              <span className="missing-data-text">Missing data</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.remarks ? (
                          <span className="milestone-remarks-pill" title={item.remarks}>
                            {item.remarks}
                          </span>
                        ) : (
                          <span className="missing-data-text">No remarks</span>
                        )}
                      </td>
                      <td>
                        <span className="share-pct-pill">
                          {item.percentage !== undefined && item.percentage !== null ? (
                            `${item.percentage}%`
                          ) : (
                            <span className="missing-data-text">Missing data</span>
                          )}
                        </span>
                      </td>
                      <td>{item.paymentTerm || <span className="missing-data-text">Missing data</span>}</td>
                      <td className="text-right">
                        <div className="amount-cell-wrap">
                          <span className="font-semibold text-main">
                            {amount !== undefined && amount !== null ? (
                              formatINR(amount)
                            ) : (
                              <span className="missing-data-text">Missing data</span>
                            )}
                          </span>
                          {showMouAmount && (
                            <span className="mou-amount-sub" title="MOU Planned Amount">
                              MOU: {formatINR(item.amountFromMou as number)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="proof-cell-wrap">
                          {item.dateRaised ? (
                            <span className="status-indicator-badge raised-badge">
                              {formatDate(item.dateRaised)}
                            </span>
                          ) : (
                            <span className="status-indicator-badge unraised-badge">
                              Pending
                            </span>
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
                      <td className="text-center">
                        <div className="status-cell-wrap">
                          {/* Badge uses the same bucket rule as the tabs */}
                          {bucket === "received" ? (
                            <span className="status-pill-badge paid-pill">✓ Paid</span>
                          ) : bucket === "pending" ? (
                            <span className="status-pill-badge pending-pill">⏳ Pending</span>
                          ) : (
                            <span className="status-pill-badge unraised-pill">
                              {item.status || "Not Raised"}
                            </span>
                          )}
                          {item.tdsStatus && (
                            <span className="tds-status-tag" title={`TDS Status: ${item.tdsStatus}`}>
                              TDS: {item.tdsStatus}
                            </span>
                          )}
                          {isPrinted(item.printed) && (
                            <span className="printed-tag" title="Hardcopy Printed & Dispatched">
                              🖨️ Hardcopy
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="table-actions-cell">
                          <button
                            type="button"
                            className="row-action-btn view-btn"
                            onClick={() => onViewProject(item.project)}
                            title="View Health Report"
                            aria-label="View Health Report"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="row-action-btn edit-btn"
                            onClick={() => onEditProject(item.project)}
                            title="Edit / Update Milestones"
                            aria-label="Edit / Update Milestones"
                          >
                            <Edit3 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals for the rows currently shown (respects search + status filter) */}
              <tfoot>
                <tr className="table-totals-row">
                  <td colSpan={5} className="font-bold">
                    {hasActiveFilters ? "Filtered total" : "Total"} for {currentPeriod.label} (
                    {filteredItems.length} Invoices)
                  </td>
                  <td className="text-right font-bold text-blue-600">
                    {formatINR(totals.raised)}
                  </td>
                  <td />
                  <td className="text-center text-muted font-medium">
                    Received: {formatINR(totals.received)} ({totals.pct.toFixed(1)}% collected)
                    {" • "}Outstanding: {formatINR(totals.outstanding)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
