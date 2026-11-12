import type { Project, InvoiceMilestone } from "./models";
import { generateMilestoneInvoices } from "./mockData";

export type PeriodType = "all" | "month" | "quarter";

export interface OutstandingPeriod {
  type: PeriodType;
  /**
   * Year in which the FINANCIAL YEAR STARTS (April to March).
   * 2026 = FY 2026-27 = Apr 2026 to Mar 2027.
   */
  year: number;
  month?: number; // 1 to 12 (calendar month number)
  quarter?: "Q1" | "Q2" | "Q3" | "Q4"; // Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
  label: string;
}

export interface MonthMeta {
  num: number; // 1-12 (calendar month number)
  name: string;
  short: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
}

// Ordered April to March so the month buttons follow the financial year
export const ALL_MONTHS: MonthMeta[] = [
  { num: 4, name: "April", short: "Apr", quarter: "Q1" },
  { num: 5, name: "May", short: "May", quarter: "Q1" },
  { num: 6, name: "June", short: "Jun", quarter: "Q1" },
  { num: 7, name: "July", short: "Jul", quarter: "Q2" },
  { num: 8, name: "August", short: "Aug", quarter: "Q2" },
  { num: 9, name: "September", short: "Sep", quarter: "Q2" },
  { num: 10, name: "October", short: "Oct", quarter: "Q3" },
  { num: 11, name: "November", short: "Nov", quarter: "Q3" },
  { num: 12, name: "December", short: "Dec", quarter: "Q3" },
  { num: 1, name: "January", short: "Jan", quarter: "Q4" },
  { num: 2, name: "February", short: "Feb", quarter: "Q4" },
  { num: 3, name: "March", short: "Mar", quarter: "Q4" },
];

export interface QuarterMeta {
  key: "Q1" | "Q2" | "Q3" | "Q4";
  title: string;
  rangeText: string;
  months: number[];
  monthNames: string;
  color: string;
}

export const ALL_QUARTERS: QuarterMeta[] = [
  {
    key: "Q1",
    title: "Q1 Report",
    rangeText: "Apr – Jun",
    months: [4, 5, 6],
    monthNames: "April, May, June",
    color: "#3b82f6",
  },
  {
    key: "Q2",
    title: "Q2 Report",
    rangeText: "Jul – Sep",
    months: [7, 8, 9],
    monthNames: "July, August, September",
    color: "#10b981",
  },
  {
    key: "Q3",
    title: "Q3 Report",
    rangeText: "Oct – Dec",
    months: [10, 11, 12],
    monthNames: "October, November, December",
    color: "#f59e0b",
  },
  {
    key: "Q4",
    title: "Q4 Report",
    rangeText: "Jan – Mar",
    months: [1, 2, 3],
    monthNames: "January, February, March",
    color: "#8b5cf6",
  },
];

/* ------------------------------------------------------------------ */
/* Financial year helpers (Indian FY: April to March)                  */
/* ------------------------------------------------------------------ */

export const FY_START_MONTH = 4;

/** Financial year (by start year) that a calendar date belongs to. */
export function getFiscalYear(parts: { year: number; month: number }): number {
  return parts.month >= FY_START_MONTH ? parts.year : parts.year - 1;
}

/** 2026 -> "FY 2026-27" */
export function fiscalYearLabel(startYear: number): string {
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Calendar year in which `month` falls inside the FY that starts in `startYear`. */
export function calendarYearForMonth(startYear: number, month: number): number {
  return month >= FY_START_MONTH ? startYear : startYear + 1;
}

export interface EnrichedInvoiceItem {
  id: string;
  projectId: string;
  collegeName: string;
  projectCode: string;
  academicYear: string;
  passingYear: string;
  paymentType: string;
  invoiceNumber: number;
  invoiceCode: string;
  label: string;
  percentage: number;
  amount: number;
  amountFromMou?: number;
  amountRaised?: number;
  isRaised: boolean;
  dateRaised?: string;
  raisedProofUrl?: string;
  raisedProofName?: string;
  isReceived: boolean;
  dateReceived?: string;
  receivedProofUrl?: string;
  receivedProofName?: string;
  outstandingAmount: number;
  isRaisedInPeriod: boolean;
  isReceivedInPeriod: boolean;
  isPendingInPeriod: boolean;
  status: "Received" | "Pending Payment" | "Unraised";
  invoiceType?: string;
  remarks?: string;
  gaInvoiceCode?: string;
  printed?: string | boolean;
  tdsStatus?: string;
  project: Project;
}

export interface PeriodSummaryStats {
  periodLabel: string;
  periodType: PeriodType;
  year: number;
  monthName?: string;
  quarterName?: string;
  totalInvoicesInScope: number;
  raisedCount: number;
  raisedAmount: number;
  receivedCount: number;
  receivedAmount: number;
  outstandingCount: number;
  outstandingAmount: number;
  collectionEfficiencyPct: number;
  items: EnrichedInvoiceItem[];
}

/**
 * Parses date string in YYYY-MM-DD, DD/MM/YYYY, or ISO format
 */
export function parseDateParts(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr || !dateStr.trim()) return null;
  const str = dateStr.trim();

  // YYYY-MM-DD
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    return { year: parseInt(ymd[1], 10), month: parseInt(ymd[2], 10), day: parseInt(ymd[3], 10) };
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (dmy) {
    return { year: parseInt(dmy[3], 10), month: parseInt(dmy[2], 10), day: parseInt(dmy[1], 10) };
  }

  // DD/MM/YY or DD-MM-YY (e.g. 15/06/26 -> 2026-06-15)
  const dmyShort = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2})$/);
  if (dmyShort) {
    const yr = parseInt(dmyShort[3], 10);
    return { year: 2000 + yr, month: parseInt(dmyShort[2], 10), day: parseInt(dmyShort[1], 10) };
  }

  // Excel serial date (e.g. 45000 - 60000), read in UTC to avoid time zone shifts
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Checks if a given date falls inside the requested OutstandingPeriod.
 * period.year is the FINANCIAL year start (2026 = Apr 2026 to Mar 2027),
 * so Q4 of 2026 means Jan to Mar 2027.
 */
export function isDateInPeriod(dateStr: string | undefined, period: OutstandingPeriod): boolean {
  if (!dateStr) return false;
  const parts = parseDateParts(dateStr);
  if (!parts) return false;

  // Compare financial years, not calendar years
  if (period.year && getFiscalYear(parts) !== period.year) {
    return false;
  }

  if (period.type === "month" && period.month) {
    return parts.month === period.month;
  }

  if (period.type === "quarter" && period.quarter) {
    const qMeta = ALL_QUARTERS.find((q) => q.key === period.quarter);
    if (qMeta) {
      return qMeta.months.includes(parts.month);
    }
  }

  return true;
}

/**
 * Computes all invoices and collection breakdown for a given period
 */
export function calculatePeriodOutstanding(
  projects: Project[],
  period: OutstandingPeriod
): PeriodSummaryStats {
  const items: EnrichedInvoiceItem[] = [];

  let raisedCount = 0;
  let raisedAmount = 0;
  let receivedCount = 0;
  let receivedAmount = 0;
  let outstandingCount = 0;
  let outstandingAmount = 0;

  projects.forEach((proj) => {
    const projStartDate = proj.phases?.[0]?.startDate || proj.created_at;
    const projEndDate = proj.phases?.[0]?.endDate;

    // Retrieve or generate project milestone invoices with timeline awareness
    const projectInvoices: InvoiceMilestone[] =
      proj.invoices && proj.invoices.length > 0
        ? proj.invoices
        : generateMilestoneInvoices(
            proj.payment_type,
            proj.attp_percentage,
            proj.installment_count,
            proj.gst_cost,
            undefined,
            proj.invoice_raised,
            projStartDate,
            projEndDate
          );

    projectInvoices.forEach((inv, idx) => {
      // 1. Strict bifurcation according to Date in Column K (inv.dateRaised)
      const isDateMatched = isDateInPeriod(inv.dateRaised, period);
      if (!isDateMatched) {
        return; // Only invoices whose Column K date falls into this period are included
      }

      const invTypeLower = (inv.invoiceType || "").toLowerCase().trim();
      const invStatusLower = (inv.status || "").toLowerCase().trim();
      const invDateReceived = (inv.dateReceived || "").trim();

      // Received / collected. Whole-word match so "unpaid" or "not received" do not count.
      const statusSaysReceived =
        /\b(received|recieved|paid|collected)\b/.test(invStatusLower) &&
        !/\b(not|yet|pending|unpaid)\b/.test(invStatusLower);

      const isActuallyReceived = Boolean(
        inv.isReceived || statusSaysReceived || invDateReceived.length > 0
      );

      // "if status is raised or processed then it will show it"
      const statusSaysRaised =
        /\b(raised|processed|processing)\b/.test(invStatusLower) &&
        !/\bnot\b/.test(invStatusLower);

      const isRaisedOrProcessed = Boolean(
        inv.isRaised ||
          statusSaysRaised ||
          invTypeLower.includes("raise") ||
          invTypeLower.includes("process")
      );

      // Only show invoices that are explicitly Raised, Processed, or Received
      if (!isRaisedOrProcessed && !isActuallyReceived) {
        return;
      }

      let status: "Received" | "Pending Payment" | "Unraised" = "Unraised";
      if (isActuallyReceived) {
        status = "Received";
      } else if (isRaisedOrProcessed) {
        status = "Pending Payment";
      }

      const milestoneAmt = inv.amountRaised || inv.amount || 0;
      const pendingBal = isActuallyReceived ? 0 : milestoneAmt;

      raisedCount++;
      raisedAmount += milestoneAmt;

      if (isActuallyReceived) {
        receivedCount++;
        receivedAmount += milestoneAmt;
      } else {
        // Raised or Processed = Outstanding
        outstandingCount++;
        outstandingAmount += pendingBal;
      }

      items.push({
        // Always include the project so ids are unique across projects
        id: `${proj.id}::${inv.id || idx + 1}`,
        projectId: proj.id,
        collegeName: proj.college_name,
        projectCode: proj.project_code,
        academicYear: proj.academic_year,
        passingYear: proj.passing_year,
        paymentType: proj.payment_type,
        invoiceNumber: inv.invoiceNumber || idx + 1,
        invoiceCode: inv.invoiceCode || `INV-${String(idx + 1).padStart(2, "0")}`,
        label: inv.label || `Milestone ${idx + 1}`,
        percentage: inv.percentage || 100 / projectInvoices.length,
        amount: inv.amount,
        amountFromMou: inv.amountFromMou,
        amountRaised: inv.amountRaised || milestoneAmt,
        isRaised: true,
        dateRaised: inv.dateRaised,
        raisedProofUrl: inv.raisedProofUrl,
        raisedProofName: inv.raisedProofName,
        isReceived: isActuallyReceived,
        dateReceived: inv.dateReceived,
        receivedProofUrl: inv.receivedProofUrl,
        receivedProofName: inv.receivedProofName,
        outstandingAmount: pendingBal,
        isRaisedInPeriod: isDateMatched,
        isReceivedInPeriod: isActuallyReceived,
        isPendingInPeriod: !isActuallyReceived && pendingBal > 0,
        status,
        invoiceType: inv.invoiceType,
        remarks: inv.remarks,
        gaInvoiceCode: inv.gaInvoiceCode,
        printed: inv.printed,
        tdsStatus: inv.tdsStatus,
        project: proj,
      });
    });
  });

  const efficiency = raisedAmount > 0 ? (receivedAmount / raisedAmount) * 100 : 0;

  let monthName = "";
  if (period.type === "month" && period.month) {
    const m = ALL_MONTHS.find((item) => item.num === period.month);
    monthName = m ? m.name : `Month ${period.month}`;
  }

  let quarterName = "";
  if (period.type === "quarter" && period.quarter) {
    const q = ALL_QUARTERS.find((item) => item.key === period.quarter);
    quarterName = q ? `${q.title} (${q.rangeText})` : period.quarter;
  }

  return {
    periodLabel: period.label,
    periodType: period.type,
    year: period.year,
    monthName,
    quarterName,
    totalInvoicesInScope: items.length,
    raisedCount,
    raisedAmount,
    receivedCount,
    receivedAmount,
    outstandingCount,
    outstandingAmount,
    collectionEfficiencyPct: Math.min(100, Math.max(0, efficiency)),
    items,
  };
}

/**
 * Default period: the current financial year (April to March).
 */
export function getDefaultPeriod(): OutstandingPeriod {
  const now = new Date();
  const fy = getFiscalYear({ year: now.getFullYear(), month: now.getMonth() + 1 });
  return {
    type: "all",
    year: fy,
    label: `${fiscalYearLabel(fy)} (Apr – Mar)`,
  };
}
