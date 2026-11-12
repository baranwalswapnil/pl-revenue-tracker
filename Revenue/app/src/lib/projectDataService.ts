// src/lib/projectDataService.ts
// Reads the "Project Data" worksheet and maps rows to GoogleSheetCollegeItem,
// so getAllEnrichedTimelines() and the rest of the timeline keep working unchanged.

import type { GoogleSheetCollegeItem } from "./googleSheetsService";
import { DEFAULT_COLLEGE_TRAINING_ITEMS } from "./googleSheetsService";

export const PROJECT_DATA_SHEET_ID = "1qL-nrVhNlQaD-zeHY7nY3nF2sfgpPKb0";
export const PROJECT_DATA_TAB_NAME = "Project Data";
export const PROJECT_DATA_GID = "1809774664";

const CACHE_KEY = "project_data_timeline_cache_v1";
const OLD_CACHE_KEYS = [
  "college_timeline_records_v1",
  "college_timeline_records_v2",
];

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

export function loadCachedProjectDataItems(): GoogleSheetCollegeItem[] {
  try {
    OLD_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_COLLEGE_TRAINING_ITEMS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COLLEGE_TRAINING_ITEMS;
  } catch {
    return DEFAULT_COLLEGE_TRAINING_ITEMS;
  }
}

export function saveCachedProjectDataItems(items: GoogleSheetCollegeItem[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/* ------------------------------------------------------------------ */
/* CSV parsing (handles quotes, commas and newlines inside cells)      */
/* ------------------------------------------------------------------ */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/* ------------------------------------------------------------------ */
/* Header matching (tolerant: case, spaces, punctuation ignored)       */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// First alias that matches a header wins.
const ALIASES = {
  project_code: ["projectcode", "projectid", "code", "projectno", "projectnumber"],
  college_name: [
    "collegename",
    "college",
    "institutename",
    "institute",
    "institution",
    "clientname",
    "client",
    "organisation",
    "organization",
    "projectname",
  ],
  start_date: [
    "trainingstartdate",
    "startdate",
    "projectstartdate",
    "trainingstart",
    "start",
    "fromdate",
    "from",
    "commencementdate",
  ],
  end_date: [
    "trainingenddate",
    "enddate",
    "projectenddate",
    "trainingend",
    "end",
    "todate",
    "to",
    "completiondate",
  ],
  academic_year: ["academicyear", "ay", "year", "session"],
  student_count: ["studentcount", "students", "nostudents", "numberofstudents", "totalstudents", "strength"],
  course_stream: ["coursestream", "stream", "course", "branch", "department", "domain"],
  assigned_person: ["assignedperson", "assignedto", "trainer", "trainername", "owner", "coordinator", "incharge"],
  description: ["description", "details", "scope", "program", "programme"],
  notes: ["notes", "remarks", "remark", "comment", "comments"],
} as const;

function findColumn(headers: string[], aliases: readonly string[]): number {
  const normalized = headers.map(norm);
  for (const a of aliases) {
    const idx = normalized.indexOf(a);
    if (idx !== -1) return idx;
  }
  // loose "contains" fallback
  for (const a of aliases) {
    if (a.length < 5) continue;
    const idx = normalized.findIndex((h) => h.includes(a));
    if (idx !== -1) return idx;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* Date normalisation -> YYYY-MM-DD ("" if it can't be understood)     */
/* ------------------------------------------------------------------ */

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

function toIso(y: number, m: number, d: number): string {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return "";
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseSheetDate(value: string | undefined): string {
  if (!value) return "";
  const v = value.trim();
  if (!v) return "";

  // 2026-08-17 or 2026/08/17
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return toIso(+m[1], +m[2], +m[3]);

  // 17/08/2026, 17-08-2026, 17.08.26 (Indian day-first)
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    if (b > 12 && a <= 12) [a, b] = [b, a];
    return toIso(+m[3], b, a);
  }

  // 17 Aug 2026, 17-Aug-2026, 17th August, 2026
  m = v.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})[\s,.-]+(\d{2,4})/);
  if (m) {
    const mo = MONTH_MAP[m[2].slice(0, 4).toLowerCase()] || MONTH_MAP[m[2].slice(0, 3).toLowerCase()];
    if (mo) return toIso(+m[3], mo, +m[1]);
  }

  // Aug 17, 2026
  m = v.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})/);
  if (m) {
    const mo = MONTH_MAP[m[1].slice(0, 4).toLowerCase()] || MONTH_MAP[m[1].slice(0, 3).toLowerCase()];
    if (mo) return toIso(+m[3], mo, +m[2]);
  }

  // Excel / Sheets serial number
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const serial = parseFloat(v);
    const ms = Math.round((serial - 25569) * 86400 * 1000);
    const dt = new Date(ms);
    return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  return "";
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

export async function fetchProjectDataItems(sheetUrlOrId?: string): Promise<GoogleSheetCollegeItem[]> {
  const sheetId = sheetUrlOrId
    ? sheetUrlOrId.includes("/d/")
      ? sheetUrlOrId.split("/d/")[1].split("/")[0]
      : sheetUrlOrId
    : PROJECT_DATA_SHEET_ID;

  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  const urls = [
    `${base}&sheet=${encodeURIComponent(PROJECT_DATA_TAB_NAME)}`,
    `${base}&gid=${PROJECT_DATA_GID}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${PROJECT_DATA_GID}`,
  ];

  let csv = "";
  let lastErr = "";
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const text = await res.text();
      // Google returns an HTML sign-in page when the sheet is not public
      if (text.trim().startsWith("<") || text.includes("<!DOCTYPE") || text.includes("Sign in")) {
        lastErr = "Sheet is restricted or requires login";
        continue;
      }
      csv = text;
      break;
    } catch (e: any) {
      lastErr = e?.message || "Network error";
    }
  }

  if (!csv) {
    console.warn(
      `Could not read 'Project Data' tab (${lastErr}). Falling back to cached / default items.`
    );
    const cached = loadCachedProjectDataItems();
    if (cached && cached.length > 0) return cached;
    return DEFAULT_COLLEGE_TRAINING_ITEMS;
  }

  const table = parseCsv(csv);
  if (table.length < 2) return loadCachedProjectDataItems();

  let headerIdx = 0;
  for (let i = 0; i < Math.min(table.length, 10); i++) {
    const hasName = findColumn(table[i], ALIASES.college_name) !== -1;
    const hasStart = findColumn(table[i], ALIASES.start_date) !== -1;
    if (hasName || hasStart) {
      headerIdx = i;
      break;
    }
  }

  const headers = table[headerIdx];
  const col = {
    project_code: findColumn(headers, ALIASES.project_code),
    college_name: findColumn(headers, ALIASES.college_name),
    start_date: findColumn(headers, ALIASES.start_date),
    end_date: findColumn(headers, ALIASES.end_date),
    academic_year: findColumn(headers, ALIASES.academic_year),
    student_count: findColumn(headers, ALIASES.student_count),
    course_stream: findColumn(headers, ALIASES.course_stream),
    assigned_person: findColumn(headers, ALIASES.assigned_person),
    description: findColumn(headers, ALIASES.description),
    notes: findColumn(headers, ALIASES.notes),
  };

  const get = (row: string[], idx: number) => (idx === -1 ? "" : (row[idx] || "").trim());

  const items: GoogleSheetCollegeItem[] = [];
  for (let i = headerIdx + 1; i < table.length; i++) {
    const row = table[i];
    const projectCode = get(row, col.project_code);
    const collegeName = get(row, col.college_name);
    if (!projectCode && !collegeName) continue;

    items.push({
      id: `proj-data-${i}`,
      project_code: projectCode,
      college_name: collegeName,
      academic_year: get(row, col.academic_year),
      student_count: parseInt(get(row, col.student_count).replace(/[^\d]/g, ""), 10) || 0,
      training_start_date: parseSheetDate(get(row, col.start_date)),
      training_end_date: parseSheetDate(get(row, col.end_date)),
      course_stream: get(row, col.course_stream),
      assigned_person: get(row, col.assigned_person),
      description: get(row, col.description),
      notes: get(row, col.notes),
    } as unknown as GoogleSheetCollegeItem);
  }

  if (items.length > 0) {
    saveCachedProjectDataItems(items);
    return items;
  }

  return loadCachedProjectDataItems();
}
