import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Building2,
  Calendar,
  FileSpreadsheet,
  Coins,
  RefreshCw,
  Sparkles,
  ChevronDown,
  Check,
} from "lucide-react";
import { type GoogleSheetMOUItem, parseMOUDateMonth } from "../lib/googleSheetsService";
import { formatINR } from "../lib/mockData";
import { ALL_QUARTERS } from "../lib/outstandingService";

export interface Step7TCVPageProps {
  mouItems: GoogleSheetMOUItem[];
  onBackToDashboard: () => void;
  onRefreshData?: () => Promise<void>;
  isSyncing?: boolean;
}

type PeriodFilterMode = "all" | "quarter" | "month";

export const CALENDAR_MONTHS = [
  { num: 1, name: "January", short: "Jan" },
  { num: 2, name: "February", short: "Feb" },
  { num: 3, name: "March", short: "Mar" },
  { num: 4, name: "April", short: "Apr" },
  { num: 5, name: "May", short: "May" },
  { num: 6, name: "June", short: "Jun" },
  { num: 7, name: "July", short: "Jul" },
  { num: 8, name: "August", short: "Aug" },
  { num: 9, name: "September", short: "Sep" },
  { num: 10, name: "October", short: "Oct" },
  { num: 11, name: "November", short: "Nov" },
  { num: 12, name: "December", short: "Dec" },
];

export const Step7_TCVPage: React.FC<Step7TCVPageProps> = ({
  mouItems,
  onBackToDashboard,
  onRefreshData,
  isSyncing = false,
}) => {
  // Local refreshing state to prevent unwanted perpetual spinning
  const [isLocalRefreshing, setIsLocalRefreshing] = useState<boolean>(false);

  // State for College filter
  const [selectedCollege, setSelectedCollege] = useState<string>("all");
  const [collegeSearchTerm, setCollegeSearchTerm] = useState<string>("");
  const [isCollegeDropdownOpen, setIsCollegeDropdownOpen] = useState<boolean>(false);

  // State for Period (Quarter / Month) filter
  const [periodMode, setPeriodMode] = useState<PeriodFilterMode>("all");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("Q1");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonthNum, setSelectedMonthNum] = useState<number | null>(4);

  // Search filter for table
  const [tableSearchTerm, setTableSearchTerm] = useState<string>("");

  const handleRefreshClick = async () => {
    if (!onRefreshData || isLocalRefreshing) return;
    setIsLocalRefreshing(true);
    try {
      await onRefreshData();
    } catch (e) {
      console.error("TCV refresh error:", e);
    } finally {
      setIsLocalRefreshing(false);
    }
  };

  // Refs for synchronized horizontal scrolling
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const collegeDropdownRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1200);

  // Close college dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        collegeDropdownRef.current &&
        !collegeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCollegeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update table scroll width on resize
  useEffect(() => {
    if (tableRef.current) {
      setTableScrollWidth(tableRef.current.scrollWidth);
    }
  }, [mouItems, selectedCollege, periodMode, selectedQuarter, selectedMonthNum, selectedYear]);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  // Distinct list of colleges with their MOU counts and total TCV
  const collegeOptions = useMemo(() => {
    const map = new Map<string, { count: number; tcv: number }>();
    mouItems.forEach((item) => {
      const name = (item.collegeName || "").trim();
      if (!name) return;
      if (!map.has(name)) {
        map.set(name, { count: 0, tcv: 0 });
      }
      const data = map.get(name)!;
      data.count++;
      data.tcv += item.totalContractValue || 0;
    });

    const list = Array.from(map.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      tcv: data.tcv,
    }));

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [mouItems]);

  // Filtered college list for dropdown search
  const filteredCollegeOptions = useMemo(() => {
    if (!collegeSearchTerm) return collegeOptions;
    const term = collegeSearchTerm.toLowerCase().trim();
    return collegeOptions.filter((c) => c.name.toLowerCase().includes(term));
  }, [collegeOptions, collegeSearchTerm]);

  // Pre-calculate month statistics (MOU count & total TCV) for calendar view
  const getMonthStats = useMemo(() => {
    const statsMap = new Map<string, { count: number; tcv: number; tcvGst: number }>();
    mouItems.forEach((item) => {
      if (
        selectedCollege !== "all" &&
        item.collegeName?.toLowerCase().trim() !== selectedCollege.toLowerCase().trim()
      ) {
        return;
      }
      const parsed = parseMOUDateMonth(item.month || "");
      if (parsed.monthNum > 0 && parsed.year > 0) {
        const key = `${parsed.year}-${parsed.monthNum}`;
        const existing = statsMap.get(key) || { count: 0, tcv: 0, tcvGst: 0 };
        existing.count += 1;
        existing.tcv += item.totalContractValue || 0;
        existing.tcvGst += item.totalContractValueGst || 0;
        statsMap.set(key, existing);
      }
    });
    return (monthNum: number, year: number) => {
      return statsMap.get(`${year}-${monthNum}`) || { count: 0, tcv: 0, tcvGst: 0 };
    };
  }, [mouItems, selectedCollege]);

  // Helper function to check if an MOU item matches the selected Period (Col AR)
  const matchesPeriod = (item: GoogleSheetMOUItem): boolean => {
    if (periodMode === "all") return true;

    const parsed = parseMOUDateMonth(item.month || "");
    const itemMonthNum = parsed.monthNum;
    const itemYear = parsed.year;
    const monthStr = (parsed.display || item.month || "").toLowerCase().trim();
    const mouDate = (item.mouSignedDate || "").toLowerCase().trim();

    if (periodMode === "quarter") {
      const qMeta = ALL_QUARTERS.find((q) => q.key === selectedQuarter);
      if (!qMeta) return true;

      // 1. Direct month number match
      if (itemMonthNum > 0 && qMeta.months.includes(itemMonthNum)) {
        return true;
      }

      // 2. Text month name match
      const matchesMonthName = qMeta.months.some((mNum) => {
        const mMeta = CALENDAR_MONTHS.find((m) => m.num === mNum);
        if (!mMeta) return false;
        return (
          monthStr.includes(mMeta.name.toLowerCase()) ||
          monthStr.includes(mMeta.short.toLowerCase())
        );
      });

      if (matchesMonthName) return true;

      // 3. Fallback check on MOU signed date (e.g. DD/MM/YYYY)
      const dateParts = mouDate.split(/[-/]/);
      if (dateParts.length >= 2) {
        const monthPart = parseInt(dateParts[1], 10);
        if (!isNaN(monthPart) && qMeta.months.includes(monthPart)) {
          return true;
        }
      }

      return false;
    }

    if (periodMode === "month") {
      if (selectedMonthNum === null) {
        // If "All Months of Year" is chosen
        if (itemYear > 0) return itemYear === selectedYear;
        return true;
      }

      // 1. Direct month number & year match
      if (itemMonthNum > 0) {
        if (itemYear > 0) {
          return itemMonthNum === selectedMonthNum && itemYear === selectedYear;
        }
        return itemMonthNum === selectedMonthNum;
      }

      const mMeta = CALENDAR_MONTHS.find((m) => m.num === selectedMonthNum);
      if (!mMeta) return true;

      // 2. Text month & year match
      if (
        monthStr.includes(mMeta.name.toLowerCase()) ||
        monthStr.includes(mMeta.short.toLowerCase())
      ) {
        if (monthStr.includes(String(selectedYear))) {
          return true;
        }
        return true;
      }

      // 3. Fallback check on MOU signed date
      const dateParts = mouDate.split(/[-/]/);
      if (dateParts.length >= 2) {
        const monthPart = parseInt(dateParts[1], 10);
        const yearPart = dateParts.length >= 3 ? parseInt(dateParts[2], 10) : 0;
        if (!isNaN(monthPart) && monthPart === selectedMonthNum) {
          if (yearPart > 0) {
            const fullYear = yearPart < 100 ? 2000 + yearPart : yearPart;
            return fullYear === selectedYear;
          }
          return true;
        }
      }

      return false;
    }

    return true;
  };

  // Filtered MOU items based on College, Period, and Table Search
  const filteredItems = useMemo(() => {
    return mouItems.filter((item) => {
      // 1. College filter
      if (selectedCollege !== "all") {
        if (
          (item.collegeName || "").toLowerCase().trim() !==
          selectedCollege.toLowerCase().trim()
        ) {
          return false;
        }
      }

      // 2. Period filter
      if (!matchesPeriod(item)) {
        return false;
      }

      // 3. Table Search filter
      if (tableSearchTerm) {
        const term = tableSearchTerm.toLowerCase().trim();
        const searchPool = `${item.collegeName} ${item.projectCode} ${item.courseStream || ""} ${item.domainOfTraining || ""} ${item.month} ${item.contractType || ""}`.toLowerCase();
        if (!searchPool.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [
    mouItems,
    selectedCollege,
    periodMode,
    selectedQuarter,
    selectedMonthNum,
    selectedYear,
    tableSearchTerm,
  ]);

  // Aggregate KPI summary metrics for the active filtered selection
  const summary = useMemo(() => {
    let totalTcv = 0;
    let totalTcvGst = 0;
    let totalStudents = 0;
    const uniqueColleges = new Set<string>();

    filteredItems.forEach((item) => {
      totalTcv += item.totalContractValue || 0;
      totalTcvGst +=
        item.totalContractValueGst ||
        (item.totalContractValue ? Math.round(item.totalContractValue * 1.18) : 0);
      totalStudents += item.studentCount || 0;
      if (item.collegeName) uniqueColleges.add(item.collegeName.trim());
    });

    const gstDiff = Math.max(0, totalTcvGst - totalTcv);

    return {
      totalTcv,
      totalTcvGst,
      gstDiff,
      totalStudents,
      collegeCount: uniqueColleges.size,
      mouCount: filteredItems.length,
    };
  }, [filteredItems]);

  // Period label display text
  const currentPeriodLabel = useMemo(() => {
    if (periodMode === "all") return `Full Year ${selectedYear}-${(selectedYear + 1) % 100}`;
    if (periodMode === "quarter") {
      const qMeta = ALL_QUARTERS.find((q) => q.key === selectedQuarter);
      return `${selectedQuarter} (${qMeta?.rangeText || ""}) ${selectedYear}`;
    }
    if (periodMode === "month") {
      if (selectedMonthNum === null) return `All Months of ${selectedYear}`;
      const mMeta = CALENDAR_MONTHS.find((m) => m.num === selectedMonthNum);
      return `${mMeta?.name || "Month"} ${selectedYear}`;
    }
    return `Full Year ${selectedYear}`;
  }, [periodMode, selectedQuarter, selectedMonthNum, selectedYear]);

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      "#",
      "Contract Type",
      "College Name",
      "Project Code",
      "MOU Signed Date",
      "Date & Month (Col AR)",
      "Academic Year",
      "No of Students",
      "Cost Per Student (INR)",
      "Total Contract Value (INR) [Col R]",
      "Total Contract Value with GST (INR) [Col S]",
      "Payment Type",
      "Course/Stream",
      "Domain of Training",
    ];

    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      `"${item.contractType || "New"}"`,
      `"${item.collegeName || "Missing data"}"`,
      `"${item.projectCode || "Missing data"}"`,
      `"${item.mouSignedDate || ""}"`,
      `"${item.month || "Missing data"}"`,
      `"${item.academicYear || "26-27"}"`,
      item.studentCount || 0,
      item.costPerStudent || 0,
      item.totalContractValue || 0,
      item.totalContractValueGst || 0,
      `"${item.paymentType || ""}"`,
      `"${item.courseStream || ""}"`,
      `"${item.domainOfTraining || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `TCV_MOUs_26_27_Report_${currentPeriodLabel.replace(/[^a-zA-Z0-9]/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="outstanding-page-container tcv-page-container">
      {/* Top Header Banner & Breadcrumbs */}
      <div className="outstanding-header-card tcv-header-card">
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
              onClick={onBackToDashboard}
              style={{ cursor: "pointer" }}
            >
              Dashboard
            </span>
            <ChevronRight size={14} className="crumb-separator" />
            <span className="crumb-item">TCV (Total Contract Value)</span>
            <ChevronRight size={14} className="crumb-separator" />
            <span className="crumb-active">MOUs 26-27</span>
          </div>
        </div>

        <div className="outstanding-title-banner-row">
          <div className="outstanding-title-group">
            <div className="outstanding-title-icon-box tcv-badge-icon-box">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h1 className="outstanding-page-main-title">
                Total Contract Value (TCV) Explorer
              </h1>
              <p className="outstanding-page-sub-title">
                Sourced from <strong>MOUs 26-27</strong> sheet • Total Contract Value (Col R), Total with GST (Col S), Date & Month (Col AR)
              </p>
            </div>
          </div>

          <div className="outstanding-header-actions-row">
            {onRefreshData && (
              <button
                type="button"
                className={`outstanding-refresh-btn ${isLocalRefreshing ? "spinning" : ""}`}
                onClick={handleRefreshClick}
                disabled={isLocalRefreshing}
                title="Sync latest data from MOUs 26-27 sheet"
              >
                <RefreshCw size={15} />
                <span>{isLocalRefreshing ? "Syncing..." : "Sync Sheet"}</span>
              </button>
            )}

            <button
              type="button"
              className="outstanding-export-btn"
              onClick={handleExportCSV}
              title="Export filtered records to CSV"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS PANEL: 1st Select College, 2nd Select Month/Quarter */}
      <div className="tcv-filters-card">
        <div className="tcv-filters-layout-grid">
          {/* OPTION 1: SELECT COLLEGE */}
          <div className="tcv-filter-group college-filter-group" ref={collegeDropdownRef}>
            <label className="tcv-filter-label">
              <Building2 size={16} className="filter-label-icon" />
              <span>1. Select College</span>
              {selectedCollege !== "all" && (
                <span className="active-filter-badge">Active</span>
              )}
            </label>

            <div className="tcv-custom-select-wrap">
              <button
                type="button"
                className={`tcv-select-trigger-btn ${isCollegeDropdownOpen ? "active" : ""}`}
                onClick={() => setIsCollegeDropdownOpen(!isCollegeDropdownOpen)}
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
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  <div className="tcv-dropdown-options-list">
                    <div
                      className={`tcv-dropdown-option ${selectedCollege === "all" ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedCollege("all");
                        setIsCollegeDropdownOpen(false);
                      }}
                    >
                      <div className="option-name-row">
                        <span className="option-name font-semibold">
                          All Colleges
                        </span>
                        <span className="option-meta-badge">
                          {collegeOptions.length} colleges
                        </span>
                      </div>
                      {selectedCollege === "all" && (
                        <Check size={16} className="check-mark-icon" />
                      )}
                    </div>

                    {filteredCollegeOptions.map((c) => (
                      <div
                        key={c.name}
                        className={`tcv-dropdown-option ${selectedCollege === c.name ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedCollege(c.name);
                          setIsCollegeDropdownOpen(false);
                        }}
                      >
                        <div className="option-name-row">
                          <span className="option-name">{c.name}</span>
                          <span className="option-val-tag">
                            {c.count} MOU{c.count > 1 ? "s" : ""} • {formatINR(c.tcv)}
                          </span>
                        </div>
                        {selectedCollege === c.name && (
                          <Check size={16} className="check-mark-icon" />
                        )}
                      </div>
                    ))}

                    {filteredCollegeOptions.length === 0 && (
                      <div className="tcv-dropdown-empty">
                        No college matching "{collegeSearchTerm}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* OPTION 2: SELECT MONTHS OR QUARTER */}
          <div className="tcv-filter-group period-filter-group">
            <div className="tcv-period-header-bar">
              <label className="tcv-filter-label" style={{ marginBottom: 0 }}>
                <Calendar size={16} className="filter-label-icon" />
                <span>2. Select Period</span>
                <span className="period-active-label">{currentPeriodLabel}</span>
              </label>

              {/* Horizontal Year Switcher with ‹ side button › and quick pills */}
              <div className="tcv-year-switcher-bar">
                <button
                  type="button"
                  className="year-nav-arrow"
                  onClick={() => setSelectedYear((prev) => prev - 1)}
                  title="Previous Year"
                >
                  <ChevronLeft size={16} />
                </button>

                {[2025, 2026, 2027, 2028].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    className={`year-toggle-pill ${selectedYear === yr ? "active" : ""}`}
                    onClick={() => setSelectedYear(yr)}
                  >
                    {yr}
                  </button>
                ))}

                <button
                  type="button"
                  className="year-nav-arrow"
                  onClick={() => setSelectedYear((prev) => prev + 1)}
                  title="Next Year"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Row 1: Full Year & Quarters */}
            <div className="tcv-simple-period-row">
              <button
                type="button"
                className={`simple-period-pill all-pill ${periodMode === "all" ? "active" : ""}`}
                onClick={() => {
                  setPeriodMode("all");
                  setSelectedMonthNum(null);
                }}
              >
                All Months / Full Year
              </button>

              <div className="period-pill-separator" />

              {ALL_QUARTERS.map((q) => {
                const isSelected = periodMode === "quarter" && selectedQuarter === q.key;
                return (
                  <button
                    key={q.key}
                    type="button"
                    className={`simple-period-pill quarter-pill ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      setPeriodMode("quarter");
                      setSelectedQuarter(q.key);
                      setSelectedMonthNum(null);
                    }}
                  >
                    <span className="q-tag">{q.key}</span>
                    <span className="q-months">({q.rangeText})</span>
                  </button>
                );
              })}
            </div>

            {/* Row 2: Streamlined 12-Month Pills */}
            <div className="tcv-simple-months-row">
              {CALENDAR_MONTHS.map((m) => {
                const isSelected = periodMode === "month" && selectedMonthNum === m.num;

                return (
                  <button
                    key={m.num}
                    type="button"
                    className={`simple-month-pill ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      setPeriodMode("month");
                      setSelectedMonthNum(m.num);
                    }}
                    title={`${m.name} ${selectedYear}`}
                  >
                    <span className="month-name-text">{m.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active Selection Summary Bar */}
        <div className="tcv-active-filters-summary-bar">
          <div className="active-filter-summary-item">
            <span className="summary-label">Selected College:</span>
            <strong className="summary-val">
              {selectedCollege === "all" ? "All Colleges" : selectedCollege}
            </strong>
          </div>
          <div className="active-filter-summary-item">
            <span className="summary-label">Selected Period:</span>
            <strong className="summary-val">{currentPeriodLabel}</strong>
          </div>
          {(selectedCollege !== "all" || periodMode !== "all") && (
            <button
              type="button"
              className="tcv-reset-filters-btn"
              onClick={() => {
                setSelectedCollege("all");
                setPeriodMode("all");
                setTableSearchTerm("");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* KPI METRIC CARDS (TOTAL CONTRACT VALUE & GST SUMMARY) */}
      <div className="outstanding-kpis-grid tcv-kpis-grid">
        {/* Card 1: Total Contract Value (Col R) */}
        <div className="kpi-card total-kpi-card">
          <div className="kpi-card-inner">
            <div className="kpi-header-row">
              <span className="kpi-title">Total Contract Value (₹)</span>
              <span className="kpi-badge-icon total-badge-icon">
                <Coins size={18} />
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-amount">{formatINR(summary.totalTcv)}</span>
            </div>
            <div className="kpi-footer-row">
              <span className="kpi-count-text">
                Base Revenue Sourced from <strong>Column R</strong>
              </span>
              <span className="kpi-period-tag">{currentPeriodLabel}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Contract Value Incl GST (Col S) */}
        <div className="kpi-card received-kpi-card">
          <div className="kpi-card-inner">
            <div className="kpi-header-row">
              <span className="kpi-title">Total Contract Value (Incl GST) (₹)</span>
              <span className="kpi-badge-icon received-badge-icon">
                <Sparkles size={18} />
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-amount">{formatINR(summary.totalTcvGst)}</span>
            </div>
            <div className="kpi-footer-row">
              <span className="kpi-count-text">
                Gross with 18% GST Sourced from <strong>Column S</strong>
              </span>
              <span className="kpi-pct-tag" style={{ color: "#16a34a", background: "#dcfce7" }}>
                18% GST
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Total GST Difference */}
        <div className="kpi-card pending-kpi-card">
          <div className="kpi-card-inner">
            <div className="kpi-header-row">
              <span className="kpi-title">GST Component Amount (₹)</span>
              <span className="kpi-badge-icon pending-badge-icon">
                <FileSpreadsheet size={18} />
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-amount">{formatINR(summary.gstDiff)}</span>
            </div>
            <div className="kpi-footer-row">
              <span className="kpi-count-text">
                Calculated difference (<strong>Col S - Col R</strong>)
              </span>
              <span className="kpi-period-tag">Tax Component</span>
            </div>
          </div>
        </div>

        {/* Card 4: Colleges & MOUs in Scope */}
        <div className="kpi-card collection-kpi-card">
          <div className="kpi-card-inner">
            <div className="kpi-header-row">
              <span className="kpi-title">Colleges & MOUs in Scope</span>
              <span className="kpi-badge-icon collection-badge-icon">
                <Building2 size={18} />
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-amount">{summary.mouCount} MOUs</span>
            </div>
            <div className="kpi-footer-row">
              <span className="kpi-count-text">
                Across <strong>{summary.collegeCount}</strong> unique colleges
              </span>
              <span className="kpi-period-tag">{summary.totalStudents.toLocaleString("en-IN")} Students</span>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED TCV TABLE SECTION */}
      <div className="outstanding-table-section tcv-table-section">
        {/* Table Toolbar */}
        <div className="table-controls-bar">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search college, project code, or stream..."
              className="table-search-input"
              value={tableSearchTerm}
              onChange={(e) => setTableSearchTerm(e.target.value)}
            />
            {tableSearchTerm && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setTableSearchTerm("")}
              >
                &times;
              </button>
            )}
          </div>

          <div className="tcv-record-counter-badge">
            Showing <strong>{filteredItems.length}</strong> of{" "}
            <strong>{mouItems.length}</strong> records from MOUs 26-27
          </div>
        </div>

        {/* Synchronized Top Horizontal Scrollbar */}
        <div
          className="table-top-scrollbar-wrap"
          ref={topScrollRef}
          onScroll={handleTopScroll}
          title="Slide horizontally to view all columns"
        >
          <div
            style={{ width: `${Math.max(tableScrollWidth, 1)}px`, height: "1px" }}
          />
        </div>

        {/* Data Table */}
        <div
          className="outstanding-table-scroll-wrap"
          ref={tableScrollRef}
          onScroll={handleTableScroll}
        >
          {filteredItems.length === 0 ? (
            <div className="empty-invoices-box">
              <FileSpreadsheet size={40} className="empty-icon" />
              <h3>No MOU Records Found</h3>
              <p>
                There are no records matching the selected College or Period.
                Try adjusting your filters above.
              </p>
            </div>
          ) : (
            <table className="outstanding-data-table tcv-data-table" ref={tableRef}>
              <thead>
                <tr>
                  <th style={{ width: "45px" }}>#</th>
                  <th>College Name & Project Code</th>
                  <th>Date & Month (Col AR)</th>
                  <th className="text-center th-highlight-students">
                    Students & Rate
                  </th>
                  <th className="text-right th-highlight-tcv">
                    Total Contract Value (₹) [Col R]
                  </th>
                  <th className="text-right">Total with GST (₹) [Col S]</th>
                  <th className="text-right">GST Amount (₹)</th>
                  <th className="text-center">Contract & Stream</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const isMissingCollege = !item.collegeName || item.collegeName.trim() === "";
                  const isMissingProjectCode = !item.projectCode || item.projectCode.trim() === "";
                  const isMissingTcv = !item.totalContractValue && item.totalContractValue !== 0;
                  const isMissingTcvGst = !item.totalContractValueGst && item.totalContractValueGst !== 0;
                  const isMissingMonth = !item.month || item.month.trim() === "";

                  const gstVal = Math.max(
                    0,
                    (item.totalContractValueGst || 0) - (item.totalContractValue || 0)
                  );

                  return (
                    <tr key={item.id} className="tcv-data-row">
                      <td className="text-muted font-mono">{idx + 1}</td>
                      <td>
                        <div className="college-info-cell">
                          <span className="college-main-name">
                            {isMissingCollege ? (
                              <span className="missing-data-text">Missing data</span>
                            ) : (
                              item.collegeName
                            )}
                          </span>
                          <span className="project-code-sub">
                            {isMissingProjectCode ? (
                              <span className="missing-data-text">Missing data</span>
                            ) : (
                              item.projectCode
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="tcv-date-cell">
                          {isMissingMonth ? (
                            <span className="missing-data-text">Missing data</span>
                          ) : (
                            <span className="tcv-month-tag">
                              📅 {item.month}
                            </span>
                          )}
                          {item.mouSignedDate && (
                            <span className="tcv-mou-signed-sub">
                              MOU: {item.mouSignedDate}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center td-highlight-students">
                        <div className="tcv-students-cell">
                          {item.studentCount > 0 ? (
                            <>
                              <span className="students-count-badge highlighted">
                                {item.studentCount} Students
                              </span>
                              {item.costPerStudent > 0 && (
                                <span className="rate-sub highlighted">
                                  @{formatINR(item.costPerStudent)}/student
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="missing-data-text">Missing data</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right font-semibold td-highlight-tcv">
                        {isMissingTcv ? (
                          <span className="missing-data-text">Missing data</span>
                        ) : (
                          <span className="tcv-base-amount highlighted">
                            {formatINR(item.totalContractValue)}
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        {isMissingTcvGst ? (
                          <span className="badge-pill missing-badge">Missing data</span>
                        ) : (
                          <span className="badge-pill green-badge font-semibold">
                            {formatINR(item.totalContractValueGst)}
                          </span>
                        )}
                      </td>
                      <td className="text-right text-muted font-mono">
                        {gstVal > 0 ? formatINR(gstVal) : "₹0"}
                      </td>
                      <td className="text-center">
                        <div className="tcv-stream-cell">
                          <span
                            className={`tcv-contract-type-pill ${
                              item.contractType.toLowerCase().includes("renew")
                                ? "renewal-pill"
                                : "new-pill"
                            }`}
                          >
                            {item.contractType || "New"}
                          </span>
                          {item.courseStream && (
                            <span className="tcv-stream-sub">
                              {item.courseStream} • {item.academicYear || "26-27"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
