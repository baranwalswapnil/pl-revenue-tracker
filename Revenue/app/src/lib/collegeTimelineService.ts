import type { Project } from "./models";
import type { GoogleSheetCollegeItem, GoogleSheetMOUItem } from "./googleSheetsService";

export interface CollegeTimelineRecord {
  id: string;
  project_code: string;       // Column B in College Training or MOUs Project Code
  college_name: string;       // Column C in College Training or Total Engineering College
  start_date: string;         // Training Start Date (YYYY-MM-DD)
  end_date: string;           // Training End Date (YYYY-MM-DD)
  academic_year?: string;
  student_count?: number;
  course_stream?: string;
  domain_of_training?: string;
  notes?: string;
  source?: "sheet1" | "manual" | "project" | "mou_trainee" | "college_training";
  updated_at?: string;
}

export type TimelineStatus = "Active" | "Upcoming" | "Completed" | "Incomplete Data";

export interface EnrichedTimelineItem extends CollegeTimelineRecord {
  status: TimelineStatus;
  durationDays: number;
  progressPct: number;
  daysRemaining: number;
  daysElapsed: number;
  isOngoingToday: boolean;
  formattedStartDate: string;
  formattedEndDate: string;
  startMonthYear: string;
  endMonthYear: string;
}

const STORAGE_TIMELINES_KEY = "college_timeline_records_v1";

/**
 * Normalizes date to standard YYYY-MM-DD format
 */
export function normalizeDateStr(dateStr?: string): string {
  if (!dateStr || !String(dateStr).trim()) return "";
  const str = String(dateStr).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Excel serial number (e.g. 40000 - 60000)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    const year = date_info.getFullYear();
    const month = String(date_info.getMonth() + 1).padStart(2, "0");
    const day = String(date_info.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // DD-Mon-YYYY (e.g. 11-Nov-2025 or 15 Apr 2026)
  const dMonY = str.match(/^(\d{1,2})[\s\.-]([A-Za-z]{3,9})[\s\.-](\d{4})/);
  if (dMonY) {
    const day = dMonY[1].padStart(2, "0");
    const monStr = dMonY[2].toLowerCase().slice(0, 3);
    const monthsMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const month = monthsMap[monStr];
    const year = dMonY[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Date parse fallback
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Ignore
  }

  return str;
}

/**
 * Formats YYYY-MM-DD to readable date like "15 Apr 2026"
 */
export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return "Not set";
  const normalized = normalizeDateStr(dateStr);
  if (!normalized) return "Not set";

  try {
    const parts = normalized.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    }
  } catch {
    // Fallback
  }

  return dateStr;
}

/**
 * Calculates timeline status, duration, progress % relative to reference date (today).
 * If Training Start Date (Col L) or Training End Date (Col M) is not present, returns 'Incomplete Data'.
 * No synthetic or guessed dates are predicted.
 */
export function computeTimelineStatus(
  startDateStr?: string,
  endDateStr?: string,
  referenceDate: Date = new Date()
): {
  status: TimelineStatus;
  durationDays: number;
  progressPct: number;
  daysRemaining: number;
  daysElapsed: number;
  isOngoingToday: boolean;
} {
  const normStart = normalizeDateStr(startDateStr);
  const normEnd = normalizeDateStr(endDateStr);

  // If Training Start Date or Training End Date is missing, show Incomplete Data (do NOT predict anything)
  if (!normStart || !normEnd) {
    return {
      status: "Incomplete Data",
      durationDays: 0,
      progressPct: 0,
      daysRemaining: 0,
      daysElapsed: 0,
      isOngoingToday: false,
    };
  }

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const todayTime = today.getTime();

  const [sy, sm, sd] = normStart.split("-").map(Number);
  const [ey, em, ed] = normEnd.split("-").map(Number);

  if (isNaN(sy) || isNaN(sm) || isNaN(sd) || isNaN(ey) || isNaN(em) || isNaN(ed)) {
    return {
      status: "Incomplete Data",
      durationDays: 0,
      progressPct: 0,
      daysRemaining: 0,
      daysElapsed: 0,
      isOngoingToday: false,
    };
  }

  const startD = new Date(sy, sm - 1, sd);
  const endD = new Date(ey, em - 1, ed);
  const startTime = startD.getTime();
  const endTime = endD.getTime();

  if (isNaN(startTime) || isNaN(endTime)) {
    return {
      status: "Incomplete Data",
      durationDays: 0,
      progressPct: 0,
      daysRemaining: 0,
      daysElapsed: 0,
      isOngoingToday: false,
    };
  }

  const totalDurationMs = Math.max(1, endTime - startTime);
  const durationDays = Math.round(totalDurationMs / (1000 * 60 * 60 * 24)) + 1;

  if (todayTime < startTime) {
    // Upcoming
    const daysUntilStart = Math.ceil((startTime - todayTime) / (1000 * 60 * 60 * 24));
    return {
      status: "Upcoming",
      durationDays,
      progressPct: 0,
      daysRemaining: daysUntilStart,
      daysElapsed: 0,
      isOngoingToday: false,
    };
  } else if (todayTime > endTime) {
    // Completed
    const daysSinceEnd = Math.floor((todayTime - endTime) / (1000 * 60 * 60 * 24));
    return {
      status: "Completed",
      durationDays,
      progressPct: 100,
      daysRemaining: 0,
      daysElapsed: durationDays,
      isOngoingToday: false,
    };
  } else {
    // Active / Ongoing
    const elapsedMs = todayTime - startTime;
    const daysElapsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, Math.ceil((endTime - todayTime) / (1000 * 60 * 60 * 24)));
    const progressPct = Math.min(100, Math.max(5, Math.round((elapsedMs / totalDurationMs) * 100)));

    return {
      status: "Active",
      durationDays,
      progressPct,
      daysRemaining,
      daysElapsed,
      isOngoingToday: true,
    };
  }
}

/**
 * Loads manual timeline overrides from localStorage
 */
export function loadSavedTimelines(): CollegeTimelineRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_TIMELINES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Saves manual timeline overrides to localStorage
 */
export function saveTimelinesToStorage(timelines: CollegeTimelineRecord[]): void {
  try {
    localStorage.setItem(STORAGE_TIMELINES_KEY, JSON.stringify(timelines));
  } catch (e) {
    console.error("Failed to save timelines to storage:", e);
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function addDaysToDate(dateStr: string, days: number): string {
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dt}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Resolves exact training start & end dates for each college.
 * Strictly preserves the exact Sheet 1 Start Date (Column L) or MOU Signed Date (Column K).
 * Never mutates, shifts, or randomizes start dates.
 * If Column L and Column K are missing, returns empty start_date/end_date to mark as 'Incomplete Data'.
 */
export function resolveDistinctCollegeDates(record: {
  project_code: string;
  college_name: string;
  start_date?: string;
  end_date?: string;
  mou_signed_date?: string;
  course_stream?: string;
  domain_of_training?: string;
  type_of_project?: string;
  academic_year?: string;
  student_count?: number;
  hours_planned?: number;
  source?: string;
}): { start_date: string; end_date: string } {
  // If user explicitly entered / edited manual dates, preserve them directly
  if (record.source === "manual" && record.start_date) {
    const s = normalizeDateStr(record.start_date);
    const e = normalizeDateStr(record.end_date) || addDaysToDate(s, 21);
    return { start_date: s, end_date: e };
  }

  // 1. EXACT Start Date: Prioritize Column L (training_start_date), then Column K (mou_signed_date)
  const rawStart = normalizeDateStr(record.start_date);
  const rawMou = normalizeDateStr(record.mou_signed_date);
  const startDate = rawStart || rawMou || "";

  if (!startDate) {
    return { start_date: "", end_date: "" };
  }

  // 2. End Date:
  // If Column M has a valid end date that is after startDate, use it directly.
  // If missing or <= startDate (single-day placeholder like 16/09/2026 to 16/09/2026),
  // compute realistic duration from planned hours (21 to 42 days).
  let rawEnd = normalizeDateStr(record.end_date);
  let endDate = rawEnd;

  if (!endDate) {
    const hrs = record.hours_planned || 40;
    const days = hrs >= 80 ? 42 : hrs >= 60 ? 28 : 21;
    endDate = addDaysToDate(startDate, days);
  } else {
    const sTime = new Date(startDate).getTime();
    const eTime = new Date(endDate).getTime();
    if (eTime <= sTime) {
      const hrs = record.hours_planned || 40;
      const days = hrs >= 80 ? 42 : hrs >= 60 ? 28 : 21;
      endDate = addDaysToDate(startDate, days);
    }
  }

  return { start_date: startDate, end_date: endDate };
}

/**
 * Combines Google Sheet 'College Training' items and local manual override records
 * into a single enriched list sorted by Start Date.
 * Exclusively extracts data from the 'College Training' tab.
 */
export function getAllEnrichedTimelines(
  googleSheetColleges: GoogleSheetCollegeItem[] = []
): EnrichedTimelineItem[] {
  const savedTimelines = loadSavedTimelines();
  const map = new Map<string, CollegeTimelineRecord>();

  // 1. Process Google Sheet 'College Training' items exclusively
  googleSheetColleges.forEach((sheetItem) => {
    const projCode = (sheetItem.project_code || "").trim();
    const collegeName = (sheetItem.college_name || "").trim();
    if (!projCode && !collegeName) return;

    // Resolve distinct training start & end dates from College Training
    const resolvedDates = resolveDistinctCollegeDates({
      project_code: projCode,
      college_name: collegeName,
      start_date: sheetItem.training_start_date,
      end_date: sheetItem.training_end_date,
      mou_signed_date: sheetItem.mou_signed_date,
      course_stream: sheetItem.course_stream,
      domain_of_training: sheetItem.domain_of_training,
      type_of_project: sheetItem.type_of_project,
      academic_year: sheetItem.academic_year,
      student_count: sheetItem.student_count,
      hours_planned: sheetItem.hours_planned,
      source: "college_training",
    });

    const key = (projCode || collegeName).toLowerCase();
    map.set(key, {
      id: sheetItem.id || `sheet-${projCode || collegeName}`,
      project_code: projCode,
      college_name: collegeName,
      start_date: resolvedDates.start_date,
      end_date: resolvedDates.end_date,
      academic_year: sheetItem.academic_year || "",
      student_count: sheetItem.student_count || 0,
      course_stream: sheetItem.course_stream || "",
      domain_of_training: sheetItem.domain_of_training || "",
      source: "college_training",
      updated_at: new Date().toISOString(),
    });
  });

  // 2. Apply manual overrides / user additions
  savedTimelines.forEach((saved) => {
    const key = (saved.project_code || saved.college_name).toLowerCase();
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        ...saved,
        start_date: saved.start_date || existing.start_date,
        end_date: saved.end_date || existing.end_date,
        source: "manual",
      });
    } else {
      map.set(key, {
        ...saved,
        source: "manual",
      });
    }
  });

  // 4. Enrich each record with status, durations, and formats
  const enrichedList: EnrichedTimelineItem[] = Array.from(map.values()).map((record) => {
    const stats = computeTimelineStatus(record.start_date, record.end_date);
    const normStart = normalizeDateStr(record.start_date);
    const normEnd = normalizeDateStr(record.end_date);

    let startMonthYear = "";
    let endMonthYear = "";

    if (normStart) {
      const parts = normStart.split("-");
      if (parts.length >= 2) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
        startMonthYear = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      }
    }

    if (normEnd) {
      const parts = normEnd.split("-");
      if (parts.length >= 2) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
        endMonthYear = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      }
    }

    return {
      ...record,
      status: stats.status,
      durationDays: stats.durationDays,
      progressPct: stats.progressPct,
      daysRemaining: stats.daysRemaining,
      daysElapsed: stats.daysElapsed,
      isOngoingToday: stats.isOngoingToday,
      formattedStartDate: formatDisplayDate(record.start_date),
      formattedEndDate: formatDisplayDate(record.end_date),
      startMonthYear,
      endMonthYear,
    };
  });

  // Sort list: Active first, then Upcoming (soonest start), then Completed, then Incomplete Data
  return enrichedList.sort((a, b) => {
    const statusWeight: Record<string, number> = { Active: 0, Upcoming: 1, Completed: 2, "Incomplete Data": 3, "No Dates": 3 };
    const weightA = statusWeight[a.status] ?? 3;
    const weightB = statusWeight[b.status] ?? 3;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    if (a.start_date && b.start_date) {
      return a.start_date.localeCompare(b.start_date);
    }
    return a.college_name.localeCompare(b.college_name);
  });
}

/**
 * Adds or updates a college timeline record in localStorage
 */
export function saveCollegeTimelineRecord(
  payload: {
    project_code: string;
    college_name: string;
    start_date: string;
    end_date: string;
    academic_year?: string;
    student_count?: number;
    course_stream?: string;
    notes?: string;
  }
): CollegeTimelineRecord {
  const saved = loadSavedTimelines();
  const projCode = payload.project_code.trim();
  const collegeName = payload.college_name.trim();
  const key = (projCode || collegeName).toLowerCase();

  const newRecord: CollegeTimelineRecord = {
    id: `timeline-${projCode.toLowerCase().replace(/[^a-z0-9]/g, "-") || Date.now()}`,
    project_code: projCode,
    college_name: collegeName,
    start_date: normalizeDateStr(payload.start_date),
    end_date: normalizeDateStr(payload.end_date),
    academic_year: payload.academic_year || "",
    student_count: payload.student_count || 0,
    course_stream: payload.course_stream || "",
    notes: payload.notes || "",
    source: "manual",
    updated_at: new Date().toISOString(),
  };

  const existingIdx = saved.findIndex(
    (s) => (s.project_code || s.college_name).toLowerCase() === key
  );

  if (existingIdx !== -1) {
    saved[existingIdx] = {
      ...saved[existingIdx],
      ...newRecord,
    };
  } else {
    saved.unshift(newRecord);
  }

  saveTimelinesToStorage(saved);
  return newRecord;
}

/**
 * Removes a saved timeline override from localStorage
 */
export function removeSavedTimeline(idOrCode: string): void {
  const saved = loadSavedTimelines();
  const filtered = saved.filter(
    (s) => s.id !== idOrCode && s.project_code.toLowerCase() !== idOrCode.toLowerCase()
  );
  saveTimelinesToStorage(filtered);
}

/* =========================================================================
   DAY-BY-DAY SPREADSHEET TIMELINE GRID (MATCHING REFERENCE IMAGE)
   ========================================================================= */

export interface TimelineDayColumn {
  dateStr: string;        // '2026-09-07'
  dayNum: string;         // '07'
  dayNumber: number;      // 7
  monthKey: string;       // '2026-09'
  monthLabel: string;     // 'September 2026'
  monthShort: string;     // 'Sep'
  year: number;           // 2026
  dayOfWeek: number;      // 0 (Sun) to 6 (Sat)
  dayOfWeekName: string;  // 'Sun', 'Mon', 'Tue'...
  isSunday: boolean;
  isSaturday: boolean;
  isWeekend: boolean;
  isToday: boolean;
  colIndex: number;       // 0-indexed column in timeline grid
  colLetter: string;      // 'A', 'B', 'AA', etc.
}

export interface TimelineMonthGroup {
  monthKey: string;       // '2026-09'
  monthLabel: string;     // 'September 2026'
  year: number;
  monthIndex: number;     // 8 (0-indexed)
  startColIndex: number;  // Starting column index in grid
  daysCount: number;      // Number of days in this month
}

export interface TimelineBarTheme {
  bg: string;
  gradient: string;
  borderColor: string;
  textColor: string;
  subTextColor: string;
  shadow: string;
  colorName: string;
}

export const TIMELINE_COLOR_PALETTES: TimelineBarTheme[] = [
  {
    bg: "#6366f1",
    gradient: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
    borderColor: "#4338ca",
    textColor: "#ffffff",
    subTextColor: "#e0e7ff",
    shadow: "0 4px 14px rgba(79, 70, 229, 0.35)",
    colorName: "indigo",
  },
  {
    bg: "#10b981",
    gradient: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
    borderColor: "#047857",
    textColor: "#ffffff",
    subTextColor: "#d1fae5",
    shadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
    colorName: "emerald",
  },
  {
    bg: "#f43f5e",
    gradient: "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
    borderColor: "#be123c",
    textColor: "#ffffff",
    subTextColor: "#ffe4e6",
    shadow: "0 4px 14px rgba(244, 63, 94, 0.35)",
    colorName: "rose",
  },
  {
    bg: "#06b6d4",
    gradient: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
    borderColor: "#0e7490",
    textColor: "#ffffff",
    subTextColor: "#cffafe",
    shadow: "0 4px 14px rgba(6, 182, 212, 0.35)",
    colorName: "cyan",
  },
  {
    bg: "#f59e0b",
    gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
    borderColor: "#b45309",
    textColor: "#ffffff",
    subTextColor: "#fef3c7",
    shadow: "0 4px 14px rgba(245, 158, 11, 0.35)",
    colorName: "amber",
  },
  {
    bg: "#3b82f6",
    gradient: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
    borderColor: "#1d4ed8",
    textColor: "#ffffff",
    subTextColor: "#dbeafe",
    shadow: "0 4px 14px rgba(37, 99, 235, 0.35)",
    colorName: "blue",
  },
  {
    bg: "#a855f7",
    gradient: "linear-gradient(135deg, #9333ea 0%, #a855f7 100%)",
    borderColor: "#7e22ce",
    textColor: "#ffffff",
    subTextColor: "#f3e8ff",
    shadow: "0 4px 14px rgba(168, 85, 247, 0.35)",
    colorName: "purple",
  },
  {
    bg: "#14b8a6",
    gradient: "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
    borderColor: "#0f766e",
    textColor: "#ffffff",
    subTextColor: "#ccfbf1",
    shadow: "0 4px 14px rgba(20, 184, 166, 0.35)",
    colorName: "teal",
  },
];

/**
 * Deterministically retrieves a vibrant theme based on college name / project code
 */
export function getTimelineBarTheme(identifier: string = ""): TimelineBarTheme {
  let hash = 0;
  const str = identifier || "college";
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TIMELINE_COLOR_PALETTES.length;
  return TIMELINE_COLOR_PALETTES[index];
}

/**
 * Returns Excel style column letter (A, B, C... Z, AA, AB...)
 */
export function getColumnLetter(colIndex: number): string {
  let letter = "";
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Formats date for the popover note (e.g., "07-Sep-2026")
 */
export function formatTimelinePopupDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  const norm = normalizeDateStr(dateStr);
  if (!norm) return dateStr;
  const parts = norm.split("-");
  if (parts.length !== 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayStr = String(d).padStart(2, "0");
  const monthStr = months[m - 1] || "Jan";
  return `${dayStr}-${monthStr}-${y}`;
}

/**
 * Generates the complete day-by-day spreadsheet grid columns and month groups
 */
export function generateDayGridData(
  startYear: number,
  startMonthIdx: number, // 0-indexed
  endYear: number,
  endMonthIdx: number   // 0-indexed
): {
  days: TimelineDayColumn[];
  months: TimelineMonthGroup[];
  todayColIndex: number | null;
} {
  const days: TimelineDayColumn[] = [];
  const months: TimelineMonthGroup[] = [];
  const todayStr = normalizeDateStr(new Date().toISOString().slice(0, 10));
  let todayColIndex: number | null = null;
  let currentColIndex = 0;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthShorts = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let curYear = startYear;
  let curMonth = startMonthIdx;

  while (curYear < endYear || (curYear === endYear && curMonth <= endMonthIdx)) {
    const monthStartCol = currentColIndex;
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const monthLabel = `${monthNames[curMonth]} ${curYear}`;
    const monthShort = monthShorts[curMonth];
    const monthKey = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(curYear, curMonth, d);
      const dayOfWeek = dayDate.getDay();
      const dayStr = String(d).padStart(2, "0");
      const dateStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${dayStr}`;
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;
      const isToday = dateStr === todayStr;

      if (isToday) {
        todayColIndex = currentColIndex;
      }

      days.push({
        dateStr,
        dayNum: dayStr,
        dayNumber: d,
        monthKey,
        monthLabel,
        monthShort,
        year: curYear,
        dayOfWeek,
        dayOfWeekName: dayNames[dayOfWeek],
        isSunday,
        isSaturday,
        isWeekend: isSunday || isSaturday,
        isToday,
        colIndex: currentColIndex,
        colLetter: getColumnLetter(currentColIndex),
      });

      currentColIndex++;
    }

    months.push({
      monthKey,
      monthLabel,
      year: curYear,
      monthIndex: curMonth,
      startColIndex: monthStartCol,
      daysCount: daysInMonth,
    });

    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
  }

  return { days, months, todayColIndex };
}
