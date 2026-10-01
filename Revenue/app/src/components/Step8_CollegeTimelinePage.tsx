import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Building2,
  Search,
  PlusCircle,
  BarChart3,
  CheckCircle2,
  CalendarRange,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Edit3,
  Trash2,
  ExternalLink,
  ChevronRight,
  Filter,
  Sparkles,
  Info,
  CalendarDays,
  Check,
  X,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  ChevronLeft,
  Crosshair,
  Grid,
} from "lucide-react";
import type { Project } from "../lib/models";
import type { GoogleSheetCollegeItem } from "../lib/googleSheetsService";
import {
  getAllEnrichedTimelines,
  saveCollegeTimelineRecord,
  removeSavedTimeline,
  computeTimelineStatus,
  formatDisplayDate,
  normalizeDateStr,
  generateDayGridData,
  getTimelineBarTheme,
  formatTimelinePopupDate,
  type EnrichedTimelineItem,
  type TimelineStatus,
  type TimelineDayColumn,
  type TimelineMonthGroup,
} from "../lib/collegeTimelineService";

interface Step8CollegeTimelinePageProps {
  projects: Project[];
  googleSheetColleges: GoogleSheetCollegeItem[];
  onBackToDashboard: () => void;
  onOpenGoogleSheetSync?: () => void;
  onSaveCollegeTimeline?: (record: {
    project_code: string;
    college_name: string;
    start_date: string;
    end_date: string;
  }) => void;
}

export const Step8_CollegeTimelinePage: React.FC<Step8CollegeTimelinePageProps> = ({
  projects,
  googleSheetColleges,
  onBackToDashboard,
  onOpenGoogleSheetSync,
  onSaveCollegeTimeline,
}) => {
  // Navigation Tabs: 'add' (Add / Register Form) | 'view' (Timeline Graph)
  const [activeTab, setActiveTab] = useState<"add" | "view">("add");

  // Filter and Search States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TimelineStatus>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Spreadsheet Grid Display Settings (2-Tier Year -> Month Filter)
  const [selectedYear, setSelectedYear] = useState<number | "all">(2026);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");
  const [dayCellWidth, setDayCellWidth] = useState<number>(34); // px per day column (26 compact, 34 standard, 46 wide)

  // Floating Popover Card on Bar Hover / Click
  const [hoveredItem, setHoveredItem] = useState<{
    item: EnrichedTimelineItem;
    x: number;
    y: number;
  } | null>(null);
  const [pinnedItem, setPinnedItem] = useState<EnrichedTimelineItem | null>(null);

  // Add / Edit Form State (Core Fields: Project Code, College Name, Start Date, End Date)
  const [formData, setFormData] = useState({
    id: "",
    project_code: "",
    college_name: "",
    start_date: "",
    end_date: "",
  });

  const [formSuccessMsg, setFormSuccessMsg] = useState<string | null>(null);
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [collegeSearchPicker, setCollegeSearchPicker] = useState("");
  const [isCollegePickerOpen, setIsCollegePickerOpen] = useState(false);
  const collegePickerRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Local state trigger to refresh lists after adds/deletes
  const [refreshKey, setRefreshKey] = useState(0);

  // Close college picker dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        collegePickerRef.current &&
        !collegePickerRef.current.contains(event.target as Node)
      ) {
        setIsCollegePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute all enriched college timeline records
  const allTimelines = useMemo(() => {
    return getAllEnrichedTimelines(projects, googleSheetColleges);
  }, [projects, googleSheetColleges, refreshKey]);

  // List of all 12 calendar months
  const MONTHS_LIST = useMemo(
    () => [
      { num: 1, shortName: "Jan", fullName: "January" },
      { num: 2, shortName: "Feb", fullName: "February" },
      { num: 3, shortName: "Mar", fullName: "March" },
      { num: 4, shortName: "Apr", fullName: "April" },
      { num: 5, shortName: "May", fullName: "May" },
      { num: 6, shortName: "Jun", fullName: "June" },
      { num: 7, shortName: "Jul", fullName: "July" },
      { num: 8, shortName: "Aug", fullName: "August" },
      { num: 9, shortName: "Sep", fullName: "September" },
      { num: 10, shortName: "Oct", fullName: "October" },
      { num: 11, shortName: "Nov", fullName: "November" },
      { num: 12, shortName: "Dec", fullName: "December" },
    ],
    []
  );

  // Compute unique years present across all college schedules
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    allTimelines.forEach((t) => {
      if (t.start_date) {
        const y = parseInt(t.start_date.slice(0, 4), 10);
        if (!isNaN(y) && y >= 2020 && y <= 2035) yearsSet.add(y);
      }
      if (t.end_date) {
        const y = parseInt(t.end_date.slice(0, 4), 10);
        if (!isNaN(y) && y >= 2020 && y <= 2035) yearsSet.add(y);
      }
    });

    const curYr = new Date().getFullYear();
    yearsSet.add(curYr);

    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [allTimelines]);

  // Helper to test if a timeline item overlaps a given year and month
  const isItemInPeriod = (
    item: EnrichedTimelineItem,
    year: number | "all",
    month: number | "all"
  ) => {
    const s = normalizeDateStr(item.start_date);
    const e = normalizeDateStr(item.end_date);

    // If Training Start Date or Training End Date is missing, do NOT predict anything
    if (!s || !e) {
      // Incomplete data items only match when viewing "All Years" and "All Months"
      return year === "all" && month === "all";
    }

    if (year === "all" && month === "all") return true;

    if (year !== "all" && month === "all") {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      return !(e < yearStart || s > yearEnd);
    }

    if (year !== "all" && month !== "all") {
      const mStr = String(month).padStart(2, "0");
      const lastDay = new Date(year, month, 0).getDate();
      const monthStart = `${year}-${mStr}-01`;
      const monthEnd = `${year}-${mStr}-${String(lastDay).padStart(2, "0")}`;
      return !(e < monthStart || s > monthEnd);
    }

    if (year === "all" && month !== "all") {
      const mStr = String(month).padStart(2, "0");
      return availableYears.some((yr) => {
        const lastDay = new Date(yr, month, 0).getDate();
        const monthStart = `${yr}-${mStr}-01`;
        const monthEnd = `${yr}-${mStr}-${String(lastDay).padStart(2, "0")}`;
        return !(e < monthStart || s > monthEnd);
      });
    }

    return true;
  };

  // Precomputed counts of college schedules per year
  const yearCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allTimelines.length };
    availableYears.forEach((yr) => {
      counts[yr] = allTimelines.filter((t) => isItemInPeriod(t, yr, "all")).length;
    });
    return counts;
  }, [allTimelines, availableYears]);

  // Precomputed counts of college schedules per month for current selectedYear
  const monthCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      counts[m] = allTimelines.filter((t) => isItemInPeriod(t, selectedYear, m)).length;
    }
    return counts;
  }, [allTimelines, selectedYear, availableYears]);

  // Filtered timeline items based on search, status, and 2-tier Year -> Month selection
  const filteredTimelines = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return allTimelines.filter((item) => {
      // 1. Search term match (College name, Project code, Course stream)
      if (term) {
        const matchName = item.college_name.toLowerCase().includes(term);
        const matchCode = item.project_code.toLowerCase().includes(term);
        const matchStream = (item.course_stream || "").toLowerCase().includes(term);
        const matchNotes = (item.notes || "").toLowerCase().includes(term);
        if (!matchName && !matchCode && !matchStream && !matchNotes) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== "all") {
        if (item.status !== statusFilter) {
          return false;
        }
      }

      // 3. Year & Month Period Filter (Applied when not performing an explicit text search)
      if (!term) {
        if (!isItemInPeriod(item, selectedYear, selectedMonth)) {
          return false;
        }
      }

      return true;
    });
  }, [allTimelines, searchTerm, statusFilter, selectedYear, selectedMonth, availableYears]);

  // Overall KPI statistics
  const stats = useMemo(() => {
    const total = allTimelines.length;
    const active = allTimelines.filter((t) => t.status === "Active").length;
    const upcoming = allTimelines.filter((t) => t.status === "Upcoming").length;
    const completed = allTimelines.filter((t) => t.status === "Completed").length;
    const incomplete = allTimelines.filter((t) => t.status === "Incomplete Data").length;
    const withDates = allTimelines.filter((t) => t.start_date && t.end_date).length;

    return { total, active, upcoming, completed, incomplete, withDates };
  }, [allTimelines]);

  // Determine active date bounds from all timelines to build day-by-day grid
  const dateBounds = useMemo(() => {
    let minYear = 2026;
    let minMonth = 7; // Aug (0-indexed)
    let maxYear = 2026;
    let maxMonth = 9; // Oct (0-indexed)

    const validDates: Date[] = [];
    allTimelines.forEach((t) => {
      if (t.start_date) {
        const [y, m] = t.start_date.split("-").map(Number);
        if (!isNaN(y) && !isNaN(m)) validDates.push(new Date(y, m - 1, 1));
      }
      if (t.end_date) {
        const [y, m] = t.end_date.split("-").map(Number);
        if (!isNaN(y) && !isNaN(m)) validDates.push(new Date(y, m - 1, 1));
      }
    });

    if (validDates.length > 0) {
      validDates.sort((a, b) => a.getTime() - b.getTime());
      const first = validDates[0];
      const last = validDates[validDates.length - 1];

      minYear = first.getFullYear();
      minMonth = Math.max(0, first.getMonth() - 1); // 1 month buffer before
      maxYear = last.getFullYear();
      maxMonth = Math.min(11, last.getMonth() + 1); // 1 month buffer after
    }

    return { minYear, minMonth, maxYear, maxMonth };
  }, [allTimelines]);

  // Generate Day-by-Day Grid Data based on Selected Year & Month
  const gridData = useMemo(() => {
    if (selectedYear === "all") {
      if (selectedMonth === "all") {
        return generateDayGridData(
          dateBounds.minYear,
          dateBounds.minMonth,
          dateBounds.maxYear,
          dateBounds.maxMonth
        );
      } else {
        return generateDayGridData(
          dateBounds.minYear,
          selectedMonth - 1,
          dateBounds.maxYear,
          selectedMonth - 1
        );
      }
    }

    // Specific Year
    if (selectedMonth === "all") {
      // Full 12 months for this year
      return generateDayGridData(selectedYear, 0, selectedYear, 11);
    } else {
      // Single month for this year
      return generateDayGridData(
        selectedYear,
        selectedMonth - 1,
        selectedYear,
        selectedMonth - 1
      );
    }
  }, [selectedYear, selectedMonth, dateBounds]);

  // Helper to find starting and ending day column index for a college item in current grid
  const getCollegeDayRange = (startDateStr?: string, endDateStr?: string) => {
    if (!startDateStr || !endDateStr) return null;
    if (gridData.days.length === 0) return null;

    const normStart = normalizeDateStr(startDateStr);
    const normEnd = normalizeDateStr(endDateStr);

    if (!normStart || !normEnd) return null;

    const firstGridDate = gridData.days[0].dateStr;
    const lastGridDate = gridData.days[gridData.days.length - 1].dateStr;

    // Check if fully outside grid
    if (normEnd < firstGridDate || normStart > lastGridDate) {
      return null;
    }

    const startsBeforeGrid = normStart < firstGridDate;
    const endsAfterGrid = normEnd > lastGridDate;

    // Find column index of start date (or clamp to 0 if started before current view)
    let startCol = 0;
    if (!startsBeforeGrid) {
      const exactIdx = gridData.days.findIndex((d) => d.dateStr === normStart);
      if (exactIdx !== -1) {
        startCol = exactIdx;
      } else {
        const nextIdx = gridData.days.findIndex((d) => d.dateStr >= normStart);
        startCol = nextIdx !== -1 ? nextIdx : 0;
      }
    }

    // Find column index of end date (or clamp to last column if continues past current view)
    let endCol = gridData.days.length - 1;
    if (!endsAfterGrid) {
      let idx = -1;
      for (let i = gridData.days.length - 1; i >= 0; i--) {
        if (gridData.days[i].dateStr <= normEnd) {
          idx = i;
          break;
        }
      }
      endCol = idx !== -1 ? idx : gridData.days.length - 1;
    }

    return {
      startCol,
      endCol,
      span: Math.max(1, endCol - startCol + 1),
      startsBeforeGrid,
      endsAfterGrid,
      actualStartDate: normStart,
      actualEndDate: normEnd,
    };
  };

  // Scroll to Today Column in Grid
  const handleJumpToToday = () => {
    const now = new Date();
    const currentYr = now.getFullYear();
    const currentMo = now.getMonth() + 1;

    // Switch to current year & month if not already visible
    if (selectedYear !== currentYr) {
      setSelectedYear(currentYr);
    }
    if (selectedMonth !== "all" && selectedMonth !== currentMo) {
      setSelectedMonth(currentMo);
    }

    setTimeout(() => {
      if (!gridScrollRef.current) return;
      if (gridData.todayColIndex !== null) {
        const scrollPos = Math.max(0, gridData.todayColIndex * dayCellWidth - 250);
        gridScrollRef.current.scrollTo({
          left: scrollPos,
          behavior: "smooth",
        });
      }
    }, 120);
  };

  // Live calculation of duration and status in Add Form
  const formStatusPreview = useMemo(() => {
    if (!formData.start_date && !formData.end_date) return null;
    return computeTimelineStatus(formData.start_date, formData.end_date);
  }, [formData.start_date, formData.end_date]);

  // Handle college selection from autocomplete
  const handleSelectExistingCollege = (item: {
    name: string;
    code: string;
    academicYear?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      college_name: item.name,
      project_code: item.code,
      start_date: item.startDate || prev.start_date,
      end_date: item.endDate || prev.end_date,
    }));
    setIsCollegePickerOpen(false);
    setCollegeSearchPicker("");
  };

  // Handle Form Submit (Add or Update)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMsg(null);
    setFormSuccessMsg(null);

    const projCode = formData.project_code.trim();
    const collegeName = formData.college_name.trim();
    const startDate = formData.start_date.trim();
    const endDate = formData.end_date.trim();

    if (!projCode && !collegeName) {
      setFormErrorMsg("Please provide at least a Project Code or College Name.");
      return;
    }

    if (!startDate) {
      setFormErrorMsg("Please select a Start Date.");
      return;
    }

    if (startDate && endDate) {
      const s = new Date(startDate).getTime();
      const eTime = new Date(endDate).getTime();
      if (s > eTime) {
        setFormErrorMsg("Start Date cannot be later than End Date.");
        return;
      }
    }

    // Save to local storage
    saveCollegeTimelineRecord({
      project_code: projCode,
      college_name: collegeName,
      start_date: startDate,
      end_date: endDate,
    });

    if (onSaveCollegeTimeline) {
      onSaveCollegeTimeline({
        project_code: projCode,
        college_name: collegeName,
        start_date: startDate,
        end_date: endDate,
      });
    }

    setRefreshKey((prev) => prev + 1);
    setFormSuccessMsg(
      `Timeline successfully saved for "${collegeName || projCode}"!`
    );

    if (isEditingExisting) {
      setTimeout(() => {
        setActiveTab("view");
        setIsEditingExisting(false);
      }, 1000);
    } else {
      // Clear form
      setFormData({
        id: "",
        project_code: "",
        college_name: "",
        start_date: "",
        end_date: "",
      });
    }
  };

  // Quick edit a college timeline item
  const handleEditItem = (item: EnrichedTimelineItem) => {
    setFormData({
      id: item.id,
      project_code: item.project_code,
      college_name: item.college_name,
      start_date: normalizeDateStr(item.start_date),
      end_date: normalizeDateStr(item.end_date),
    });
    setIsEditingExisting(true);
    setActiveTab("add");
    setFormErrorMsg(null);
    setFormSuccessMsg(null);
    setHoveredItem(null);
    setPinnedItem(null);
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  // Delete a saved timeline record
  const handleDeleteItem = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove the timeline schedule for "${name}"?`)) {
      removeSavedTimeline(id);
      setRefreshKey((prev) => prev + 1);
      setHoveredItem(null);
      setPinnedItem(null);
    }
  };

  // List of unique Sheet1 colleges for auto-complete
  const sheet1CollegeOptions = useMemo(() => {
    const list: {
      name: string;
      code: string;
      academicYear?: string;
      students?: number;
      startDate?: string;
      endDate?: string;
    }[] = [];
    const seen = new Set<string>();

    googleSheetColleges.forEach((g) => {
      const code = g.project_code || "";
      const name = g.college_name || "";
      const key = `${code}-${name}`.toLowerCase();
      if (!seen.has(key) && (name || code)) {
        seen.add(key);
        list.push({
          name,
          code,
          academicYear: g.academic_year,
          students: g.student_count,
          startDate: normalizeDateStr(g.training_start_date),
          endDate: normalizeDateStr(g.training_end_date),
        });
      }
    });

    projects.forEach((p) => {
      const code = p.project_code || "";
      const name = p.college_name || "";
      const key = `${code}-${name}`.toLowerCase();
      if (!seen.has(key) && (name || code)) {
        seen.add(key);
        list.push({
          name,
          code,
          academicYear: p.academic_year,
          students: p.student_count,
        });
      }
    });

    return list;
  }, [googleSheetColleges, projects]);

  const filteredAutocompleteColleges = useMemo(() => {
    if (!collegeSearchPicker.trim()) return sheet1CollegeOptions.slice(0, 10);
    const q = collegeSearchPicker.toLowerCase();
    return sheet1CollegeOptions
      .filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 12);
  }, [sheet1CollegeOptions, collegeSearchPicker]);

  return (
    <div className="timeline-page-container">
      {/* Top Header Card */}
      <div className="timeline-hero-banner">
        <div className="timeline-hero-title-row">
          <div className="timeline-hero-icon-box">
            <CalendarDays size={28} />
          </div>
          <div className="timeline-hero-text">
            <h1 className="timeline-main-title">Active College Timeline & Schedule</h1>
          </div>

          <div className="timeline-hero-actions">
            {onOpenGoogleSheetSync && (
              <button
                type="button"
                className="timeline-sync-btn"
                onClick={onOpenGoogleSheetSync}
                title="Sync latest dates with Google Sheet 1"
              >
                <FileSpreadsheet size={15} />
                <span>Sync Sheet</span>
              </button>
            )}
          </div>
        </div>

        {/* 2 Main Tabs Switcher: Add, View */}
        <div className="timeline-main-mode-switcher">
          <button
            type="button"
            className={`mode-tab-btn ${activeTab === "add" ? "active" : ""}`}
            onClick={() => setActiveTab("add")}
          >
            <PlusCircle size={17} />
            <span>{isEditingExisting ? "Edit" : "Add"}</span>
          </button>

          <button
            type="button"
            className={`mode-tab-btn ${activeTab === "view" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("view");
              setIsEditingExisting(false);
            }}
          >
            <BarChart3 size={17} />
            <span>View</span>
            <span className="tab-count-badge">{allTimelines.length}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: VIEW TIMELINE GRAPH (PROJECT TIMELINE SPREADSHEET GRID)
          ========================================================================= */}
      {activeTab === "view" && (
        <div className="timeline-view-section">
          {/* KPI Overview Summary Cards */}
          <div className="timeline-kpi-grid">
            {/* Card 1: Active / Ongoing Colleges */}
            <div className="timeline-kpi-card active-kpi-card">
              <div className="kpi-card-inner">
                <div className="kpi-header-row">
                  <span className="kpi-title">Active / Ongoing Colleges</span>
                  <span className="kpi-badge-icon active-icon">
                    <Clock size={18} />
                  </span>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-amount">{stats.active}</span>
                  <span className="kpi-unit">Colleges</span>
                </div>
                <div className="kpi-footer-row">
                  <span className="kpi-tag live-tag">🟢 In Training Today</span>
                </div>
              </div>
            </div>

            {/* Card 2: Upcoming Schedules */}
            <div className="timeline-kpi-card upcoming-kpi-card">
              <div className="kpi-card-inner">
                <div className="kpi-header-row">
                  <span className="kpi-title">Upcoming Schedules</span>
                  <span className="kpi-badge-icon upcoming-icon">
                    <CalendarRange size={18} />
                  </span>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-amount">{stats.upcoming}</span>
                  <span className="kpi-unit">Colleges</span>
                </div>
                <div className="kpi-footer-row">
                  <span className="kpi-tag upcoming-tag">🔵 Future Start Dates</span>
                </div>
              </div>
            </div>

            {/* Card 3: Completed Schedules */}
            <div className="timeline-kpi-card completed-kpi-card">
              <div className="kpi-card-inner">
                <div className="kpi-header-row">
                  <span className="kpi-title">Completed Colleges</span>
                  <span className="kpi-badge-icon completed-icon">
                    <CheckCircle2 size={18} />
                  </span>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-amount">{stats.completed}</span>
                  <span className="kpi-unit">Colleges</span>
                </div>
                <div className="kpi-footer-row">
                  <span className="kpi-tag completed-tag">⚪ Training Concluded</span>
                </div>
              </div>
            </div>

            {/* Card 4: Total Colleges Tracked */}
            <div className="timeline-kpi-card total-kpi-card">
              <div className="kpi-card-inner">
                <div className="kpi-header-row">
                  <span className="kpi-title">Total Active Schedules</span>
                  <span className="kpi-badge-icon total-icon">
                    <Building2 size={18} />
                  </span>
                </div>
                <div className="kpi-value-row">
                  <span className="kpi-amount">{stats.total}</span>
                  <span className="kpi-unit">Records</span>
                </div>
                <div className="kpi-footer-row">
                  {stats.incomplete > 0 ? (
                    <span className="kpi-tag incomplete-tag">
                      ⚠️ {stats.incomplete} Incomplete Data · {stats.withDates} Complete
                    </span>
                  ) : (
                    <span className="kpi-tag sheet-tag">
                      📊 {stats.withDates} with Start & End Dates
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Controls Bar: Search, Status Filter, Jump to Today, Zoom, View Mode */}
          <div className="timeline-controls-bar">
            {/* Search Input */}
            <div className="timeline-search-box">
              <Search size={15} className="text-muted" />
              <input
                type="text"
                placeholder="Search college name or project code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="timeline-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchTerm("")}
                >
                  &times;
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="status-filter-pills-wrap">
              <button
                type="button"
                className={`status-pill ${statusFilter === "all" ? "active" : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                All ({allTimelines.length})
              </button>
              <button
                type="button"
                className={`status-pill active-pill ${statusFilter === "Active" ? "active" : ""}`}
                onClick={() => setStatusFilter("Active")}
              >
                🟢 Active ({stats.active})
              </button>
              <button
                type="button"
                className={`status-pill upcoming-pill ${statusFilter === "Upcoming" ? "active" : ""}`}
                onClick={() => setStatusFilter("Upcoming")}
              >
                🔵 Upcoming ({stats.upcoming})
              </button>
              <button
                type="button"
                className={`status-pill completed-pill ${statusFilter === "Completed" ? "active" : ""}`}
                onClick={() => setStatusFilter("Completed")}
              >
                ⚪ Completed ({stats.completed})
              </button>
              {stats.incomplete > 0 && (
                <button
                  type="button"
                  className={`status-pill incomplete-pill ${statusFilter === "Incomplete Data" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Incomplete Data")}
                >
                  ⚠️ Incomplete ({stats.incomplete})
                </button>
              )}
            </div>

            {/* Jump to Today Button */}
            <button
              type="button"
              className="jump-today-btn"
              onClick={handleJumpToToday}
              title="Jump directly to Today's date column"
            >
              <Crosshair size={14} />
              <span>Jump to Today</span>
            </button>

            {/* Cell Zoom Controls */}
            <div className="zoom-controls-wrap">
              <button
                type="button"
                className={`zoom-btn ${dayCellWidth === 26 ? "active" : ""}`}
                onClick={() => setDayCellWidth(26)}
                title="Compact Day Width"
              >
                S
              </button>
              <button
                type="button"
                className={`zoom-btn ${dayCellWidth === 34 ? "active" : ""}`}
                onClick={() => setDayCellWidth(34)}
                title="Standard Day Width"
              >
                M
              </button>
              <button
                type="button"
                className={`zoom-btn ${dayCellWidth === 46 ? "active" : ""}`}
                onClick={() => setDayCellWidth(46)}
                title="Expanded Day Width"
              >
                L
              </button>
            </div>

            {/* View Mode Toggle: Grid vs Table */}
            <div className="view-mode-toggle-wrap">
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Project Timeline Spreadsheet Grid (Reference Style)"
              >
                <Grid size={15} />
                <span>Timeline Grid</span>
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Spreadsheet Table View"
              >
                <Layers size={15} />
                <span>Table</span>
              </button>
            </div>
          </div>

          {/* 2-TIER YEAR & MONTH SELECTOR PANEL */}
          <div className="timeline-date-filter-panel">
            {/* TIER 1: YEAR SELECTOR */}
            <div className="filter-tier-row year-tier-row">
              <div className="tier-label-box">
                <Calendar size={14} className="tier-icon" />
                <span className="tier-label">1. Select Year:</span>
              </div>
              <div className="tier-pills-list">
                {availableYears.map((yr) => {
                  const count = yearCounts[yr] || 0;
                  const isSelected = selectedYear === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      className={`year-filter-pill ${isSelected ? "active" : ""}`}
                      onClick={() => setSelectedYear(yr)}
                    >
                      <span className="pill-year-text">{yr}</span>
                      {count > 0 && <span className="pill-badge-count">{count}</span>}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`year-filter-pill ${selectedYear === "all" ? "active" : ""}`}
                  onClick={() => setSelectedYear("all")}
                >
                  <span className="pill-year-text">All Years</span>
                  <span className="pill-badge-count">{allTimelines.length}</span>
                </button>
              </div>
            </div>

            {/* TIER 2: MONTH SELECTOR FOR SELECTED YEAR */}
            <div className="filter-tier-row month-tier-row">
              <div className="tier-label-box">
                <Clock size={14} className="tier-icon" />
                <span className="tier-label">
                  2. Select Month ({selectedYear === "all" ? "All Years" : selectedYear}):
                </span>
              </div>
              <div className="tier-pills-list month-pills-list">
                {/* Full Year Option */}
                <button
                  type="button"
                  className={`month-filter-pill full-year-pill ${selectedMonth === "all" ? "active" : ""}`}
                  onClick={() => setSelectedMonth("all")}
                  title={`View Full Year ${selectedYear === "all" ? "" : selectedYear} (12 Months)`}
                >
                  <span>📅 Full Year (12 Months)</span>
                  <span className="month-badge-count">
                    {selectedYear === "all" ? allTimelines.length : (yearCounts[selectedYear] || 0)}
                  </span>
                </button>

                <div className="tier-divider-bar" />

                {/* 12 Individual Month Pills */}
                {MONTHS_LIST.map((m) => {
                  const count = monthCounts[m.num] || 0;
                  const isSelected = selectedMonth === m.num;
                  return (
                    <button
                      key={m.num}
                      type="button"
                      className={`month-filter-pill ${isSelected ? "active" : ""} ${count > 0 ? "has-data" : "no-data"}`}
                      onClick={() => setSelectedMonth(m.num)}
                      title={`${m.fullName} ${selectedYear === "all" ? "" : selectedYear} · ${count} Colleges`}
                    >
                      <span className="month-short-label">{m.shortName}</span>
                      {count > 0 && <span className="month-count-dot">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Filter Bar */}
          {(searchTerm || statusFilter !== "all" || selectedYear !== 2026 || selectedMonth !== "all") && (
            <div className="active-filters-bar">
              <div className="active-filters-text-group">
                <span>
                  Showing <strong>{filteredTimelines.length}</strong> of {allTimelines.length} college schedules
                </span>
                {selectedYear !== "all" && (
                  <span className="active-filter-badge">Year: {selectedYear}</span>
                )}
                {selectedMonth !== "all" && (
                  <span className="active-filter-badge">
                    Month: {MONTHS_LIST.find((m) => m.num === selectedMonth)?.fullName || selectedMonth}
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="active-filter-badge">Status: {statusFilter}</span>
                )}
              </div>
              <button
                type="button"
                className="reset-filters-chip"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setSelectedYear(2026);
                  setSelectedMonth("all");
                }}
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* SPREADSHEET PROJECT TIMELINE GRID (MATCHING REFERENCE IMAGE) */}
          {viewMode === "grid" && (
            <div className="spreadsheet-timeline-wrapper">
              <div className="spreadsheet-scroll-box" ref={gridScrollRef}>
                <div
                  className="spreadsheet-grid-canvas"
                  style={{
                    minWidth: `${Math.max(1000, gridData.days.length * dayCellWidth + 60)}px`,
                  }}
                >
                  {/* 1. TOP HEADER BANNER: "Project Timeline" */}
                  <div className="spreadsheet-title-banner">
                    <h2>Project Timeline</h2>
                  </div>

                  {/* 2. EXCEL COLUMN LETTERS ROW (A, B, C ... Z, AA, AB ...) */}
                  <div className="spreadsheet-col-letters-row">
                    <div className="row-number-header-cell">#</div>
                    {gridData.days.map((day) => (
                      <div
                        key={day.colIndex}
                        className="col-letter-cell"
                        style={{ width: `${dayCellWidth}px` }}
                      >
                        {day.colLetter}
                      </div>
                    ))}
                  </div>

                  {/* 3. MONTH SPANNING HEADERS ROW (August 2026, September 2026...) */}
                  <div className="spreadsheet-months-row">
                    <div className="row-number-header-cell month-stub" />
                    {gridData.months.map((m) => (
                      <div
                        key={m.monthKey}
                        className="month-group-cell"
                        style={{
                          width: `${m.daysCount * dayCellWidth}px`,
                        }}
                      >
                        {m.monthLabel}
                      </div>
                    ))}
                  </div>

                  {/* 4. DAY NUMBERS ROW (17, 18, 19 ... 23 (Red for Sunday), 24 ...) */}
                  <div className="spreadsheet-days-row">
                    <div className="row-number-header-cell day-stub" />
                    {gridData.days.map((day) => (
                      <div
                        key={day.dateStr}
                        className={`day-number-cell ${day.isSunday ? "sunday-cell" : ""} ${day.isToday ? "today-cell" : ""}`}
                        style={{ width: `${dayCellWidth}px` }}
                        title={`${day.dayOfWeekName}, ${day.dayNum} ${day.monthLabel}`}
                      >
                        {day.dayNum}
                      </div>
                    ))}
                  </div>

                  {/* 5. GRID BODY ROWS WITH TIMELINE BARS */}
                  <div className="spreadsheet-body-matrix">
                    {filteredTimelines.length === 0 ? (
                      <div className="empty-grid-placeholder">
                        <CalendarRange size={36} />
                        <p>No college timeline matches your search criteria.</p>
                        <button
                          type="button"
                          className="add-new-timeline-btn"
                          onClick={() => setActiveTab("add")}
                        >
                          + Add College Timeline
                        </button>
                      </div>
                    ) : (
                      filteredTimelines.map((item, rowIdx) => {
                        const dayRange = getCollegeDayRange(item.start_date, item.end_date);
                        const theme = getTimelineBarTheme(item.college_name || item.project_code);
                        const isPinned = pinnedItem?.id === item.id;
                        const isHovered = hoveredItem?.item.id === item.id;
                        const isIncomplete = item.status === "Incomplete Data" || !item.start_date || !item.end_date;

                        return (
                          <div
                            key={item.id || rowIdx}
                            className={`spreadsheet-row ${isPinned ? "row-pinned" : ""} ${isIncomplete ? "row-incomplete" : ""}`}
                          >
                            {/* Left Row Number (1, 2, 3...) */}
                            <div className="row-index-cell">{rowIdx + 1}</div>

                            {/* Background Day Cells */}
                            <div className="row-cells-track">
                              {gridData.days.map((day) => (
                                <div
                                  key={day.dateStr}
                                  className={`matrix-grid-cell ${day.isSunday ? "sunday-matrix-cell" : ""}`}
                                  style={{ width: `${dayCellWidth}px` }}
                                />
                              ))}

                              {/* Today Vertical Line Marker */}
                              {gridData.todayColIndex !== null && (
                                <div
                                  className="matrix-today-vertical-line"
                                  style={{
                                    left: `${gridData.todayColIndex * dayCellWidth + dayCellWidth / 2}px`,
                                  }}
                                  title={`Today: ${new Date().toLocaleDateString("en-IN")}`}
                                />
                              )}

                              {/* The Colored College Schedule Bar */}
                              {dayRange ? (
                                <div
                                  className={`timeline-block-bar ${isPinned ? "bar-pinned" : ""}`}
                                  style={{
                                    left: `${dayRange.startCol * dayCellWidth + 2}px`,
                                    width: `${dayRange.span * dayCellWidth - 4}px`,
                                    background: theme.bg,
                                    borderColor: theme.borderColor,
                                    boxShadow: isHovered || isPinned ? "0 4px 14px rgba(0,0,0,0.3)" : theme.shadow,
                                  }}
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setHoveredItem({
                                      item,
                                      x: rect.left + rect.width / 2,
                                      y: rect.bottom + 8,
                                    });
                                  }}
                                  onMouseLeave={() => {
                                    if (!pinnedItem) setHoveredItem(null);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPinnedItem(pinnedItem?.id === item.id ? null : item);
                                  }}
                                >
                                  <div className="bar-inner-text">
                                    <div className="bar-title-row">
                                      {dayRange.startsBeforeGrid && (
                                        <span className="bar-continuation-arrow left-arrow" title={`Started before view on ${formatTimelinePopupDate(item.start_date)}`}>
                                          ◀
                                        </span>
                                      )}
                                      <span className="bar-college-name" title={item.college_name}>
                                        {item.college_name || "College Name"}
                                      </span>
                                      {dayRange.endsAfterGrid && (
                                        <span className="bar-continuation-arrow right-arrow" title={`Continues after view until ${formatTimelinePopupDate(item.end_date)}`}>
                                          ▶
                                        </span>
                                      )}
                                    </div>
                                    <div className="bar-sub-row">
                                      {item.project_code && (
                                        <span className="bar-project-code" title={item.project_code}>
                                          {item.project_code}
                                        </span>
                                      )}
                                      <span className="bar-dates-tag">
                                        {formatTimelinePopupDate(item.start_date)} → {formatTimelinePopupDate(item.end_date)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : isIncomplete ? (
                                <div
                                  className="incomplete-row-placeholder"
                                  onClick={() => setPinnedItem(pinnedItem?.id === item.id ? null : item)}
                                >
                                  <span className="incomplete-badge-tag">
                                    ⚠️ Incomplete Data
                                  </span>
                                  <span className="incomplete-college-title">
                                    {item.college_name || item.project_code}
                                  </span>
                                  <span className="incomplete-missing-desc">
                                    {!item.start_date && !item.end_date
                                      ? "(Dates not set in Sheet1)"
                                      : !item.start_date
                                      ? "(Start Date missing in Sheet1)"
                                      : "(End Date missing in Sheet1)"}
                                  </span>
                                  <button
                                    type="button"
                                    className="incomplete-set-dates-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditItem(item);
                                    }}
                                  >
                                    + Set Dates
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Floating Excel-Style Popover Note Card (Matching Reference Image) */}
              {(hoveredItem || pinnedItem) && (
                (() => {
                  const currentPopupItem = pinnedItem || hoveredItem?.item;
                  if (!currentPopupItem) return null;

                  return (
                    <div className="spreadsheet-floating-popover-card">
                      <div className="popover-card-header">
                        <span className="popover-header-title">COLLEGE SCHEDULE DETAILS</span>
                        <button
                          type="button"
                          className="popover-close-btn"
                          onClick={() => {
                            setPinnedItem(null);
                            setHoveredItem(null);
                          }}
                        >
                          &times;
                        </button>
                      </div>

                      <div className="popover-card-body">
                        <div className="popover-field-row">
                          <span className="popover-label">COLLEGE:</span>
                          <span className="popover-value font-bold">{currentPopupItem.college_name || "N/A"}</span>
                        </div>

                        <div className="popover-field-row">
                          <span className="popover-label">PROJECT CODE:</span>
                          <span className="popover-value font-mono font-bold text-accent">
                            {currentPopupItem.project_code || "N/A"}
                          </span>
                        </div>

                        <div className="popover-field-row">
                          <span className="popover-label">DESCRIPTION:</span>
                          <span className="popover-value">
                            {currentPopupItem.course_stream || currentPopupItem.academic_year || "Training Schedule"}
                          </span>
                        </div>

                        <div className="popover-field-row">
                          <span className="popover-label">ASSIGNED PERSON:</span>
                          <span className="popover-value">MG</span>
                        </div>

                        <div className="popover-field-row">
                          <span className="popover-label">START DATE:</span>
                          <span className={`popover-value font-bold ${currentPopupItem.start_date ? "text-green" : "text-muted italic"}`}>
                            {currentPopupItem.start_date ? formatTimelinePopupDate(currentPopupItem.start_date) : "Not set (Incomplete)"}
                          </span>
                        </div>

                        <div className="popover-field-row">
                          <span className="popover-label">END DATE:</span>
                          <span className={`popover-value font-bold ${currentPopupItem.end_date ? "text-blue" : "text-muted italic"}`}>
                            {currentPopupItem.end_date ? formatTimelinePopupDate(currentPopupItem.end_date) : "Not set (Incomplete)"}
                          </span>
                        </div>

                        <div className="popover-field-row">
                          <span className="popover-label">STATUS:</span>
                          <span className={`popover-status-badge status-${currentPopupItem.status.toLowerCase().replace(/\s+/g, "-")}`}>
                            {currentPopupItem.status === "Incomplete Data"
                              ? "⚠️ Incomplete Data (Missing Dates)"
                              : `${currentPopupItem.status} (${currentPopupItem.durationDays} Days)`}
                          </span>
                        </div>
                      </div>

                      <div className="popover-card-footer">
                        <button
                          type="button"
                          className="popover-edit-btn"
                          onClick={() => handleEditItem(currentPopupItem)}
                        >
                          <Edit3 size={13} />
                          <span>Edit Schedule</span>
                        </button>
                        <button
                          type="button"
                          className="popover-delete-btn"
                          onClick={() => handleDeleteItem(currentPopupItem.id, currentPopupItem.college_name)}
                          title="Delete timeline"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* TABLE VIEW OPTION */}
          {viewMode === "table" && (
            <div className="timeline-table-card">
              <div className="timeline-table-wrap">
                <table className="outstanding-data-table timeline-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45px" }}>#</th>
                      <th>College Name & Project Code</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th className="text-center">Duration</th>
                      <th className="text-center">Status</th>
                      <th className="text-center">Progress</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTimelines.map((item, idx) => (
                      <tr key={item.id || idx} className="timeline-row">
                        <td className="text-muted font-mono">{idx + 1}</td>
                        <td>
                          <div className="table-college-cell">
                            <span className="table-college-name">{item.college_name || "Unnamed"}</span>
                            <span className="table-project-code font-mono">{item.project_code}</span>
                          </div>
                        </td>
                        <td>
                          <span className="date-badge start-badge">
                            {formatDisplayDate(item.start_date)}
                          </span>
                        </td>
                        <td>
                          <span className="date-badge end-badge">
                            {formatDisplayDate(item.end_date)}
                          </span>
                        </td>
                        <td className="text-center font-mono">
                          {item.durationDays > 0 ? `${item.durationDays} Days` : "-"}
                        </td>
                        <td className="text-center">
                          <span
                            className={`status-chip status-${item.status.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {item.status === "Active" && "🟢 "}
                            {item.status === "Upcoming" && "🔵 "}
                            {item.status === "Completed" && "⚪ "}
                            {item.status === "Incomplete Data" && "⚠️ "}
                            {item.status}
                          </span>
                        </td>
                        <td className="text-center">
                          {item.status === "Active" ? (
                            <div className="progress-bar-wrap">
                              <div
                                className="progress-bar-fill"
                                style={{ width: `${item.progressPct}%` }}
                              />
                              <span className="progress-text">{item.progressPct}%</span>
                            </div>
                          ) : (
                            <span className="text-muted text-xs">
                              {item.status === "Completed" ? "100%" : "0%"}
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="table-actions-cell">
                            <button
                              type="button"
                              className="action-btn edit-action-btn"
                              onClick={() => handleEditItem(item)}
                              title="Edit Schedule"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              className="action-btn delete-action-btn"
                              onClick={() => handleDeleteItem(item.id, item.college_name)}
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: ADD / EDIT COLLEGE TIMELINE FORM
          ========================================================================= */}
      {activeTab === "add" && (
        <div className="timeline-add-section">
          <div className="timeline-form-card">
            <div className="form-card-header">
              <div className="form-title-wrap">
                <PlusCircle size={22} className="form-icon" />
                <div>
                  <h2 className="form-title">
                    {isEditingExisting ? "Edit College Timeline Schedule" : "Add Active College Timeline"}
                  </h2>
                  <p className="form-desc">
                    Enter project code, college name, and training start and end dates.
                  </p>
                </div>
              </div>

              {isEditingExisting && (
                <button
                  type="button"
                  className="cancel-edit-btn"
                  onClick={() => {
                    setIsEditingExisting(false);
                    setFormData({
                      id: "",
                      project_code: "",
                      college_name: "",
                      start_date: "",
                      end_date: "",
                    });
                  }}
                >
                  <X size={15} />
                  <span>Cancel Edit</span>
                </button>
              )}
            </div>

            {/* Success & Error alerts */}
            {formSuccessMsg && (
              <div className="form-alert-banner alert-success">
                <CheckCircle2 size={18} />
                <span>{formSuccessMsg}</span>
                <button
                  type="button"
                  className="alert-close-btn"
                  onClick={() => setFormSuccessMsg(null)}
                >
                  &times;
                </button>
              </div>
            )}

            {formErrorMsg && (
              <div className="form-alert-banner alert-error">
                <AlertCircle size={18} />
                <span>{formErrorMsg}</span>
                <button
                  type="button"
                  className="alert-close-btn"
                  onClick={() => setFormErrorMsg(null)}
                >
                  &times;
                </button>
              </div>
            )}

            {/* Autocomplete Quick-Select */}
            {!isEditingExisting && sheet1CollegeOptions.length > 0 && (
              <div className="quick-autocomplete-section" ref={collegePickerRef}>
                <label className="input-label">
                  <Sparkles size={14} className="text-accent" />
                  <span>Quick Autocomplete College:</span>
                </label>
                <div className="autocomplete-input-wrap">
                  <Search size={16} className="autocomplete-icon" />
                  <input
                    type="text"
                    placeholder="Search from existing colleges to pre-fill..."
                    value={collegeSearchPicker}
                    onChange={(e) => {
                      setCollegeSearchPicker(e.target.value);
                      setIsCollegePickerOpen(true);
                    }}
                    onFocus={() => setIsCollegePickerOpen(true)}
                    className="autocomplete-search-input"
                  />
                  {collegeSearchPicker && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => setCollegeSearchPicker("")}
                    >
                      &times;
                    </button>
                  )}
                </div>

                {isCollegePickerOpen && filteredAutocompleteColleges.length > 0 && (
                  <div className="autocomplete-dropdown-menu">
                    <div className="dropdown-header">
                      <span>Select College to Autofill:</span>
                      <span className="dropdown-count">{filteredAutocompleteColleges.length} results</span>
                    </div>
                    {filteredAutocompleteColleges.map((c, idx) => (
                      <div
                        key={idx}
                        className="autocomplete-dropdown-item"
                        onClick={() => handleSelectExistingCollege(c)}
                      >
                        <div className="item-main">
                          <span className="item-college-name">{c.name || "Unnamed"}</span>
                          <span className="item-project-code font-mono">{c.code}</span>
                        </div>
                        {c.startDate && (
                          <div className="item-dates-tag">
                            📅 {formatDisplayDate(c.startDate)} → {formatDisplayDate(c.endDate)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="timeline-input-form">
              {/* Row 1: Project Code & College Name */}
              <div className="form-grid-2col">
                <div className="form-group">
                  <label htmlFor="project_code" className="input-label">
                    <span>Project Code</span>
                    <span className="required-star">*</span>
                  </label>
                  <input
                    id="project_code"
                    type="text"
                    placeholder="e.g. ICEM/Engg/ALL/OT/26-27"
                    value={formData.project_code}
                    onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                    className="form-text-input font-mono"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="college_name" className="input-label">
                    <span>College Name</span>
                    <span className="required-star">*</span>
                  </label>
                  <input
                    id="college_name"
                    type="text"
                    placeholder="e.g. Indira College of Engineering and Management"
                    value={formData.college_name}
                    onChange={(e) => setFormData({ ...formData, college_name: e.target.value })}
                    className="form-text-input"
                  />
                </div>
              </div>

              {/* Row 2: Training Start Date & Training End Date */}
              <div className="form-grid-2col">
                <div className="form-group">
                  <label htmlFor="start_date" className="input-label">
                    <Calendar size={14} className="text-accent" />
                    <span>Training Start Date</span>
                    <span className="required-star">*</span>
                  </label>
                  <input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="form-text-input date-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end_date" className="input-label">
                    <Calendar size={14} className="text-accent" />
                    <span>Training End Date</span>
                  </label>
                  <input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="form-text-input date-input"
                  />
                </div>
              </div>

              {/* Live Preview Card: Duration & Status */}
              {formStatusPreview && (
                <div className={`live-preview-box status-${formStatusPreview.status.toLowerCase()}`}>
                  <div className="preview-header">
                    <div className="preview-status-pill">
                      {formStatusPreview.status === "Active" && "🟢 Active in Training Today"}
                      {formStatusPreview.status === "Upcoming" && "🔵 Upcoming Schedule"}
                      {formStatusPreview.status === "Completed" && "⚪ Concluded Training"}
                      {formStatusPreview.status === "No Dates" && "⚠️ Dates Needed"}
                    </div>
                    <span className="preview-duration-badge font-mono font-bold">
                      {formStatusPreview.durationDays} Days Duration
                    </span>
                  </div>

                  <div className="preview-details-grid">
                    <div className="preview-stat">
                      <span className="stat-label">Start Date:</span>
                      <span className="stat-val">{formatDisplayDate(formData.start_date)}</span>
                    </div>
                    <div className="preview-stat">
                      <span className="stat-label">End Date:</span>
                      <span className="stat-val">{formatDisplayDate(formData.end_date)}</span>
                    </div>
                    {formStatusPreview.status === "Active" && (
                      <div className="preview-stat">
                        <span className="stat-label">Elapsed / Left:</span>
                        <span className="stat-val">
                          {formStatusPreview.daysElapsed}d passed • {formStatusPreview.daysRemaining}d left
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="form-actions-row">
                <button
                  type="submit"
                  className="submit-timeline-btn"
                >
                  <Check size={16} />
                  <span>{isEditingExisting ? "Update Timeline Schedule" : "Save Timeline Schedule"}</span>
                </button>

                <button
                  type="button"
                  className="view-timeline-btn"
                  onClick={() => setActiveTab("view")}
                >
                  <BarChart3 size={16} />
                  <span>View Timeline Graph</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
