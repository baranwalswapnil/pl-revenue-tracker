import type { Project } from "./models";
import type { GoogleSheetCollegeItem } from "./googleSheetsService";

export interface CollegeTimelineRecord {
  id: string;
  project_code: string;       // Column B in Sheet1
  college_name: string;       // Column C in Sheet1
  start_date: string;         // Column L in Sheet1 (YYYY-MM-DD)
  end_date: string;           // Column M in Sheet1 (YYYY-MM-DD)
  academic_year?: string;
  student_count?: number;
  course_stream?: string;
  domain_of_training?: string;
  notes?: string;
  source?: "sheet1" | "manual" | "project";
  updated_at?: string;
}

export type TimelineStatus = "Active" | "Upcoming" | "Completed" | "No Dates";

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
  if (!dateStr || !dateStr.trim()) return "";
  const str = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // MM/DD/YYYY fallback
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
 * Calculates timeline status, duration, progress % relative to reference date (today)
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

  if (!normStart && !normEnd) {
    return {
      status: "No Dates",
      durationDays: 0,
      progressPct: 0,
      daysRemaining: 0,
      daysElapsed: 0,
      isOngoingToday: false,
    };
  }

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const todayTime = today.getTime();

  let startD: Date | null = null;
  let endD: Date | null = null;

  if (normStart) {
    const [y, m, d] = normStart.split("-").map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      startD = new Date(y, m - 1, d);
    }
  }

  if (normEnd) {
    const [y, m, d] = normEnd.split("-").map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      endD = new Date(y, m - 1, d);
    }
  }

  // If only start date is present, default end date to start date + 30 days
  if (startD && !endD) {
    endD = new Date(startD.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else if (!startD && endD) {
    startD = new Date(endD.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (!startD || !endD) {
    return {
      status: "No Dates",
      durationDays: 0,
      progressPct: 0,
      daysRemaining: 0,
      daysElapsed: 0,
      isOngoingToday: false,
    };
  }

  const startTime = startD.getTime();
  const endTime = endD.getTime();
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
    const daysRemaining = Math.ceil((endTime - todayTime) / (1000 * 60 * 60 * 24));
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

/**
 * Combines Sheet1 items, registered Projects, and local Timeline records
 * into a single enriched list sorted by Start Date
 */
export function getAllEnrichedTimelines(
  projects: Project[] = [],
  googleSheetColleges: GoogleSheetCollegeItem[] = []
): EnrichedTimelineItem[] {
  const savedTimelines = loadSavedTimelines();
  const map = new Map<string, CollegeTimelineRecord>();

  // 1. Process Google Sheet 1 items (Col B: Project Code, Col C: College Name, Col L: Start Date, Col M: End Date)
  googleSheetColleges.forEach((sheetItem) => {
    const projCode = (sheetItem.project_code || "").trim();
    const collegeName = (sheetItem.college_name || "").trim();
    if (!projCode && !collegeName) return;

    const key = (projCode || collegeName).toLowerCase();
    map.set(key, {
      id: sheetItem.id || `sheet-${projCode || collegeName}`,
      project_code: projCode,
      college_name: collegeName,
      start_date: sheetItem.training_start_date || "",
      end_date: sheetItem.training_end_date || "",
      academic_year: sheetItem.academic_year || "",
      student_count: sheetItem.student_count || 0,
      course_stream: sheetItem.course_stream || "",
      domain_of_training: sheetItem.domain_of_training || "",
      source: "sheet1",
      updated_at: new Date().toISOString(),
    });
  });

  // 2. Process registered Projects (training phase dates or project dates)
  projects.forEach((proj) => {
    const projCode = (proj.project_code || "").trim();
    const collegeName = (proj.college_name || "").trim();
    if (!projCode && !collegeName) return;

    const key = (projCode || collegeName).toLowerCase();
    const existing = map.get(key);

    const firstPhase = proj.phases && proj.phases.length > 0 ? proj.phases[0] : null;
    const lastPhase = proj.phases && proj.phases.length > 0 ? proj.phases[proj.phases.length - 1] : null;

    const phaseStart = firstPhase?.startDate || "";
    const phaseEnd = lastPhase?.endDate || firstPhase?.endDate || "";

    if (existing) {
      map.set(key, {
        ...existing,
        id: proj.id || existing.id,
        project_code: projCode || existing.project_code,
        college_name: collegeName || existing.college_name,
        start_date: existing.start_date || phaseStart,
        end_date: existing.end_date || phaseEnd,
        academic_year: proj.academic_year || existing.academic_year,
        student_count: proj.student_count || existing.student_count,
        source: "project",
      });
    } else {
      map.set(key, {
        id: proj.id || `proj-${projCode || collegeName}`,
        project_code: projCode,
        college_name: collegeName,
        start_date: phaseStart,
        end_date: phaseEnd,
        academic_year: proj.academic_year || "",
        student_count: proj.student_count || 0,
        source: "project",
        updated_at: proj.updated_at || new Date().toISOString(),
      });
    }
  });

  // 3. Apply manual overrides / user additions
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

  // Sort list: Active first, then Upcoming (soonest start), then Completed, then No Dates
  return enrichedList.sort((a, b) => {
    const statusWeight = { Active: 0, Upcoming: 1, Completed: 2, "No Dates": 3 };
    if (statusWeight[a.status] !== statusWeight[b.status]) {
      return statusWeight[a.status] - statusWeight[b.status];
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
