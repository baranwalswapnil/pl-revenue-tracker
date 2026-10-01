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
  type EnrichedTimelineItem,
  type TimelineStatus,
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
  // Navigation Tabs: 'view' (Timeline Graph) | 'add' (Add / Register Form)
  const [activeTab, setActiveTab] = useState<"view" | "add">("view");

  // Filter and Search States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TimelineStatus>("all");
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [viewMode, setViewMode] = useState<"gantt" | "table" | "roadmap">("gantt");

  // Add / Edit Form State
  const [formData, setFormData] = useState({
    id: "",
    project_code: "",
    college_name: "",
    start_date: "",
    end_date: "",
    academic_year: "4th Year",
    student_count: "",
    course_stream: "",
    notes: "",
  });

  const [formSuccessMsg, setFormSuccessMsg] = useState<string | null>(null);
  const [formErrorMsg, setFormErrorMsg] = useState<string | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [collegeSearchPicker, setCollegeSearchPicker] = useState("");
  const [isCollegePickerOpen, setIsCollegePickerOpen] = useState(false);
  const collegePickerRef = useRef<HTMLDivElement>(null);

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

  // Filtered timeline items based on search, status, and year
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

      // 3. Year filter
      if (selectedYear !== "all") {
        const startYr = item.start_date ? parseInt(item.start_date.slice(0, 4), 10) : 0;
        const endYr = item.end_date ? parseInt(item.end_date.slice(0, 4), 10) : 0;
        if (startYr !== selectedYear && endYr !== selectedYear) {
          return false;
        }
      }

      return true;
    });
  }, [allTimelines, searchTerm, statusFilter, selectedYear]);

  // Overall KPI statistics
  const stats = useMemo(() => {
    const total = allTimelines.length;
    const active = allTimelines.filter((t) => t.status === "Active").length;
    const upcoming = allTimelines.filter((t) => t.status === "Upcoming").length;
    const completed = allTimelines.filter((t) => t.status === "Completed").length;
    const withDates = allTimelines.filter((t) => t.start_date && t.end_date).length;

    return { total, active, upcoming, completed, withDates };
  }, [allTimelines]);

  // Calculate dynamic month range for Gantt chart
  const ganttMonthRange = useMemo(() => {
    const currentYr = selectedYear !== "all" ? Number(selectedYear) : 2026;
    const months: { monthIndex: number; year: number; label: string; short: string; key: string }[] = [];

    // Span from Jan of currentYr (or currentYr-1) to Dec of currentYr (or currentYr+1)
    const startYear = selectedYear !== "all" ? currentYr : 2026;
    const endYear = selectedYear !== "all" ? currentYr : 2026;

    for (let yr = startYear; yr <= endYear; yr++) {
      for (let m = 0; m < 12; m++) {
        const d = new Date(yr, m, 1);
        months.push({
          monthIndex: m,
          year: yr,
          label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
          short: d.toLocaleDateString("en-IN", { month: "short" }),
          key: `${yr}-${m + 1}`,
        });
      }
    }

    return months;
  }, [selectedYear]);

  // Helper to compute percentage position on the Gantt timeline
  const getGanttPosition = (startDateStr: string, endDateStr: string) => {
    if (ganttMonthRange.length === 0) return { left: 0, width: 0, isVisible: false };

    const firstMonth = ganttMonthRange[0];
    const lastMonth = ganttMonthRange[ganttMonthRange.length - 1];

    const timelineStart = new Date(firstMonth.year, firstMonth.monthIndex, 1).getTime();
    const timelineEnd = new Date(lastMonth.year, lastMonth.monthIndex + 1, 0, 23, 59, 59).getTime();
    const totalTimelineMs = timelineEnd - timelineStart;

    const normStart = normalizeDateStr(startDateStr);
    const normEnd = normalizeDateStr(endDateStr);

    if (!normStart) return { left: 0, width: 0, isVisible: false };

    const [sy, sm, sd] = normStart.split("-").map(Number);
    const startD = new Date(sy, sm - 1, sd || 1);

    let endD: Date;
    if (normEnd) {
      const [ey, em, ed] = normEnd.split("-").map(Number);
      endD = new Date(ey, em - 1, ed || 28);
    } else {
      endD = new Date(startD.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const startMs = startD.getTime();
    const endMs = endD.getTime();

    // Check if within bounds
    if (endMs < timelineStart || startMs > timelineEnd) {
      return { left: 0, width: 0, isVisible: false };
    }

    const clampedStart = Math.max(timelineStart, startMs);
    const clampedEnd = Math.min(timelineEnd, endMs);

    const leftPct = ((clampedStart - timelineStart) / totalTimelineMs) * 100;
    const widthPct = Math.max(2, ((clampedEnd - clampedStart) / totalTimelineMs) * 100);

    return {
      left: Math.max(0, Math.min(98, leftPct)),
      width: Math.max(2, Math.min(100 - leftPct, widthPct)),
      isVisible: true,
    };
  };

  // Compute Today marker position on the Gantt timeline
  const todayGanttPosition = useMemo(() => {
    if (ganttMonthRange.length === 0) return null;
    const firstMonth = ganttMonthRange[0];
    const lastMonth = ganttMonthRange[ganttMonthRange.length - 1];

    const timelineStart = new Date(firstMonth.year, firstMonth.monthIndex, 1).getTime();
    const timelineEnd = new Date(lastMonth.year, lastMonth.monthIndex + 1, 0, 23, 59, 59).getTime();
    const totalTimelineMs = timelineEnd - timelineStart;

    const now = new Date().getTime();
    if (now < timelineStart || now > timelineEnd) return null;

    const pos = ((now - timelineStart) / totalTimelineMs) * 100;
    return Math.max(0, Math.min(100, pos));
  }, [ganttMonthRange]);

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
    students?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    setFormData((prev) => ({
      ...prev,
      college_name: item.name,
      project_code: item.code,
      academic_year: item.academicYear || prev.academic_year,
      student_count: item.students ? String(item.students) : prev.student_count,
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
      setFormErrorMsg("Please provide at least a Project Code (Col B) or College Name (Col C).");
      return;
    }

    if (!startDate) {
      setFormErrorMsg("Please select a Start Date (Column L in Sheet1).");
      return;
    }

    if (startDate && endDate) {
      const s = new Date(startDate).getTime();
      const eTime = new Date(endDate).getTime();
      if (!isNaN(s) && !isNaN(eTime) && eTime < s) {
        setFormErrorMsg("End Date (Column M) cannot be earlier than Start Date (Column L).");
        return;
      }
    }

    // Save record to local storage service
    const saved = saveCollegeTimelineRecord({
      project_code: projCode,
      college_name: collegeName,
      start_date: startDate,
      end_date: endDate,
      academic_year: formData.academic_year,
      student_count: formData.student_count ? parseInt(formData.student_count, 10) : 0,
      course_stream: formData.course_stream,
      notes: formData.notes,
    });

    // Invoke parent callback to update App projects state if provided
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
      `Timeline successfully saved for "${collegeName || projCode}"! Linked to Sheet1 Columns B, C, L, and M.`
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
        academic_year: "4th Year",
        student_count: "",
        course_stream: "",
        notes: "",
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
      academic_year: item.academic_year || "4th Year",
      student_count: item.student_count ? String(item.student_count) : "",
      course_stream: item.course_stream || "",
      notes: item.notes || "",
    });
    setIsEditingExisting(true);
    setActiveTab("add");
    setFormErrorMsg(null);
    setFormSuccessMsg(null);
  };

  // Delete a timeline override
  const handleDeleteItem = (item: EnrichedTimelineItem) => {
    if (
      window.confirm(
        `Are you sure you want to delete the timeline for "${item.college_name || item.project_code}"?`
      )
    ) {
      removeSavedTimeline(item.id || item.project_code);
      setRefreshKey((prev) => prev + 1);
    }
  };

  // Unique college list for autocomplete
  const availableCollegesForPicker = useMemo(() => {
    const list: {
      name: string;
      code: string;
      academicYear?: string;
      students?: number;
      startDate?: string;
      endDate?: string;
    }[] = [];

    projects.forEach((p) => {
      const firstPhase = p.phases && p.phases.length > 0 ? p.phases[0] : null;
      const lastPhase = p.phases && p.phases.length > 0 ? p.phases[p.phases.length - 1] : null;
      list.push({
        name: p.college_name,
        code: p.project_code,
        academicYear: p.academic_year,
        students: p.student_count,
        startDate: firstPhase?.startDate,
        endDate: lastPhase?.endDate,
      });
    });

    googleSheetColleges.forEach((g) => {
      if (!list.some((item) => item.code === g.project_code || item.name === g.college_name)) {
        list.push({
          name: g.college_name,
          code: g.project_code,
          academicYear: g.academic_year,
          students: g.student_count,
          startDate: g.training_start_date,
          endDate: g.training_end_date,
        });
      }
    });

    if (!collegeSearchPicker) return list;
    const term = collegeSearchPicker.toLowerCase().trim();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term)
    );
  }, [projects, googleSheetColleges, collegeSearchPicker]);

  return (
    <div className="college-timeline-page-container">
      {/* Top Header & Breadcrumbs */}
      <div className="timeline-hero-header-card">
        <div className="timeline-hero-top-row">
          <button
            type="button"
            className="timeline-back-btn"
            onClick={onBackToDashboard}
            title="Return to Dashboard"
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>

          <div className="timeline-breadcrumbs">
            <span className="crumb-item" onClick={onBackToDashboard} style={{ cursor: "pointer" }}>
              Dashboard
            </span>
            <ChevronRight size={14} className="crumb-separator" />
            <span className="crumb-active">Active College Timeline</span>
          </div>
        </div>

        <div className="timeline-hero-title-row">
          <div className="timeline-hero-icon-box">
            <CalendarClockIcon size={30} />
          </div>
          <div className="timeline-hero-text">
            <h1 className="timeline-main-title">Active College Timeline & Schedule</h1>
            <p className="timeline-subtitle">
              Interactive timeline & schedule linked with Sheet1 (
              <span className="col-ref-chip">Col B: Project Code</span> •{" "}
              <span className="col-ref-chip">Col C: College Name</span> •{" "}
              <span className="col-ref-chip">Col L: Start Date</span> •{" "}
              <span className="col-ref-chip">Col M: End Date</span>)
            </p>
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

        {/* 2 Main Tabs Switcher: 1- Add, 2- View */}
        <div className="timeline-main-mode-switcher">
          <button
            type="button"
            className={`mode-tab-btn ${activeTab === "view" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("view");
              setIsEditingExisting(false);
            }}
          >
            <BarChart3 size={17} />
            <span>1. View Timeline Graph</span>
            <span className="tab-count-badge">{allTimelines.length}</span>
          </button>

          <button
            type="button"
            className={`mode-tab-btn ${activeTab === "add" ? "active" : ""}`}
            onClick={() => setActiveTab("add")}
          >
            <PlusCircle size={17} />
            <span>{isEditingExisting ? "2. Edit College Timeline" : "2. Add College Timeline"}</span>
          </button>
        </div>
      </div>

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
              <span className="kpi-count-text">Currently in training today</span>
              <span className="kpi-period-tag live-tag">🟢 Live</span>
            </div>
          </div>
        </div>

        {/* Card 2: Upcoming Colleges */}
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
              <span className="kpi-count-text">Start date scheduled ahead</span>
              <span className="kpi-period-tag upcoming-tag">🔵 Scheduled</span>
            </div>
          </div>
        </div>

        {/* Card 3: Completed Training */}
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
              <span className="kpi-count-text">Training successfully finished</span>
              <span className="kpi-period-tag completed-tag">⚪ Finished</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Tracked in Sheet1 */}
        <div className="timeline-kpi-card total-kpi-card">
          <div className="kpi-card-inner">
            <div className="kpi-header-row">
              <span className="kpi-title">Total Colleges Tracked</span>
              <span className="kpi-badge-icon total-icon">
                <Building2 size={18} />
              </span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-amount">{stats.total}</span>
              <span className="kpi-unit">Colleges</span>
            </div>
            <div className="kpi-footer-row">
              <span className="kpi-count-text">
                <strong>{stats.withDates}</strong> with start & end dates
              </span>
              <span className="kpi-period-tag sheet-tag">Sheet1</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: VIEW TIMELINE GRAPH & GANTT VISUALIZATION
          ========================================================================= */}
      {activeTab === "view" && (
        <div className="timeline-view-section">
          {/* Controls & Search Bar */}
          <div className="timeline-controls-bar">
            {/* Search Input */}
            <div className="timeline-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search college name, project code, or stream..."
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
            </div>

            {/* Year Filter */}
            <div className="timeline-year-pills-wrap">
              {(["all", 2024, 2025, 2026, 2027] as const).map((yr) => (
                <button
                  key={yr}
                  type="button"
                  className={`year-pill ${selectedYear === yr ? "active" : ""}`}
                  onClick={() => setSelectedYear(yr)}
                >
                  {yr === "all" ? "All Years" : yr}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="view-mode-toggle-wrap">
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "gantt" ? "active" : ""}`}
                onClick={() => setViewMode("gantt")}
                title="Interactive Gantt Timeline Graph"
              >
                <BarChart3 size={15} />
                <span>Gantt</span>
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

          {/* Active Filter Notice */}
          {(searchTerm || statusFilter !== "all" || selectedYear !== "all") && (
            <div className="active-filters-bar">
              <span>
                Showing <strong>{filteredTimelines.length}</strong> of {allTimelines.length} colleges
              </span>
              <button
                type="button"
                className="reset-filters-chip"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setSelectedYear("all");
                }}
              >
                Reset All Filters
              </button>
            </div>
          )}

          {/* GANTT TIMELINE GRAPH VIEW */}
          {viewMode === "gantt" && (
            <div className="gantt-chart-card">
              <div className="gantt-card-header">
                <div className="gantt-title-wrap">
                  <CalendarDays size={18} className="gantt-title-icon" />
                  <h3>College Schedule Timeline Graph</h3>
                </div>
                <div className="gantt-legend">
                  <span className="legend-item">
                    <span className="legend-dot active-dot" /> Active (Today in Range)
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot upcoming-dot" /> Upcoming
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot completed-dot" /> Completed
                  </span>
                  <span className="legend-item">
                    <span className="legend-line today-line-legend" /> Today: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>

              {filteredTimelines.length === 0 ? (
                <div className="empty-timeline-box">
                  <CalendarRange size={42} className="empty-icon" />
                  <h4>No College Schedules Found</h4>
                  <p>Try adjusting your search term or status filter, or click "Add College Timeline" to register a schedule.</p>
                  <button
                    type="button"
                    className="add-new-timeline-btn"
                    onClick={() => setActiveTab("add")}
                  >
                    <PlusCircle size={15} />
                    <span>Add College Timeline</span>
                  </button>
                </div>
              ) : (
                <div className="gantt-scrollable-container">
                  <div className="gantt-inner-wrapper">
                    {/* Gantt Header Row with Months */}
                    <div className="gantt-header-row">
                      <div className="gantt-col-info-header">
                        <span>College Name & Project Code</span>
                      </div>
                      <div className="gantt-timeline-header-track">
                        {ganttMonthRange.map((m) => (
                          <div key={m.key} className="gantt-month-cell">
                            <span className="month-label-main">{m.short}</span>
                            <span className="month-label-sub">{m.year}</span>
                          </div>
                        ))}

                        {/* Red Today Line in Header */}
                        {todayGanttPosition !== null && (
                          <div
                            className="gantt-today-indicator-line"
                            style={{ left: `${todayGanttPosition}%` }}
                            title={`Today: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                          >
                            <span className="today-flag">Today</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Gantt Row for Each College */}
                    <div className="gantt-body-rows">
                      {filteredTimelines.map((item, idx) => {
                        const pos = getGanttPosition(item.start_date, item.end_date);
                        const hasDates = Boolean(item.start_date && item.end_date);

                        return (
                          <div key={item.id || idx} className="gantt-college-row">
                            {/* Left Meta Info */}
                            <div className="gantt-college-info-col">
                              <div className="college-header-line">
                                <span className="college-title-name" title={item.college_name}>
                                  {item.college_name || "Unnamed College"}
                                </span>
                                <span
                                  className={`status-chip status-${item.status.toLowerCase().replace(/\s+/g, "-")}`}
                                >
                                  {item.status === "Active" && "🟢 "}
                                  {item.status === "Upcoming" && "🔵 "}
                                  {item.status === "Completed" && "⚪ "}
                                  {item.status}
                                </span>
                              </div>

                              <div className="college-sub-line">
                                <span className="project-code-badge font-mono">{item.project_code}</span>
                                {item.academic_year && (
                                  <span className="acad-year-pill">{item.academic_year}</span>
                                )}
                                {item.course_stream && (
                                  <span className="stream-pill">{item.course_stream}</span>
                                )}
                              </div>

                              <div className="college-date-info-line">
                                <span className="date-range-text">
                                  📅 {item.formattedStartDate} → {item.formattedEndDate}
                                </span>
                                {item.durationDays > 0 && (
                                  <span className="duration-pill">{item.durationDays} Days</span>
                                )}
                                <button
                                  type="button"
                                  className="gantt-quick-edit-btn"
                                  onClick={() => handleEditItem(item)}
                                  title="Edit Dates (Col L & M)"
                                >
                                  <Edit3 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Right Timeline Canvas with Bar */}
                            <div className="gantt-timeline-track">
                              {/* Background Month Grid Gridlines */}
                              {ganttMonthRange.map((m) => (
                                <div key={m.key} className="gantt-gridline-cell" />
                              ))}

                              {/* Today Line Indicator */}
                              {todayGanttPosition !== null && (
                                <div
                                  className="gantt-today-track-line"
                                  style={{ left: `${todayGanttPosition}%` }}
                                />
                              )}

                              {/* Timeline Bar */}
                              {hasDates && pos.isVisible ? (
                                <div
                                  className={`gantt-bar-pill bar-status-${item.status.toLowerCase()}`}
                                  style={{
                                    left: `${pos.left}%`,
                                    width: `${pos.width}%`,
                                  }}
                                  onClick={() => handleEditItem(item)}
                                  title={`${item.college_name} (${item.project_code})\nStart: ${item.formattedStartDate} (Col L)\nEnd: ${item.formattedEndDate} (Col M)\nStatus: ${item.status} (${item.durationDays} Days)`}
                                >
                                  {/* Progress Fill Gradient */}
                                  {item.status === "Active" && (
                                    <div
                                      className="bar-progress-fill"
                                      style={{ width: `${item.progressPct}%` }}
                                    />
                                  )}

                                  <div className="bar-content-label">
                                    <span className="bar-text-main">
                                      {item.college_name.length > 22
                                        ? `${item.college_name.slice(0, 20)}...`
                                        : item.college_name}
                                    </span>
                                    <span className="bar-text-dates">
                                      {item.durationDays}d
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="no-dates-placeholder-line">
                                  <span>No Start/End date set</span>
                                  <button
                                    type="button"
                                    className="set-dates-link-btn"
                                    onClick={() => handleEditItem(item)}
                                  >
                                    + Set Dates
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DETAILED SPREADSHEET TABLE VIEW */}
          {viewMode === "table" && (
            <div className="timeline-table-card">
              <div className="timeline-table-wrap">
                <table className="outstanding-data-table timeline-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "45px" }}>#</th>
                      <th>College Name (Col C) & Project Code (Col B)</th>
                      <th>Start Date (Col L)</th>
                      <th>End Date (Col M)</th>
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
                          <div className="college-info-cell">
                            <span className="college-main-name">{item.college_name}</span>
                            <span className="project-code-sub font-mono">{item.project_code}</span>
                          </div>
                        </td>
                        <td>
                          <span className="date-badge-pill start-date-pill">
                            📅 {item.formattedStartDate}
                          </span>
                        </td>
                        <td>
                          <span className="date-badge-pill end-date-pill">
                            🏁 {item.formattedEndDate}
                          </span>
                        </td>
                        <td className="text-center font-semibold">
                          {item.durationDays > 0 ? `${item.durationDays} Days` : "—"}
                        </td>
                        <td className="text-center">
                          <span className={`status-chip status-${item.status.toLowerCase().replace(/\s+/g, "-")}`}>
                            {item.status === "Active" && "🟢 "}
                            {item.status === "Upcoming" && "🔵 "}
                            {item.status === "Completed" && "⚪ "}
                            {item.status}
                          </span>
                        </td>
                        <td className="text-center">
                          {item.status === "Active" ? (
                            <div className="progress-bar-wrap">
                              <div className="progress-bar-fill" style={{ width: `${item.progressPct}%` }} />
                              <span className="progress-text">{item.progressPct}%</span>
                            </div>
                          ) : item.status === "Completed" ? (
                            <span className="completed-check">100% Complete</span>
                          ) : (
                            <span className="text-muted">Upcoming</span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="table-actions-cell">
                            <button
                              type="button"
                              className="action-icon-btn edit-icon-btn"
                              onClick={() => handleEditItem(item)}
                              title="Edit Schedule"
                            >
                              <Edit3 size={15} />
                            </button>
                            {item.source === "manual" && (
                              <button
                                type="button"
                                className="action-icon-btn delete-icon-btn"
                                onClick={() => handleDeleteItem(item)}
                                title="Delete Schedule"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
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
                <CalendarPlusIcon size={22} className="form-icon" />
                <div>
                  <h2 className="form-title">
                    {isEditingExisting ? "Edit College Timeline Schedule" : "Add Active College Timeline"}
                  </h2>
                  <p className="form-desc">
                    Specify Project Code (Col B), College Name (Col C), Start Date (Col L), and End Date (Col M).
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
                      academic_year: "4th Year",
                      student_count: "",
                      course_stream: "",
                      notes: "",
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
              <div className="form-alert success-alert">
                <CheckCircle2 size={18} />
                <span>{formSuccessMsg}</span>
              </div>
            )}

            {formErrorMsg && (
              <div className="form-alert error-alert">
                <AlertCircle size={18} />
                <span>{formErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="timeline-form-body">
              {/* College Quick Selector Autocomplete */}
              <div className="form-group-full" ref={collegePickerRef}>
                <label className="form-field-label">
                  <Building2 size={15} />
                  <span>1. Select Existing College or Type New</span>
                  <span className="field-hint-text">(Auto-fills Project Code & College Name from Sheet1)</span>
                </label>

                <div className="college-picker-input-wrap">
                  <button
                    type="button"
                    className="college-picker-trigger-btn"
                    onClick={() => setIsCollegePickerOpen(!isCollegePickerOpen)}
                  >
                    <span>
                      {formData.college_name || formData.project_code
                        ? `${formData.college_name || "College"} (${formData.project_code || "Code"})`
                        : "Click to pick an existing college from Sheet1 or registered list..."}
                    </span>
                    <ChevronRight size={16} />
                  </button>

                  {isCollegePickerOpen && (
                    <div className="college-picker-dropdown-menu">
                      <div className="picker-search-bar">
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder="Search colleges from Sheet1..."
                          value={collegeSearchPicker}
                          onChange={(e) => setCollegeSearchPicker(e.target.value)}
                          autoFocus
                          className="picker-search-input"
                        />
                      </div>

                      <div className="picker-options-list">
                        {availableCollegesForPicker.map((c, idx) => (
                          <div
                            key={idx}
                            className="picker-option-item"
                            onClick={() => handleSelectExistingCollege(c)}
                          >
                            <div className="picker-option-left">
                              <span className="picker-col-name">{c.name}</span>
                              <span className="picker-col-code font-mono">{c.code}</span>
                            </div>
                            {c.startDate && (
                              <span className="picker-date-tag">
                                {c.startDate} → {c.endDate || "Ongoing"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 1: Project Code (Col B) & College Name (Col C) */}
              <div className="form-row-two-cols">
                <div className="form-group">
                  <label className="form-field-label">
                    <span>Project Code</span>
                    <span className="col-ref-badge">Column B in Sheet1</span>
                    <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. KDK/Engg/4th/TP/26-27"
                    className="timeline-form-input font-mono"
                    value={formData.project_code}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, project_code: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-field-label">
                    <span>College Name</span>
                    <span className="col-ref-badge">Column C in Sheet1</span>
                    <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. KDK College of Engineering, Nagpur"
                    className="timeline-form-input"
                    value={formData.college_name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, college_name: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              {/* Row 2: Start Date (Col L) & End Date (Col M) */}
              <div className="form-row-two-cols">
                <div className="form-group">
                  <label className="form-field-label">
                    <Calendar size={15} />
                    <span>Start Date</span>
                    <span className="col-ref-badge">Column L in Sheet1</span>
                    <span className="required-star">*</span>
                  </label>
                  <input
                    type="date"
                    className="timeline-form-input date-input"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-field-label">
                    <Calendar size={15} />
                    <span>End Date</span>
                    <span className="col-ref-badge">Column M in Sheet1</span>
                  </label>
                  <input
                    type="date"
                    className="timeline-form-input date-input"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              {formStatusPreview && (
                <div className="timeline-live-preview-card">
                  <div className="preview-header">
                    <Info size={16} />
                    <span className="preview-title">Live Schedule Duration & Status Preview</span>
                  </div>
                  <div className="preview-body-row">
                    <div className="preview-stat-item">
                      <span className="preview-lbl">Total Duration</span>
                      <span className="preview-val font-semibold">{formStatusPreview.durationDays} Days</span>
                    </div>
                    <div className="preview-stat-item">
                      <span className="preview-lbl">Current Status</span>
                      <span className={`status-chip status-${formStatusPreview.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {formStatusPreview.status === "Active" && "🟢 Active Today"}
                        {formStatusPreview.status === "Upcoming" && `🔵 Starts in ${formStatusPreview.daysRemaining} days`}
                        {formStatusPreview.status === "Completed" && "⚪ Completed"}
                      </span>
                    </div>
                    {formStatusPreview.status === "Active" && (
                      <div className="preview-stat-item">
                        <span className="preview-lbl">Progress</span>
                        <span className="preview-val font-semibold">{formStatusPreview.progressPct}% complete</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Optional Row 3: Academic Year & Stream */}
              <div className="form-row-two-cols">
                <div className="form-group">
                  <label className="form-field-label">Academic Year</label>
                  <select
                    className="timeline-form-input"
                    value={formData.academic_year}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, academic_year: e.target.value }))
                    }
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-field-label">Course / Stream (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. B.Tech / CSE / IT"
                    className="timeline-form-input"
                    value={formData.course_stream}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, course_stream: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="form-actions-row">
                <button type="submit" className="save-timeline-submit-btn">
                  <Check size={16} />
                  <span>{isEditingExisting ? "Update Timeline Schedule" : "Save Timeline to Sheet1 & Register"}</span>
                </button>

                <button
                  type="button"
                  className="reset-form-btn"
                  onClick={() => {
                    setFormData({
                      id: "",
                      project_code: "",
                      college_name: "",
                      start_date: "",
                      end_date: "",
                      academic_year: "4th Year",
                      student_count: "",
                      course_stream: "",
                      notes: "",
                    });
                    setFormErrorMsg(null);
                    setFormSuccessMsg(null);
                  }}
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Fallback Helper Icons
function CalendarClockIcon(props: { size?: number }) {
  return (
    <svg
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <circle cx="16" cy="16" r="6" />
      <path d="M16 14v2l1 1" />
    </svg>
  );
}

function CalendarPlusIcon(props: { size?: number; className?: string }) {
  return (
    <svg
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="M10 16h4" />
      <path d="M12 14v4" />
    </svg>
  );
}
