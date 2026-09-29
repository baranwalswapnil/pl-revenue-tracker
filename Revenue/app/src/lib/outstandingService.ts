import type { Project, InvoiceMilestone } from "./models";
import { generateMilestoneInvoices } from "./mockData";

export type PeriodType = "month" | "quarter";

export interface OutstandingPeriod {
  type: PeriodType;
  year: number;
  month?: number; // 1 to 12
  quarter?: "Q1" | "Q2" | "Q3" | "Q4"; // Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
  label: string;
}

export interface MonthMeta {
  num: number; // 1-12
  name: string;
  short: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
}

export const ALL_MONTHS: MonthMeta[] = [
  { num: 1, name: "January", short: "Jan", quarter: "Q4" },
  { num: 2, name: "February", short: "Feb", quarter: "Q4" },
  { num: 3, name: "March", short: "Mar", quarter: "Q4" },
  { num: 4, name: "April", short: "Apr", quarter: "Q1" },
  { num: 5, name: "May", short: "May", quarter: "Q1" },
  { num: 6, name: "June", short: "Jun", quarter: "Q1" },
  { num: 7, name: "July", short: "Jul", quarter: "Q2" },
  { num: 8, name: "August", short: "Aug", quarter: "Q2" },
  { num: 9, name: "September", short: "Sep", quarter: "Q2" },
  { num: 10, name: "October", short: "Oct", quarter: "Q3" },
  { num: 11, name: "November", short: "Nov", quarter: "Q3" },
  { num: 12, name: "December", short: "Dec", quarter: "Q3" },
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
 * Checks if a given date falls inside the requested OutstandingPeriod
 */
export function isDateInPeriod(dateStr: string | undefined, period: OutstandingPeriod): boolean {
  if (!dateStr) return false;
  const parts = parseDateParts(dateStr);
  if (!parts) return false;

  if (period.year && parts.year !== period.year) {
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
      const isRaisedInPeriod = isDateInPeriod(inv.dateRaised, period);
      const isReceivedInPeriod = isDateInPeriod(inv.dateReceived, period);

      // Check if invoice belongs to or is active in this period
      const isRelevantForPeriod =
        isRaisedInPeriod ||
        isReceivedInPeriod ||
        (!inv.dateRaised && isDateInPeriod(projStartDate, period));

      if (isRelevantForPeriod) {
        const isActuallyReceived = Boolean(inv.isReceived || (inv.dateReceived && inv.dateReceived.trim().length > 0));
        const isActuallyRaised = Boolean(inv.isRaised || (inv.dateRaised && inv.dateRaised.trim().length > 0));

        let status: "Received" | "Pending Payment" | "Unraised" = "Unraised";
        if (isActuallyReceived) {
          status = "Received";
        } else if (isActuallyRaised) {
          status = "Pending Payment";
        }

        const pendingBal = isActuallyReceived ? 0 : inv.amount;

        if (isActuallyRaised && (isRaisedInPeriod || !inv.dateRaised)) {
          raisedCount++;
          raisedAmount += inv.amount;
        }

        if (isActuallyReceived && (isReceivedInPeriod || !inv.dateReceived)) {
          receivedCount++;
          receivedAmount += inv.amount;
        }

        // Outstanding for this period: any invoice active in this period that is not yet received
        if (!isActuallyReceived) {
          outstandingCount++;
          outstandingAmount += inv.amount;
        }

        items.push({
          id: inv.id || `${proj.id}-inv-${idx + 1}`,
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
          amountRaised: inv.amountRaised || (isActuallyRaised ? inv.amount : 0),
          isRaised: isActuallyRaised,
          dateRaised: inv.dateRaised,
          raisedProofUrl: inv.raisedProofUrl,
          raisedProofName: inv.raisedProofName,
          isReceived: isActuallyReceived,
          dateReceived: inv.dateReceived,
          receivedProofUrl: inv.receivedProofUrl,
          receivedProofName: inv.receivedProofName,
          outstandingAmount: pendingBal,
          isRaisedInPeriod,
          isReceivedInPeriod,
          isPendingInPeriod: isActuallyRaised && !isActuallyReceived,
          status,
          invoiceType: inv.invoiceType,
          remarks: inv.remarks,
          gaInvoiceCode: inv.gaInvoiceCode,
          printed: inv.printed,
          tdsStatus: inv.tdsStatus,
          project: proj,
        });
      }
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
 * Creates default period (e.g. current active month or default Q4 2026)
 */
export function getDefaultPeriod(): OutstandingPeriod {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const monthMeta = ALL_MONTHS.find((m) => m.num === currentMonth) || ALL_MONTHS[2]; // Default March

  return {
    type: "month",
    year: 2026,
    month: monthMeta.num,
    label: `${monthMeta.name} 2026`,
  };
}
