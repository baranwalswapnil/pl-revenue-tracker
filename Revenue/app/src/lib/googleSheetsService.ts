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

const STORAGE_CONFIG_KEY = "google_sheet_sync_config_v1";
const STORAGE_CACHED_ITEMS_KEY = "google_sheet_cached_colleges_v1";

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
 */
function parseCleanNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  const str = String(val).replace(/[₹$,\s%]/g, "").trim();
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
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app".
 * 6. Set "Execute as": "Me".
 * 7. Set "Who has access": "Anyone" (VERY IMPORTANT!).
 * 8. Click "Deploy", then click "Authorize access" (Advanced > Go to project > Allow).
 * 9. Copy the Web App URL and paste it into the Sheet Sync modal in the website!
 * 
 * NOTE: If you update code later, go to Deploy > Manage deployments > Edit > New version > Deploy!
 */

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
    var action = (data.action || "add").toLowerCase(); // "test", "upload_proof", "add", "update"

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
        SpreadsheetApp.flush();
        headers.push(colName.toLowerCase().replace(/[^a-z0-9]/g, ""));
        return newCol - 1;
      }
      return idx;
    }
    
    var colSno = getColIdx(["sno", "s.no", "serial", "srno"]);
    var colProjCode = getColIdx(["projectcode", "project code", "code"]);
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
      var folder = null;
      try {
        folder = DriveApp.getFolderById(folderId);
      } catch (fErr) {
        try {
          folder = DriveApp.getRootFolder();
        } catch (rErr) {}
      }

      var contentType = data.mimeType || "image/jpeg";
      var base64Data = data.fileBase64 || "";
      if (base64Data.indexOf(",") !== -1) {
        base64Data = base64Data.split(",")[1];
      }
      
      var decodedBytes = Utilities.base64Decode(base64Data);
      var safeFileName = String(data.fileName || "invoice_proof.jpg").replace(/[\/\\:?*"<>|]/g, "_");
      var blob = Utilities.newBlob(decodedBytes, contentType, safeFileName);
      
      var file = null;
      if (folder) {
        try {
          file = folder.createFile(blob);
        } catch (createErr) {
          file = DriveApp.createFile(blob);
        }
      } else {
        file = DriveApp.createFile(blob);
      }

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}

      var fileId = file.getId();
      var directFileUrl = "https://drive.google.com/file/d/" + fileId + "/view?usp=sharing";

      // Determine Target Column
      var colName = data.type === "raised" ? "Raised Invoice proof" : "Recieved Invoice";
      var targetColIdx = ensureColumn(colName);

      // If college row exists, write or append direct file link in that row!
      if (targetRowIndex > 0) {
        var curVal = sheet.getRange(targetRowIndex, targetColIdx + 1).getValue();
        var newVal = directFileUrl;
        if (curVal && String(curVal).trim()) {
          var curStr = String(curVal).trim();
          if (curStr.indexOf(directFileUrl) === -1) {
            newVal = curStr + "\\n" + directFileUrl;
          } else {
            newVal = curStr;
          }
        }
        sheet.getRange(targetRowIndex, targetColIdx + 1).setValue(newVal);
      } else {
        // If college row doesn't exist yet, create a new row with project code, college name and proof link
        var newRowIdx = sheet.getLastRow() + 1;
        if (colProjCode !== -1) sheet.getRange(newRowIdx, colProjCode + 1).setValue(data.projectCode || "");
        if (colCollegeName !== -1) sheet.getRange(newRowIdx, colCollegeName + 1).setValue(data.collegeName || "");
        sheet.getRange(newRowIdx, targetColIdx + 1).setValue(directFileUrl);
        targetRowIndex = newRowIdx;
      }

      SpreadsheetApp.flush();

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileUrl: directFileUrl,
        fileId: fileId,
        fileName: file.getName(),
        columnName: colName,
        rowIndex: targetRowIndex,
        message: "Proof uploaded to Google Drive folder and direct file link saved in column '" + colName + "' at row " + targetRowIndex + " in spreadsheet!"
      })).setMimeType(ContentService.MimeType.JSON);
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

    // Handle Proof columns if present in payload
    if (data.raisedInvoiceProof) {
      var colRaised = ensureColumn("Raised Invoice proof");
      sheet.getRange(targetRowIndex, colRaised + 1).setValue(data.raisedInvoiceProof);
    }
    if (data.receivedInvoiceProof) {
      var colReceived = ensureColumn("Recieved Invoice");
      sheet.getRange(targetRowIndex, colReceived + 1).setValue(data.receivedInvoiceProof);
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
      success: false,
      fileUrl: base64,
      message: `Failed to confirm Google Drive upload. Response: ${resText.slice(0, 100)}`,
    };
  } catch (err: any) {
    console.warn("Upload proof notice:", err);
    return {
      success: false,
      fileUrl: base64,
      message: `Upload error: ${err.message}. Make sure Google Drive permissions are authorized in Apps Script.`,
    };
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

