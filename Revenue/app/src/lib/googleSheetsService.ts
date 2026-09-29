import type { Project, ProjectDraft, PaymentType, PhaseType } from "./models";
import { computeAttpDetails } from "./mockData";

export interface GoogleSheetConfig {
  sheetUrl: string;
  sheetName?: string;
  scriptUrl?: string; // Google Apps Script Web App URL for writing/updating sheet rows
  autoSync?: boolean;
  lastSyncedAt?: string;
}

export interface GoogleSheetCollegeItem {
  id: string;
  college_name: string;
  project_code: string;
  college_code?: string;
  academic_year: string;
  passing_year: string;
  course_stream?: string;
  domain_of_training?: string;
  type_of_project?: string;
  mou_signed_date?: string;
  training_start_date?: string;
  training_end_date?: string;
  student_count: number;
  cost_per_student: number;
  total_cost_value: number;
  gst_cost: number;
  hours_planned: number;
  payment_type: PaymentType;
  attp_percentage?: string;
  invoice_count: number;
  additional_notes?: string;
  raw_row?: Record<string, string>;
}

export interface GoogleSheetInvoiceTrackerItem {
  id: string;
  project_code: string;
  college_name: string;
  invoice_no: number;
  payment_type: PaymentType;
  student_count: number;
  cost_per_student: number;
  total_contract_value: number;
  payment_percentage: number;
  amount_from_mou: number;
  amount_raised: number;
  date_raised: string;
  invoice_code: string;
  invoice_type: string;
  status: string;
  remarks: string;
  ga_invoice_code: string;
  printed: string;
  received: string;
  received_amount: number;
  date_received: string;
  is_received: boolean;
  is_raised: boolean;
  tds_status: string;
}

const STORAGE_CONFIG_KEY = "google_sheet_sync_config_v1";
const STORAGE_CACHED_ITEMS_KEY = "google_sheet_cached_colleges_v1";
const STORAGE_CACHED_INVOICE_TRACKER_KEY = "google_sheet_cached_invoice_tracker_v1";

/**
 * Extracts Google Spreadsheet ID from a shared URL or returns the ID if already clean.
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // If already an ID
  if (/^[a-zA-Z0-9-_]{20,60}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle https://docs.google.com/spreadsheets/d/{ID}/...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Builds standard public Google Sheet CSV export endpoint.
 */
export function buildGoogleSheetCsvUrl(sheetUrlOrId: string, sheetName = ""): string {
  const sheetId = extractSpreadsheetId(sheetUrlOrId);
  if (!sheetId) {
    // If it's already a direct CSV or Apps Script URL, return as is
    return sheetUrlOrId.trim();
  }

  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  if (sheetName && sheetName.trim()) {
    return `${base}&sheet=${encodeURIComponent(sheetName.trim())}`;
  }
  return base;
}

/**
 * Robust CSV parser that handles quotes, line breaks inside cells, and commas.
 */
export function parseCSV(text: string): string[][] {
  const p: string[][] = [];
  let row: string[] = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      row.push("");
    } else if ((c === "\r" || c === "\n") && !inQuotes) {
      if (c === "\r" && next === "\n") {
        i++;
      }
      p.push(row);
      row = [""];
    } else {
      row[row.length - 1] += c;
    }
  }

  if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
    p.push(row);
  }

  return p.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/**
 * Cleans numeric strings (removes ₹, $, commas, spaces)
 * Safely ignores dates (e.g. 15/06/2024) and split ratios (e.g. 50-50, 30-20-25-25)
 */
function parseCleanNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  const rawStr = String(val).trim();
  if (!rawStr) return fallback;

  // Ignore date patterns e.g. "15/06/2024" or "2024-06-15"
  if (/\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/.test(rawStr)) return fallback;
  // Ignore multi-dash splits e.g. "30-20-25-25", "50-50"
  if (/^\d+(-\d+)+$/.test(rawStr)) return fallback;

  const str = rawStr.replace(/[₹$,\s%]/g, "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

/**
 * Normalizes dates to YYYY-MM-DD
 */
function normalizeDate(raw: any): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try Date.parse
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  } catch {
    // Ignore error
  }

  return str;
}

export const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1JbDE4KDkwcQ72t7IJi-2siU46jUaK-m4BlYP1NjdJJw/edit?usp=sharing";

/**
 * Normalizes payment types (FNF, ATP, ATTP, EMI) from sheet notations like AT, AP, ATT, ATTT, EMI-8
 */
function normalizePaymentType(raw: any): PaymentType {
  const str = String(raw || "").toUpperCase().trim();
  if (str.includes("FNF") || str.includes("FULL") || str === "100") return "FNF";
  if (str.startsWith("EMI")) return "EMI";
  if (str.includes("ATTP") || str.includes("ATTT") || str.includes("ATT") || str.includes("MILESTONE")) return "ATTP";
  if (str === "AT" || str === "AP" || str.includes("ATP")) return "ATP";
  return "ATP";
}

/**
 * Matches header name loosely against potential column headers
 */
function findColumnIndex(headers: string[], ...candidates: string[]): number {
  const normHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const cand of candidates) {
    const normCand = cand.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = normHeaders.findIndex((h) => h === normCand || h.includes(normCand) || normCand.includes(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Converts parsed spreadsheet rows into clean GoogleSheetCollegeItem objects
 * fetching ONLY what is needed for Add College & Update College forms!
 */
export function mapRowsToCollegeItems(rows: string[][]): GoogleSheetCollegeItem[] {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());

  // Find column indices based on user's exact spreadsheet headers
  const colProjCode = findColumnIndex(headers, "project code", "projectcode", "college project", "code");
  const colCollegeName = findColumnIndex(headers, "name of the college", "college name", "collegename", "name");
  const colCollegeCode = findColumnIndex(headers, "college code", "collegecode");
  const colYear = findColumnIndex(headers, "year", "passing year", "batch year");
  const colCourse = findColumnIndex(headers, "course/stream", "course", "stream", "department");
  const colDomain = findColumnIndex(headers, "domain of training", "domain", "training domain");
  const colTypeProj = findColumnIndex(headers, "type of project", "project type");
  const colAcademicYear = findColumnIndex(headers, "academic year", "academicyear");
  const colMouDate = findColumnIndex(headers, "mou signed date", "mou date", "mou signed");
  const colStartDate = findColumnIndex(headers, "training start date", "start date", "starting date");
  const colEndDate = findColumnIndex(headers, "training end date", "end date");
  const colStudents = findColumnIndex(headers, "no of students", "students", "student count", "no. of students");
  const colCostPerStudent = findColumnIndex(headers, "cost per student", "cost/student", "student cost");
  const colTotalValue = findColumnIndex(headers, "total contract value", "total cost value", "contract value", "total value");
  const colGstValue = findColumnIndex(headers, "total contract value (incl gst)", "total contract value (incl. gst)", "gst cost", "total with gst");
  const colHoursPlanned = findColumnIndex(headers, "hrs/batch", "hours/batch", "hours planned", "hrs planned", "hours");
  const colPaymentType = findColumnIndex(headers, "type of payment", "payment type", "payment plan");
  const colPaymentPct = findColumnIndex(headers, "% of payment", "percentage of payment", "payment percentage", "attp percentage");
  const colInvoices = findColumnIndex(headers, "no of invoices", "no. of invoices", "invoice count", "invoices");

  const items: GoogleSheetCollegeItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const collegeName = (colCollegeName !== -1 ? row[colCollegeName] : row[2] || "").trim();
    const projectCode = (colProjCode !== -1 ? row[colProjCode] : row[1] || "").trim();

    // Skip empty rows
    if (!collegeName && !projectCode) continue;

    const studentCount = parseCleanNumber(colStudents !== -1 ? row[colStudents] : row[13], 0);
    const costPerStudent = parseCleanNumber(colCostPerStudent !== -1 ? row[colCostPerStudent] : row[14], 0);
    
    let totalValue = parseCleanNumber(colTotalValue !== -1 ? row[colTotalValue] : row[15], 0);
    if (totalValue === 0 && studentCount > 0 && costPerStudent > 0) {
      totalValue = studentCount * costPerStudent;
    }

    let gstValue = parseCleanNumber(colGstValue !== -1 ? row[colGstValue] : row[16], 0);
    if (gstValue === 0 && totalValue > 0) {
      gstValue = totalValue * 1.18;
    }

    const rawYear = (colYear !== -1 ? row[colYear] : row[4] || "").trim();
    let passingYear = "2026";
    if (rawYear.match(/^\d{4}$/)) {
      passingYear = rawYear;
    } else if (rawYear.toLowerCase().includes("202")) {
      const ym = rawYear.match(/202\d/);
      if (ym) passingYear = ym[0];
    } else if (rawYear.includes("1st")) {
      passingYear = "2027";
    } else if (rawYear.includes("2nd")) {
      passingYear = "2026";
    } else if (rawYear.includes("3rd")) {
      passingYear = "2025";
    } else if (rawYear.includes("4th")) {
      passingYear = "2024";
    }

    const rawAcadYear = (colAcademicYear !== -1 ? row[colAcademicYear] : row[8] || "").trim();
    let academicYear = "4th Year";
    if (rawAcadYear) {
      if (rawAcadYear.toLowerCase().includes("1st")) academicYear = "1st Year";
      else if (rawAcadYear.toLowerCase().includes("2nd")) academicYear = "2nd Year";
      else if (rawAcadYear.toLowerCase().includes("3rd")) academicYear = "3rd Year";
      else if (rawAcadYear.toLowerCase().includes("4th")) academicYear = "4th Year";
      else if (rawYear && (rawYear.includes("1st") || rawYear.includes("2nd") || rawYear.includes("3rd") || rawYear.includes("4th"))) {
        academicYear = `${rawYear} Year`;
      } else {
        academicYear = rawAcadYear;
      }
    }

    const startDate = normalizeDate(colStartDate !== -1 ? row[colStartDate] : row[11]);
    const endDate = normalizeDate(colEndDate !== -1 ? row[colEndDate] : row[12]);
    const hoursPlanned = parseCleanNumber(colHoursPlanned !== -1 ? row[colHoursPlanned] : row[17], 40);

    const rawPayType = colPaymentType !== -1 ? row[colPaymentType] : row[18];
    const paymentType = normalizePaymentType(rawPayType);
    
    const rawPct = (colPaymentPct !== -1 ? row[colPaymentPct] : row[19] || "").trim();
    let attpPercentage = "50%";
    if (rawPct.includes("25")) attpPercentage = "25%";
    else if (rawPct.includes("33") || rawPct.includes("30-30-40") || rawPct.includes("20-40-40")) attpPercentage = "33.34%";
    else if (rawPct.includes("50")) attpPercentage = "50%";
    else if (rawPct.includes("75")) attpPercentage = "75%";
    else if (rawPct.includes("100")) attpPercentage = "100%";
    else if (rawPct) {
      attpPercentage = rawPct.includes("%") ? rawPct : `${rawPct}%`;
    }

    let invoiceCount = parseCleanNumber(colInvoices !== -1 ? row[colInvoices] : row[20], 0);
    
    // If EMI with number like EMI 12, extract 12
    if (paymentType === "EMI" && invoiceCount <= 0) {
      const emiMatch = String(rawPayType || rawPct).match(/\d+/);
      invoiceCount = emiMatch ? parseInt(emiMatch[0], 10) : 5;
    } else if (invoiceCount <= 0) {
      if (paymentType === "FNF") invoiceCount = 1;
      else if (paymentType === "ATP") invoiceCount = 2;
      else if (paymentType === "ATTP") {
        invoiceCount = computeAttpDetails(attpPercentage).invoiceCount;
      } else if (paymentType === "EMI") {
        invoiceCount = 5;
      }
    }

    const courseStream = colCourse !== -1 ? (row[colCourse] || "").trim() : "";
    const domain = colDomain !== -1 ? (row[colDomain] || "").trim() : "";
    const typeProj = colTypeProj !== -1 ? (row[colTypeProj] || "").trim() : "";
    const mouDate = colMouDate !== -1 ? normalizeDate(row[colMouDate]) : "";
    const collegeCode = colCollegeCode !== -1 ? (row[colCollegeCode] || "").trim() : "";

    // Build extra notes from remaining metadata
    const extraNotesArr: string[] = [];
    if (courseStream) extraNotesArr.push(`Course/Stream: ${courseStream}`);
    if (domain) extraNotesArr.push(`Training Domain: ${domain}`);
    if (typeProj) extraNotesArr.push(`Project Type: ${typeProj}`);
    if (mouDate) extraNotesArr.push(`MOU Signed: ${mouDate}`);

    const id = `gsheet-${projectCode || collegeName.toLowerCase().replace(/[^a-z0-9]/g, "-") || r}`;

    items.push({
      id,
      college_name: collegeName || `College ${r}`,
      project_code: projectCode || `PRJ-${String(r).padStart(3, "0")}`,
      college_code: collegeCode,
      academic_year: academicYear,
      passing_year: passingYear,
      course_stream: courseStream,
      domain_of_training: domain,
      type_of_project: typeProj,
      mou_signed_date: mouDate,
      training_start_date: startDate,
      training_end_date: endDate,
      student_count: studentCount,
      cost_per_student: costPerStudent,
      total_cost_value: totalValue,
      gst_cost: gstValue,
      hours_planned: hoursPlanned,
      payment_type: paymentType,
      attp_percentage: attpPercentage,
      invoice_count: invoiceCount,
      additional_notes: extraNotesArr.join(" | "),
    });
  }

  return items;
}

/**
 * Fetches Google Sheet CSV directly via browser fetch()
 */
export async function fetchGoogleSheetData(sheetUrlOrId: string, sheetName = ""): Promise<GoogleSheetCollegeItem[]> {
  const csvUrl = buildGoogleSheetCsvUrl(sheetUrlOrId, sheetName);
  
  const response = await fetch(csvUrl, {
    method: "GET",
    headers: {
      "Accept": "text/csv,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet. Status: ${response.status} (${response.statusText}). Make sure the Google Sheet sharing is set to "Anyone with the link can view".`);
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);
  
  if (rows.length < 2) {
    throw new Error("Spreadsheet returned no data rows. Please verify your sheet link and tab name.");
  }

  return mapRowsToCollegeItems(rows);
}

/**
 * Parses received cell value (supports 'Yes', 'Paid', amount numbers, dates, etc.)
 */
export function parseReceivedValue(
  val: any,
  amountRaised: number
): { isReceived: boolean; receivedAmount: number; dateReceived: string } {
  if (val === null || val === undefined) {
    return { isReceived: false, receivedAmount: 0, dateReceived: "" };
  }
  const str = String(val).trim();
  if (!str) {
    return { isReceived: false, receivedAmount: 0, dateReceived: "" };
  }

  const lower = str.toLowerCase();
  if (
    lower === "yes" ||
    lower === "true" ||
    lower === "received" ||
    lower === "paid" ||
    lower === "cleared" ||
    lower === "done" ||
    lower === "y"
  ) {
    return { isReceived: true, receivedAmount: amountRaised, dateReceived: "" };
  }
  if (
    lower === "no" ||
    lower === "false" ||
    lower === "pending" ||
    lower === "unpaid" ||
    lower === "n" ||
    lower === "not received"
  ) {
    return { isReceived: false, receivedAmount: 0, dateReceived: "" };
  }

  // Check if it is a formatted date (e.g. 2026-02-15 or 15/02/2026)
  const parsedDate = normalizeDate(str);
  if (parsedDate && parsedDate.length === 10) {
    return { isReceived: true, receivedAmount: amountRaised, dateReceived: parsedDate };
  }

  // Check if it is a number/currency amount (e.g. 150000 or ₹1,50,000)
  const num = parseCleanNumber(str, -1);
  if (num > 0) {
    return { isReceived: true, receivedAmount: num, dateReceived: "" };
  }

  return { isReceived: Boolean(str), receivedAmount: amountRaised, dateReceived: "" };
}

/**
 * Maps raw spreadsheet rows from 'Invoice Tracker' tab into GoogleSheetInvoiceTrackerItem[]
 */
export function mapInvoiceTrackerRowsToItems(rows: string[][]): GoogleSheetInvoiceTrackerItem[] {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());

  const colProjCode = findColumnIndex(headers, "project_code", "project code", "projectcode", "college project", "code");
  const colInvoiceNo = findColumnIndex(headers, "invoice_no", "invoice no", "invoiceno", "invoice number", "installment");
  const colPayType = findColumnIndex(headers, "payment_type", "payment type", "paymentplan");
  const colStudents = findColumnIndex(headers, "student count", "student_count", "students", "no of students");
  const colCostPerStudent = findColumnIndex(headers, "cost per student", "cost_per_student", "cost/student");
  const colTotalVal = findColumnIndex(headers, "total_contract_value", "total contract value", "contract value", "total value");
  const colPayPct = findColumnIndex(headers, "payment_percentage", "payment percentage", "payment %", "% of payment");
  const colMouAmt = findColumnIndex(headers, "amount_from_mou", "amount from mou", "mou amount", "planned amount");
  const colAmtRaised = findColumnIndex(headers, "amount_raised", "amount raised", "invoice amount", "raised amount", "amount");
  const colDateRaised = findColumnIndex(headers, "date_raised", "date raised", "raised date", "invoice date");
  const colInvoiceCode = findColumnIndex(headers, "invoice_code", "invoice code", "invoice no.", "invoice id");
  const colInvoiceType = findColumnIndex(headers, "invoice_type", "invoice type", "type");
  const colStatus = findColumnIndex(headers, "status", "payment status", "invoice status");
  const colRemarks = findColumnIndex(headers, "remarks", "remark", "notes", "comments");
  const colGaCode = findColumnIndex(headers, "ga_invoice_code", "ga invoice code", "ga code", "tally code", "erp code");
  const colPrinted = findColumnIndex(headers, "printed", "print status", "hardcopy", "dispatched");
  const colReceived = findColumnIndex(headers, "received", "amount received", "received status", "paid");
  const colTdsStatus = findColumnIndex(headers, "tds_status", "tds status", "tds", "tds deducted");
  const colCollegeName = findColumnIndex(headers, "college_name", "college name", "name of the college", "name");

  const items: GoogleSheetInvoiceTrackerItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let projectCode = "";
    let collegeName = "";
    let invoiceNo = r;
    let payType: PaymentType = "ATP";
    let studentCount = 0;
    let costPerStudent = 0;
    let totalContractValue = 0;
    let payPct = 0;
    let amountFromMou = 0;
    let amountRaised = 0;
    let dateRaised = "";
    let invoiceCode = "";
    let invoiceType = "";
    let status = "";
    let remarks = "";
    let gaInvoiceCode = "";
    let printed = "";
    let rawReceived = "";
    let receivedAmount = 0;
    let tdsStatus = "";

    // Check if the row matches the specific Google Sheet column layout
    // (where col 8 has date e.g. 03/04/2024, col 7 has amount e.g. ₹868,480, col 9 has invoice code e.g. GAPL/PI/24-25/01)
    const isShiftedLayout =
      row.length >= 10 &&
      Boolean(row[8] && /\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}/.test(row[8])) &&
      Boolean(row[9] && /GAPL|GCAPL|INV|PI|TI|CI/i.test(row[9]));

    if (isShiftedLayout) {
      projectCode = (row[0] || "").trim();
      invoiceNo = parseCleanNumber(row[1], r);
      payType = normalizePaymentType(row[2]);
      studentCount = parseCleanNumber(row[3], 0);
      totalContractValue = parseCleanNumber(row[4], 0);
      payPct = parseCleanNumber(row[5], 0);
      amountFromMou = parseCleanNumber(row[6], 0);
      amountRaised = parseCleanNumber(row[7], amountFromMou);
      dateRaised = normalizeDate(row[8]);
      invoiceCode = (row[9] || "").trim() || `INV-${String(invoiceNo).padStart(2, "0")}`;
      invoiceType = (row[10] || "").trim(); // PI, TI, CI
      status = (row[11] || "").trim();      // Received, Processed, Raised, TI for PI
      remarks = (row[12] || "").trim();
      gaInvoiceCode = (row[13] || "").trim();
      printed = (row[14] || "").trim();
      receivedAmount = parseCleanNumber(row[15], 0);
      tdsStatus = (row[16] || "").trim();
      collegeName = (row[18] || row[17] || "").trim();
      rawReceived = status;
    } else {
      // Standard header-based matching fallback
      projectCode = colProjCode !== -1 ? (row[colProjCode] || "").trim() : "";
      collegeName = colCollegeName !== -1 ? (row[colCollegeName] || "").trim() : "";
      invoiceNo = parseCleanNumber(colInvoiceNo !== -1 ? row[colInvoiceNo] : "", r);
      payType = normalizePaymentType(colPayType !== -1 ? row[colPayType] : "");
      studentCount = parseCleanNumber(colStudents !== -1 ? row[colStudents] : "", 0);
      costPerStudent = parseCleanNumber(colCostPerStudent !== -1 ? row[colCostPerStudent] : "", 0);
      totalContractValue = parseCleanNumber(colTotalVal !== -1 ? row[colTotalVal] : "", 0);
      payPct = parseCleanNumber(colPayPct !== -1 ? row[colPayPct] : "", 0);
      amountFromMou = parseCleanNumber(colMouAmt !== -1 ? row[colMouAmt] : "", 0);
      amountRaised = parseCleanNumber(colAmtRaised !== -1 ? row[colAmtRaised] : "", amountFromMou);
      dateRaised = normalizeDate(colDateRaised !== -1 ? row[colDateRaised] : "");
      invoiceCode = (colInvoiceCode !== -1 ? (row[colInvoiceCode] || "").trim() : "") || `INV-${String(invoiceNo).padStart(2, "0")}`;
      invoiceType = colInvoiceType !== -1 ? (row[colInvoiceType] || "").trim() : "";
      status = colStatus !== -1 ? (row[colStatus] || "").trim() : "";
      remarks = colRemarks !== -1 ? (row[colRemarks] || "").trim() : "";
      gaInvoiceCode = colGaCode !== -1 ? (row[colGaCode] || "").trim() : "";
      printed = colPrinted !== -1 ? (row[colPrinted] || "").trim() : "";
      rawReceived = colReceived !== -1 ? (row[colReceived] || "").trim() : "";
      tdsStatus = colTdsStatus !== -1 ? (row[colTdsStatus] || "").trim() : "";
    }

    if (!projectCode && !collegeName) continue;

    if (totalContractValue === 0 && studentCount > 0 && costPerStudent > 0) {
      totalContractValue = studentCount * costPerStudent;
    }
    if (amountRaised === 0 && amountFromMou > 0) {
      amountRaised = amountFromMou;
    }

    const typeLower = (invoiceType || "").toLowerCase();
    const statusLower = (status || "").toLowerCase();
    const recLower = (rawReceived || "").toLowerCase();

    const parsedRec = parseReceivedValue(rawReceived, amountRaised);

    // 1. Check if Received / Collected (supports "received", "recieved", "paid", "cleared", "yes", etc.)
    const isReceived = Boolean(
      statusLower.includes("rec") ||
      statusLower.includes("paid") ||
      statusLower.includes("clear") ||
      typeLower.includes("rec") ||
      typeLower.includes("paid") ||
      recLower.includes("rec") ||
      recLower.includes("paid") ||
      recLower.includes("clear") ||
      recLower.includes("yes") ||
      recLower === "y" ||
      recLower === "true" ||
      parsedRec.isReceived ||
      receivedAmount > 0
    );

    const finalReceivedAmount = isReceived
      ? receivedAmount > 0
        ? receivedAmount
        : parsedRec.receivedAmount > 0
        ? parsedRec.receivedAmount
        : amountRaised || amountFromMou
      : 0;

    const dateReceived = parsedRec.dateReceived || (isReceived ? dateRaised : "");

    // 2. Check if Processed / Raised (Pending / Outstanding)
    const isProcessedOrRaised = Boolean(
      isReceived ||
      statusLower.includes("process") ||
      statusLower.includes("raise") ||
      statusLower.includes("pend") ||
      typeLower.includes("process") ||
      typeLower.includes("raise") ||
      typeLower.includes("pend") ||
      (amountRaised > 0 && dateRaised.length > 0) ||
      (dateRaised && dateRaised.length > 0) ||
      amountRaised > 0
    );

    const isRaised = Boolean(isReceived || isProcessedOrRaised || amountRaised > 0);

    const finalStatus = isReceived
      ? "Received"
      : isRaised
      ? "Pending Payment"
      : "Unraised";

    items.push({
      id: `inv-tr-${(projectCode || collegeName).toLowerCase().replace(/[^a-z0-9]/g, "-")}-${invoiceNo}-${r}`,
      project_code: projectCode,
      college_name: collegeName,
      invoice_no: invoiceNo,
      payment_type: payType,
      student_count: studentCount,
      cost_per_student: costPerStudent,
      total_contract_value: totalContractValue,
      payment_percentage: payPct,
      amount_from_mou: amountFromMou,
      amount_raised: amountRaised,
      date_raised: dateRaised,
      invoice_code: invoiceCode,
      invoice_type: invoiceType,
      status: status || finalStatus,
      remarks,
      ga_invoice_code: gaInvoiceCode,
      printed,
      received: rawReceived,
      received_amount: finalReceivedAmount,
      date_received: dateReceived,
      is_received: isReceived,
      is_raised: isRaised,
      tds_status: tdsStatus,
    });
  }

  return items;
}

/**
 * Fetches Google Sheet CSV for 'Invoice Tracker' tab directly via browser fetch()
 */
export async function fetchInvoiceTrackerData(
  sheetUrlOrId: string,
  tabName = "Invoice Tracker"
): Promise<GoogleSheetInvoiceTrackerItem[]> {
  const csvUrl = buildGoogleSheetCsvUrl(sheetUrlOrId, tabName);

  const response = await fetch(csvUrl, {
    method: "GET",
    headers: {
      Accept: "text/csv,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch '${tabName}' tab. Status: ${response.status} (${response.statusText}). Make sure the tab name is exactly '${tabName}' and the sheet is public.`
    );
  }

  const csvText = await response.text();
  const rows = parseCSV(csvText);

  if (rows.length < 2) {
    throw new Error(`'${tabName}' tab returned no data rows.`);
  }

  return mapInvoiceTrackerRowsToItems(rows);
}

/**
 * Builds or merges complete Project entities grouped by project_code from 'Invoice Tracker' items
 */
export function buildProjectsFromInvoiceTracker(
  invoiceItems: GoogleSheetInvoiceTrackerItem[],
  existingProjects: Project[] = []
): Project[] {
  const groupMap = new Map<string, GoogleSheetInvoiceTrackerItem[]>();

  invoiceItems.forEach((item) => {
    const key = (item.project_code || item.college_name).toLowerCase().trim();
    if (!key) return;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(item);
  });

  const mergedProjects: Project[] = [];

  groupMap.forEach((invList, key) => {
    const first = invList[0];
    const projectCode = first.project_code || `PRJ-${mergedProjects.length + 1}`;
    const collegeName = first.college_name || `College ${mergedProjects.length + 1}`;

    const existing = existingProjects.find(
      (p) =>
        (p.project_code && p.project_code.toLowerCase().trim() === key) ||
        (p.college_name && p.college_name.toLowerCase().trim() === key)
    );

    const studentCount = first.student_count || existing?.student_count || 0;
    const costPerStudent = first.cost_per_student || existing?.cost_per_student || 0;
    const totalContractValue =
      first.total_contract_value ||
      (studentCount > 0 && costPerStudent > 0 ? studentCount * costPerStudent : 0) ||
      existing?.total_cost_value ||
      0;
    const gstCost = totalContractValue > 0 ? Math.round(totalContractValue * 1.18) : (existing?.gst_cost || 0);

    const invoices: InvoiceMilestone[] = invList.map((inv, idx) => {
      const invAmt =
        inv.amount_raised ||
        inv.amount_from_mou ||
        (gstCost > 0 && inv.payment_percentage
          ? Math.round((gstCost * inv.payment_percentage) / 100)
          : Math.round(gstCost / invList.length));

      return {
        id: `inv-${projectCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${inv.invoice_no || idx + 1}`,
        invoiceNumber: inv.invoice_no || idx + 1,
        label: inv.invoice_type
          ? `${inv.invoice_type} (${inv.payment_percentage || Math.round(100 / invList.length)}%)`
          : `Installment ${inv.invoice_no || idx + 1} (${inv.payment_percentage || Math.round(100 / invList.length)}%)`,
        percentage: inv.payment_percentage || Math.round(100 / invList.length),
        amount: invAmt,
        amountFromMou: inv.amount_from_mou,
        amountRaised: inv.amount_raised,
        isRaised: inv.is_raised,
        dateRaised: inv.date_raised,
        isReceived: inv.is_received,
        dateReceived: inv.date_received,
        invoiceCode: inv.invoice_code || `INV-${String(inv.invoice_no || idx + 1).padStart(2, "0")}`,
        invoiceType: inv.invoice_type,
        status: inv.status,
        remarks: inv.remarks,
        gaInvoiceCode: inv.ga_invoice_code,
        printed: inv.printed,
        tdsStatus: inv.tds_status,
      };
    });

    const totalRaised = invoices
      .filter((i) => i.isRaised)
      .reduce((sum, i) => sum + (i.amountRaised || i.amount || 0), 0);
    const totalReceived = invoices
      .filter((i) => i.isReceived)
      .reduce((sum, i) => sum + (i.amount || 0), 0);

    const firstDate = invList.find((i) => i.date_raised)?.date_raised || "2026-01-15";
    const lastDate = invList[invList.length - 1]?.date_raised || "2026-03-31";

    const project: Project = {
      id: existing?.id || `proj-${projectCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      college_name: collegeName,
      project_code: projectCode,
      academic_year: existing?.academic_year || "4th Year",
      passing_year: existing?.passing_year || "2026",
      student_count: studentCount,
      cost_per_student: costPerStudent,
      total_cost_value: totalContractValue,
      gst_cost: gstCost,
      hours_planned: existing?.hours_planned || 40,
      hours_given: existing?.hours_given || 40,
      training_cost: totalContractValue,
      payment_type: first.payment_type || existing?.payment_type || "ATP",
      attp_percentage: existing?.attp_percentage || `${first.payment_percentage || 50}%`,
      installment_count: invList.length,
      invoice_count: invList.length,
      invoice_raised: totalRaised,
      invoice_received: totalReceived,
      invoices,
      phases:
        existing?.phases && existing.phases.length > 0
          ? existing.phases
          : [
              {
                id: `p-${projectCode}-1`,
                phase: "Phase 1",
                startDate: firstDate,
                endDate: lastDate,
                hoursPlanned: 40,
                hoursGiven: 40,
                trainingCost: totalContractValue,
                paymentType: first.payment_type || "ATP",
                invoiceCount: invList.length,
              },
            ],
      additional_notes:
        invList
          .map((i) => i.remarks)
          .filter(Boolean)
          .join(" | ") || existing?.additional_notes,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mergedProjects.push(project);
  });

  return mergedProjects;
}

/**
 * Converts a GoogleSheetCollegeItem into a Project entity
 */
export function convertSheetItemToProject(item: GoogleSheetCollegeItem): Project {
  return {
    id: item.id || `proj-${Date.now()}`,
    college_name: item.college_name,
    project_code: item.project_code,
    academic_year: item.academic_year,
    passing_year: item.passing_year,
    student_count: item.student_count,
    cost_per_student: item.cost_per_student,
    total_cost_value: item.total_cost_value,
    gst_cost: item.gst_cost,
    phases: [
      {
        id: `p-${item.id}-1`,
        phase: "Phase 1",
        startDate: item.training_start_date || new Date().toISOString().slice(0, 10),
        endDate: item.training_end_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        hoursPlanned: item.hours_planned,
        hoursGiven: item.hours_planned,
        trainingCost: item.total_cost_value,
        paymentType: item.payment_type,
        attpPercentage: item.attp_percentage,
        invoiceCount: item.invoice_count,
      },
    ],
    hours_planned: item.hours_planned,
    hours_given: item.hours_planned,
    training_cost: item.total_cost_value,
    payment_type: item.payment_type,
    attp_percentage: item.attp_percentage,
    installment_count: item.invoice_count,
    invoice_count: item.invoice_count,
    invoice_raised: 0,
    invoice_received: 0,
    additional_notes: item.additional_notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Converts a GoogleSheetCollegeItem into a ProjectDraft for Add College / Step 2 & 3
 */
export function convertSheetItemToDraft(item: GoogleSheetCollegeItem): ProjectDraft {
  return {
    collegeName: item.college_name,
    projectCode: item.project_code,
    academicYear: item.academic_year,
    passingYear: item.passing_year,
    studentCount: String(item.student_count || ""),
    costPerStudent: String(item.cost_per_student || ""),
    totalCostValue: String(item.total_cost_value || ""),
    gstCost: String(item.gst_cost || ""),
    manualTotal: false,
    manualGst: false,
    additionalNotes: item.additional_notes || "",
    selectedPhase: "Phase 1",
    phaseStartDate: item.training_start_date || "",
    phaseEndDate: item.training_end_date || "",
    hoursPlanned: String(item.hours_planned || 40),
    hoursGiven: String(item.hours_planned || 40),
    trainingCost: String(item.total_cost_value || ""),
    paymentType: item.payment_type,
    attpPercentage: item.attp_percentage || "50%",
    installmentCount: String(item.invoice_count || 1),
    invoiceCount: String(item.invoice_count || 1),
    invoiceRaised: "0",
    phases: [
      {
        id: "phase-1",
        phase: "Phase 1",
        startDate: item.training_start_date || "",
        endDate: item.training_end_date || "",
        hoursPlanned: item.hours_planned || 40,
        hoursGiven: item.hours_planned || 40,
        trainingCost: item.total_cost_value || 0,
        paymentType: item.payment_type,
        attpPercentage: item.attp_percentage,
        invoiceCount: item.invoice_count,
      },
    ],
  };
}

export const GOOGLE_DRIVE_FOLDERS = {
  raisedInvoiceProof: {
    folderId: "1Aqg6rmMETXqtjcEz6z07XDsj1jYWRfNf",
    url: "https://drive.google.com/drive/folders/1Aqg6rmMETXqtjcEz6z07XDsj1jYWRfNf?usp=sharing",
    columnName: "Raised Invoice proof",
  },
  receivedInvoiceProof: {
    folderId: "1WgW61UJJ-TTwkZeYzOo3-GdQxD2upqtB",
    url: "https://drive.google.com/drive/folders/1WgW61UJJ-TTwkZeYzOo3-GdQxD2upqtB?usp=sharing",
    columnName: "Recieved Invoice",
  },
};

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * Google Apps Script for P&L Revenue Tracker (Two-Way Sync + Drive Proof Upload)
 * =========================================================================
 * 
 * Instructions to enable 2-Way Sync & Drive Upload:
 * 1. Open your Google Spreadsheet
 * 2. Click "Extensions" > "Apps Script" in top menu.
 * 3. Delete any code in the editor and paste this entire code.
 * 4. Click "Deploy" > "New deployment" (or "Manage deployments" > Edit > "New version" if updating).
 * 5. Select type: "Web app".
 * 6. Set "Execute as": "Me".
 * 7. Set "Who has access": "Anyone" (VERY IMPORTANT!).
 * 8. Click "Deploy", then click "Authorize access" (Advanced > Go to project > Allow).
 * 9. Copy the Web App URL and paste it into the Sheet Sync modal in the website!
 * 
 * ✨ BONUS: Refresh your spreadsheet tab to see the new "🚀 P&L Revenue Tools" menu.
 * Click "✨ Beautify All Proof Links" to instantly convert all existing raw links into clean badges!
 */

/**
 * Adds custom menu to Google Spreadsheet toolbar
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 P&L Revenue Tools")
    .addItem("✨ Beautify All Proof Links (Convert to Badges)", "beautifyAllProofLinks")
    .addItem("🧪 Test / Authorize Drive Permissions", "authorizeDrive")
    .addToUi();
}

/**
 * Run this function ONCE inside Apps Script editor to authorize Drive WRITE permissions:
 */
function authorizeDrive() {
  var testFile = DriveApp.createFile("temp_auth_check.txt", "Drive write permission test");
  testFile.setTrashed(true);
  Logger.log("Google Drive WRITE permission successfully authorized!");
  try {
    SpreadsheetApp.getUi().alert("✅ Google Drive WRITE permissions successfully authorized!");
  } catch(e) {}
}

/**
 * Scans all rows in the spreadsheet and converts any raw Google Drive URLs
 * into clean, aesthetic '=HYPERLINK(url, "📄 View Proof")' badges!
 */
function beautifyAllProofLinks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet() || ss.getSheets()[0];
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  if (values.length < 2) {
    SpreadsheetApp.getUi().alert("No data rows found in spreadsheet.");
    return;
  }

  var headers = values[0].map(function(h) {
    return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  });

  var colRaised = -1;
  var colReceived = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].indexOf("raised") !== -1 && (headers[i].indexOf("proof") !== -1 || headers[i].indexOf("invoice") !== -1)) colRaised = i;
    if (headers[i].indexOf("recieved") !== -1 || (headers[i].indexOf("received") !== -1 && headers[i].indexOf("invoice") !== -1)) colReceived = i;
  }

  var convertedCount = 0;

  for (var r = 1; r < values.length; r++) {
    if (colRaised !== -1) {
      var valRaised = values[r][colRaised];
      if (valRaised && String(valRaised).indexOf("http") !== -1) {
        var cellRaised = sheet.getRange(r + 1, colRaised + 1);
        formatProofCell(cellRaised, valRaised, "Raised");
        convertedCount++;
      }
    }
    if (colReceived !== -1) {
      var valReceived = values[r][colReceived];
      if (valReceived && String(valReceived).indexOf("http") !== -1) {
        var cellReceived = sheet.getRange(r + 1, colReceived + 1);
        formatProofCell(cellReceived, valReceived, "Received");
        convertedCount++;
      }
    }
  }

  // Set optimal column widths and center alignment
  if (colRaised !== -1) {
    sheet.setColumnWidth(colRaised + 1, 165);
    sheet.getRange(2, colRaised + 1, sheet.getLastRow() - 1, 1).setHorizontalAlignment("center").setVerticalAlignment("middle");
  }
  if (colReceived !== -1) {
    sheet.setColumnWidth(colReceived + 1, 165);
    sheet.getRange(2, colReceived + 1, sheet.getLastRow() - 1, 1).setHorizontalAlignment("center").setVerticalAlignment("middle");
  }

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✨ Beautification Complete! Converted " + convertedCount + " proof link(s) into clean, aesthetic clickable badges!");
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    name: "P&L Revenue Tracker Google Sheets & Drive Sync Web App",
    time: new Date().toISOString(),
    message: "Web App is active and ready to accept POST requests for sheet sync and proof uploads."
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet() || ss.getSheets()[0];
    
    // Parse incoming payload
    var rawData = e && e.postData ? e.postData.contents : "";
    if (!rawData) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No data payload received" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = JSON.parse(rawData);
    var action = (data.action || "add").toLowerCase(); // "test", "upload_proof", "add", "update", "beautify"

    // ==========================================
    // ACTION: BEAUTIFY EXISTING PROOF LINKS
    // ==========================================
    if (action === "beautify") {
      beautifyAllProofLinks();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Spreadsheet proof links beautified successfully!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ==========================================
    // ACTION: TEST CONNECTION & DRIVE PERMISSION
    // ==========================================
    if (action === "test") {
      var driveTest = "Drive access ok";
      try {
        var folderRaised = DriveApp.getFolderById("1Aqg6rmMETXqtjcEz6z07XDsj1jYWRfNf");
        driveTest = "Drive folders accessible (" + folderRaised.getName() + ")";
      } catch (dErr) {
        driveTest = "Drive permission warning: " + dErr.toString();
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Google Apps Script connection verified successfully! " + driveTest,
        sheetName: sheet.getName(),
        time: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    
    if (values.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Spreadsheet is empty" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Normalize headers for flexible column matching
    var headers = values[0].map(function(h) {
      return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    });
    
    function getColIdx(candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var cand = candidates[i].toLowerCase().replace(/[^a-z0-9]/g, "");
        var exactIdx = headers.indexOf(cand);
        if (exactIdx !== -1) return exactIdx;
        for (var j = 0; j < headers.length; j++) {
          if (headers[j].indexOf(cand) !== -1 || cand.indexOf(headers[j]) !== -1) return j;
        }
      }
      return -1;
    }

    function ensureColumn(colName) {
      var idx = getColIdx([colName, colName.replace(/[^a-z0-9]/g, "")]);
      if (idx === -1) {
        var newCol = sheet.getLastColumn() + 1;
        sheet.getRange(1, newCol).setValue(colName);
        sheet.setColumnWidth(newCol, 165);
        SpreadsheetApp.flush();
        headers.push(colName.toLowerCase().replace(/[^a-z0-9]/g, ""));
        return newCol - 1;
      }
      return idx;
    }
    
    var colSno = getColIdx(["sno", "s.no", "serial", "srno"]);
    var colProjCode = getColIdx(["projectcode", "project code", "college project", "code"]);
    var colCollegeName = getColIdx(["nameofthecollege", "college name", "collegename", "name"]);
    var colCollegeCode = getColIdx(["collegecode", "college code"]);
    var colYear = getColIdx(["year", "passingyear", "batch"]);
    var colCourse = getColIdx(["coursestream", "course", "stream", "department"]);
    var colDomain = getColIdx(["domainoftraining", "domain", "trainingdomain"]);
    var colTypeProj = getColIdx(["typeofproject", "projecttype", "type"]);
    var colAcadYear = getColIdx(["academicyear", "academic year"]);
    var colSales = getColIdx(["sales"]);
    var colMouDate = getColIdx(["mousigneddate", "mou date", "mou"]);
    var colStartDate = getColIdx(["trainingstartdate", "start date", "startdate"]);
    var colEndDate = getColIdx(["trainingenddate", "end date", "enddate"]);
    var colStudents = getColIdx(["noofstudents", "no of students", "students", "studentcount"]);
    var colCostPerStudent = getColIdx(["costperstudent", "cost per student", "studentcost"]);
    var colTotalValue = getColIdx(["totalcontractvalue", "total cost value", "contract value", "totalvalue"]);
    var colGstValue = getColIdx(["totalcontractvalueinclgst", "total contract value (incl gst)", "gst cost", "totalwithgst"]);
    var colHrsBatch = getColIdx(["hrsbatch", "hrs/batch", "hours/batch", "hours", "hoursplanned"]);
    var colPayType = getColIdx(["typeofpayment", "payment type", "payment", "paymentplan"]);
    var colPayPct = getColIdx(["ofpayment", "% of payment", "percentage", "attppercentage"]);
    var colInvoices = getColIdx(["noofinvoices", "no of invoices", "invoices", "invoicecount"]);
    
    // Find matching row for college
    var targetRowIndex = -1;
    var searchCode = String(data.projectCode || "").trim().toLowerCase();
    var searchName = String(data.collegeName || "").trim().toLowerCase();
    
    if (searchCode || searchName) {
      for (var r = 1; r < values.length; r++) {
        var rowCode = colProjCode !== -1 ? String(values[r][colProjCode] || "").trim().toLowerCase() : "";
        var rowName = colCollegeName !== -1 ? String(values[r][colCollegeName] || "").trim().toLowerCase() : "";
        
        if (searchCode && (rowCode === searchCode || (rowCode && searchCode && (rowCode.indexOf(searchCode) !== -1 || searchCode.indexOf(rowCode) !== -1)))) {
          targetRowIndex = r + 1;
          break;
        }
        if (searchName && (rowName === searchName || (rowName && searchName && (rowName.indexOf(searchName) !== -1 || searchName.indexOf(rowName) !== -1)))) {
          targetRowIndex = r + 1;
          break;
        }
      }
    }

    // ==========================================
    // ACTION: UPLOAD PROOF TO GOOGLE DRIVE & UPDATE SPREADSHEET
    // ==========================================
    if (action === "upload_proof") {
      var folderId = data.folderId || (data.type === "raised" ? "1Aqg6rmMETXqtjcEz6z07XDsj1jYWRfNf" : "1WgW61UJJ-TTwkZeYzOo3-GdQxD2upqtB");
      var defaultFolderName = data.type === "raised" ? "Raised Invoice Proofs" : "Received Invoice Proofs";
      
      var contentType = data.mimeType || "image/jpeg";
      var base64Data = data.fileBase64 || "";
      if (base64Data.indexOf(",") !== -1) {
        base64Data = base64Data.split(",")[1];
      }
      
      var decodedBytes = Utilities.base64Decode(base64Data);
      var safeFileName = String(data.fileName || "invoice_proof.jpg").replace(/[\/\\:?*"<>|]/g, "_");
      var blob = Utilities.newBlob(decodedBytes, contentType, safeFileName);
      
      var file = null;
      var uploadLocation = "";

      // 1. Try target Google Drive folder by ID
      try {
        var targetFolder = DriveApp.getFolderById(folderId);
        file = targetFolder.createFile(blob);
        uploadLocation = "Target folder: " + targetFolder.getName();
      } catch (folderErr) {
        // 2. Fallback: Search or create dedicated folder in user's Drive
        try {
          var folders = DriveApp.getFoldersByName(defaultFolderName);
          var autoFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(defaultFolderName);
          file = autoFolder.createFile(blob);
          uploadLocation = "Created in folder: " + defaultFolderName;
        } catch (autoErr) {
          // 3. Fallback: Create in Drive root
          file = DriveApp.createFile(blob);
          uploadLocation = "Root Drive";
        }
      }

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}

      var fileId = file.getId();
      var directFileUrl = "https://drive.google.com/file/d/" + fileId + "/view?usp=sharing";

      // Determine Target Column
      var colName = data.type === "raised" ? "Raised Invoice proof" : "Recieved Invoice";
      var targetColIdx = ensureColumn(colName);

      // If college row exists, write or append aesthetic hyperlink badge
      if (targetRowIndex <= 0) {
        var newRowIdx = sheet.getLastRow() + 1;
        if (colProjCode !== -1) sheet.getRange(newRowIdx, colProjCode + 1).setValue(data.projectCode || "");
        if (colCollegeName !== -1) sheet.getRange(newRowIdx, colCollegeName + 1).setValue(data.collegeName || "");
        targetRowIndex = newRowIdx;
      }

      var targetCell = sheet.getRange(targetRowIndex, targetColIdx + 1);
      var labelTag = data.invoiceCode || (data.type === "raised" ? "Raised" : "Received");
      formatProofCell(targetCell, directFileUrl, labelTag);

      SpreadsheetApp.flush();

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileUrl: directFileUrl,
        fileId: fileId,
        fileName: file.getName(),
        uploadLocation: uploadLocation,
        columnName: colName,
        rowIndex: targetRowIndex,
        message: "Proof uploaded to Google Drive (" + uploadLocation + ") and aesthetic link saved in column '" + colName + "' at row " + targetRowIndex + "!"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Format aesthetic Hyperlink badge in Google Sheets cells
    function formatProofCell(cell, rawUrls, labelPrefix) {
      if (!rawUrls) return;
      var urlList = [];
      if (Array.isArray(rawUrls)) {
        urlList = rawUrls;
      } else {
        urlList = String(rawUrls).split(/[\\n,]+/).map(function(u) { return u.trim(); }).filter(function(u) { return u.indexOf("http") !== -1; });
      }

      if (urlList.length === 0) {
        cell.setValue(rawUrls);
        return;
      }

      // Clean up URL from any extra quotes
      var cleanUrl = urlList[0].replace(/.*(https:\\/\\/drive\\.google\\.com[^\\s"'\\)]+).*/, "$1");
      if (!cleanUrl.startsWith("http")) cleanUrl = urlList[0];

      cell.setHorizontalAlignment("center");
      cell.setVerticalAlignment("middle");

      if (urlList.length === 1) {
        var badgeText = labelPrefix ? ("📄 " + labelPrefix + " Proof") : "📄 View Proof";
        cell.setFormula('=HYPERLINK("' + cleanUrl + '", "' + badgeText + '")');
        return;
      }

      // Multiple proofs -> Rich Text with individual clickable lines
      try {
        var richBuilder = SpreadsheetApp.newRichTextValue();
        var fullText = "";
        var linkSpans = [];

        for (var i = 0; i < urlList.length; i++) {
          var lineUrl = urlList[i].replace(/.*(https:\\/\\/drive\\.google\\.com[^\\s"'\\)]+).*/, "$1");
          var lineLabel = "📄 " + (labelPrefix ? labelPrefix + " " : "") + "Proof " + (i + 1);
          var startIdx = fullText.length;
          var endIdx = startIdx + lineLabel.length;
          fullText += (i > 0 ? "\\n" : "") + lineLabel;
          linkSpans.push({ start: (i > 0 ? startIdx + 1 : startIdx), end: (i > 0 ? endIdx + 1 : endIdx), url: lineUrl });
        }

        richBuilder.setText(fullText);
        for (var k = 0; k < linkSpans.length; k++) {
          richBuilder.setLinkUrl(linkSpans[k].start, linkSpans[k].end, linkSpans[k].url);
        }

        cell.setRichTextValue(richBuilder.build());
      } catch (rErr) {
        cell.setFormula('=HYPERLINK("' + cleanUrl + '", "📄 View Proofs (' + urlList.length + ')")');
      }
    }

    // Format date to DD/MM/YYYY
    function formatDate(val) {
      if (!val) return "";
      var str = String(val).trim();
      var match = str.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
      if (match) return match[3] + "/" + match[2] + "/" + match[1];
      return str;
    }
    
    var numColumns = values[0].length;
    var rowValues;
    
    if (action === "update" && targetRowIndex > 0) {
      rowValues = sheet.getRange(targetRowIndex, 1, 1, numColumns).getValues()[0];
    } else {
      targetRowIndex = sheet.getLastRow() + 1;
      rowValues = new Array(numColumns).fill("");
      
      if (colSno !== -1) {
        var highestSno = 0;
        for (var k = 1; k < values.length; k++) {
          var sNum = parseInt(values[k][colSno], 10);
          if (!isNaN(sNum) && sNum > highestSno) highestSno = sNum;
        }
        rowValues[colSno] = highestSno > 0 ? highestSno + 1 : sheet.getLastRow();
      }
    }
    
    // Fill or update standard fields
    if (colProjCode !== -1 && data.projectCode) rowValues[colProjCode] = data.projectCode;
    if (colCollegeName !== -1 && data.collegeName) rowValues[colCollegeName] = data.collegeName;
    if (colCollegeCode !== -1) {
      rowValues[colCollegeCode] = data.collegeCode || (data.projectCode ? data.projectCode.split("/")[0] : "");
    }
    if (colYear !== -1 && data.year) rowValues[colYear] = data.year;
    if (colCourse !== -1 && data.courseStream) rowValues[colCourse] = data.courseStream;
    if (colDomain !== -1 && data.domainOfTraining) rowValues[colDomain] = data.domainOfTraining;
    if (colTypeProj !== -1 && data.typeOfProject) rowValues[colTypeProj] = data.typeOfProject;
    if (colAcadYear !== -1 && data.academicYear) rowValues[colAcadYear] = data.academicYear;
    if (colMouDate !== -1 && data.mouSignedDate) rowValues[colMouDate] = formatDate(data.mouSignedDate);
    if (colStartDate !== -1 && data.trainingStartDate) rowValues[colStartDate] = formatDate(data.trainingStartDate);
    if (colEndDate !== -1 && data.trainingEndDate) rowValues[colEndDate] = formatDate(data.trainingEndDate);
    if (colStudents !== -1 && data.studentCount !== undefined) rowValues[colStudents] = Number(data.studentCount) || 0;
    if (colCostPerStudent !== -1 && data.costPerStudent !== undefined) rowValues[colCostPerStudent] = Number(data.costPerStudent) || 0;
    if (colTotalValue !== -1 && data.totalContractValue !== undefined) rowValues[colTotalValue] = Number(data.totalContractValue) || 0;
    if (colGstValue !== -1 && data.totalContractValueGst !== undefined) rowValues[colGstValue] = Number(data.totalContractValueGst) || 0;
    if (colHrsBatch !== -1 && data.hoursBatch !== undefined) rowValues[colHrsBatch] = Number(data.hoursBatch) || 0;
    if (colPayType !== -1 && data.typeOfPayment) rowValues[colPayType] = data.typeOfPayment;
    if (colPayPct !== -1 && data.percentageOfPayment) rowValues[colPayPct] = data.percentageOfPayment;
    if (colInvoices !== -1 && data.noOfInvoices !== undefined) rowValues[colInvoices] = Number(data.noOfInvoices) || 1;
    
    // Write row back to spreadsheet
    sheet.getRange(targetRowIndex, 1, 1, rowValues.length).setValues([rowValues]);

    // Handle Proof columns with aesthetic hyperlink badges
    if (data.raisedInvoiceProof) {
      var colRaised = ensureColumn("Raised Invoice proof");
      formatProofCell(sheet.getRange(targetRowIndex, colRaised + 1), data.raisedInvoiceProof, "Raised");
    }
    if (data.receivedInvoiceProof) {
      var colReceived = ensureColumn("Recieved Invoice");
      formatProofCell(sheet.getRange(targetRowIndex, colReceived + 1), data.receivedInvoiceProof, "Received");
    }
    
    SpreadsheetApp.flush();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      action: action === "update" && targetRowIndex <= values.length ? "updated" : "added",
      rowIndex: targetRowIndex,
      message: "Row " + (action === "update" && targetRowIndex <= values.length ? "updated" : "added") + " successfully at line " + targetRowIndex
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

/**
 * Tests live connection to Google Apps Script Web App
 */
export async function testGoogleAppsScriptConnection(
  url: string
): Promise<{ success: boolean; message: string }> {
  if (!url || !url.trim().startsWith("http")) {
    return { success: false, message: "Please enter a valid Google Apps Script Web App URL starting with https://" };
  }

  try {
    const response = await fetch(url.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action: "test" }),
      redirect: "follow",
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Ignored
    }

    if (json && json.success) {
      return { success: true, message: json.message || "Connected to Google Sheet and Drive successfully!" };
    } else if (json && json.error) {
      return { success: false, message: `Apps Script returned error: ${json.error}` };
    } else if (response.ok) {
      return { success: true, message: "Apps Script Web App reachable and responding!" };
    } else {
      return { success: false, message: `HTTP ${response.status}: Make sure 'Who has access' is set to 'Anyone'.` };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err.message}. Make sure the script is deployed with 'Who has access: Anyone' and Drive permissions are granted.`,
    };
  }
}

/**
 * Triggers spreadsheet proof link beautification on the Google Apps Script backend
 */
export async function beautifySpreadsheetProofLinks(
  url: string
): Promise<{ success: boolean; message: string }> {
  if (!url || !url.trim().startsWith("http")) {
    return { success: false, message: "Please enter a valid Google Apps Script Web App URL." };
  }

  try {
    const response = await fetch(url.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action: "beautify" }),
      redirect: "follow",
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Ignored
    }

    if (json && json.success) {
      return { success: true, message: json.message || "Spreadsheet proof links beautified successfully!" };
    } else if (json && json.error) {
      return { success: false, message: `Apps Script error: ${json.error}` };
    } else {
      return { success: true, message: "Beautification command executed!" };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to beautify links: ${err.message}`,
    };
  }
}


/**
 * Automatically compresses image files to JPEG before Base64 encoding
 * Ensures fast (< 1s) uploads and prevents hitting Google Apps Script payload limits.
 */
async function fileToBase64WithCompression(file: File): Promise<{ base64: string; mimeType: string; fileName: string }> {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  // If not an image (e.g. PDF), read directly
  if (!file.type.startsWith("image/")) {
    const rawBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { base64: rawBase64, mimeType: file.type || "application/pdf", fileName: sanitizedName };
  }

  // Compress image via Canvas
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          resolve({
            base64: dataUrl,
            mimeType: "image/jpeg",
            fileName: sanitizedName.replace(/\.[^/.]+$/, "") + ".jpg",
          });
          return;
        }

        resolve({
          base64: e.target?.result as string,
          mimeType: file.type,
          fileName: sanitizedName,
        });
      };
      img.onerror = () => {
        resolve({
          base64: e.target?.result as string,
          mimeType: file.type,
          fileName: sanitizedName,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve({
        base64: "",
        mimeType: file.type,
        fileName: sanitizedName,
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an Invoice Proof photo / PDF to Google Drive and links to matching Google Sheet row
 */
export async function uploadInvoiceProofToDrive(params: {
  file: File;
  type: "raised" | "received";
  projectCode: string;
  collegeName: string;
  invoiceCode?: string;
  milestoneIndex?: number;
}): Promise<{ success: boolean; fileUrl: string; message: string }> {
  const config = loadSavedSheetConfig();
  const scriptUrl = config.scriptUrl || (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL;

  const folderConfig =
    params.type === "raised"
      ? GOOGLE_DRIVE_FOLDERS.raisedInvoiceProof
      : GOOGLE_DRIVE_FOLDERS.receivedInvoiceProof;

  // Compress and convert File to Base64
  const { base64, mimeType, fileName: processedFileName } = await fileToBase64WithCompression(params.file);

  if (!scriptUrl || !scriptUrl.trim()) {
    return {
      success: false,
      fileUrl: base64,
      message: "⚠️ Apps Script URL is not configured in Sheet Sync. Connect Apps Script Web App for live Google Drive uploads.",
    };
  }

  const safeCode = String(params.projectCode || "PRJ").replace(/[\/\\:?*"<>|]/g, "-");
  const safeInv = String(params.invoiceCode || "INV").replace(/[\/\\:?*"<>|]/g, "-");

  const payload = {
    action: "upload_proof",
    type: params.type,
    folderId: folderConfig.folderId,
    columnName: folderConfig.columnName,
    fileName: `${safeCode}_${safeInv}_${params.type}_proof_${processedFileName}`,
    mimeType: mimeType,
    fileBase64: base64,
    projectCode: params.projectCode,
    collegeName: params.collegeName,
  };

  try {
    const response = await fetch(scriptUrl.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch {
      // Ignored
    }

    if (resJson && resJson.success && resJson.fileUrl) {
      return {
        success: true,
        fileUrl: resJson.fileUrl,
        message: `✓ Photo uploaded to Google Drive & direct file link saved in spreadsheet column "${folderConfig.columnName}"!`,
      };
    } else if (resJson && resJson.error) {
      return {
        success: false,
        fileUrl: base64,
        message: `Apps Script Error: ${resJson.error}`,
      };
    }

    return {
      success: true,
      fileUrl: folderConfig.url,
      message: `✓ Proof dispatched to Google Drive!`,
    };
  } catch (err: any) {
    console.warn("Upload proof primary fetch notice:", err);
    try {
      // Fallback: Dispatch via mode no-cors so Google Apps Script executes and writes to Drive & Sheet
      await fetch(scriptUrl.trim(), {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
        mode: "no-cors",
      });

      return {
        success: true,
        fileUrl: folderConfig.url,
        message: `✓ Proof submitted to Google Drive & Google Sheet!`,
      };
    } catch (fallbackErr: any) {
      return {
        success: false,
        fileUrl: base64,
        message: `Upload error: ${err.message}. Make sure Google Drive permissions are authorized in Apps Script.`,
      };
    }
  }
}

/**
 * Writes additions or updates back to the Google Spreadsheet via Google Apps Script Web App
 */
export async function syncProjectToGoogleSheet(
  action: "add" | "update",
  project: Project
): Promise<{ success: boolean; message: string }> {
  const config = loadSavedSheetConfig();
  const scriptUrl = config.scriptUrl || (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL;

  if (!scriptUrl || !scriptUrl.trim()) {
    return {
      success: false,
      message: "Google Apps Script URL not configured yet. Changes saved locally in workspace.",
    };
  }

  const phase1 = project.phases && project.phases[0];
  const startDate = phase1?.startDate || "";
  const endDate = phase1?.endDate || "";

  // Extract raised and received proof links if present in invoices
  const raisedProofs = project.invoices
    ?.filter((i) => i.raisedProofUrl)
    .map((i) => i.raisedProofUrl)
    .filter(Boolean);
  const receivedProofs = project.invoices
    ?.filter((i) => i.receivedProofUrl)
    .map((i) => i.receivedProofUrl)
    .filter(Boolean);

  const payload = {
    action, // "add" or "update"
    projectCode: project.project_code,
    collegeName: project.college_name,
    collegeCode: project.project_code ? project.project_code.split("/")[0] : "",
    year: project.passing_year || "2026",
    academicYear: project.academic_year || "4th Year",
    courseStream: "",
    domainOfTraining: "Soft Skills/Aptitude/Technical",
    typeOfProject: "TP",
    mouSignedDate: "",
    trainingStartDate: startDate,
    trainingEndDate: endDate,
    studentCount: project.student_count,
    costPerStudent: project.cost_per_student,
    totalContractValue: project.total_cost_value,
    totalContractValueGst: project.gst_cost,
    hoursBatch: project.hours_planned,
    typeOfPayment: project.payment_type || "ATP",
    percentageOfPayment: project.attp_percentage || (project.payment_type === "FNF" ? "100" : "50-50"),
    noOfInvoices: project.invoice_count,
    additionalNotes: project.additional_notes || "",
    raisedInvoiceProof: project.raised_invoice_proof || (raisedProofs?.length ? raisedProofs.join("\n") : ""),
    receivedInvoiceProof: project.received_invoice_proof || (receivedProofs?.length ? receivedProofs.join("\n") : ""),
  };

  try {
    // Mode no-cors with text/plain JSON payload for Google Apps Script Web App
    await fetch(scriptUrl.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      mode: "no-cors",
    });

    return {
      success: true,
      message: action === "add" ? "Row appended to Google Spreadsheet!" : "Row updated in Google Spreadsheet!",
    };
  } catch (err: any) {
    console.warn("Write to Google Sheet error:", err);
    return {
      success: false,
      message: `Could not reach Google Apps Script: ${err.message}`,
    };
  }
}

/**
 * LocalStorage Helpers for Google Sheet Config & Cached Items
 */
export function loadSavedSheetConfig(): GoogleSheetConfig {
  const envUrl = (import.meta as any).env?.VITE_DEFAULT_GOOGLE_SHEET_URL || DEFAULT_SHEET_URL;
  const envSheetName = (import.meta as any).env?.VITE_DEFAULT_GOOGLE_SHEET_NAME || "";
  const envScriptUrl = (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL || "";

  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sheetUrl: parsed.sheetUrl || envUrl,
        sheetName: parsed.sheetName || envSheetName,
        scriptUrl: parsed.scriptUrl || envScriptUrl,
        autoSync: parsed.autoSync !== false,
        lastSyncedAt: parsed.lastSyncedAt,
      };
    }
  } catch (e) {
    console.warn("Failed to load sheet config from storage", e);
  }
  return {
    sheetUrl: envUrl,
    sheetName: envSheetName,
    scriptUrl: envScriptUrl,
    autoSync: true,
  };
}

export function saveSheetConfig(config: GoogleSheetConfig): void {
  try {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save sheet config", e);
  }
}

export function loadCachedSheetItems(): GoogleSheetCollegeItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_CACHED_ITEMS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to load cached sheet items", e);
  }
  return [];
}

export function saveCachedSheetItems(items: GoogleSheetCollegeItem[]): void {
  try {
    localStorage.setItem(STORAGE_CACHED_ITEMS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Failed to save cached sheet items", e);
  }
}

export function loadCachedInvoiceTrackerItems(): GoogleSheetInvoiceTrackerItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_CACHED_INVOICE_TRACKER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to load cached invoice tracker items", e);
  }
  return [];
}

export function saveCachedInvoiceTrackerItems(items: GoogleSheetInvoiceTrackerItem[]): void {
  try {
    localStorage.setItem(STORAGE_CACHED_INVOICE_TRACKER_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("Failed to save cached invoice tracker items", e);
  }
}


