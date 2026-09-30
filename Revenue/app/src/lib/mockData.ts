import type { Project, ProjectDraft, PaymentType, InvoiceMilestone } from "./models";

export const INITIAL_PROJECTS: Project[] = [];

export const formatINR = (val: number | string | null | undefined): string => {
  const num = Math.max(0, Number(val) || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatNumber = (val: number | string | null | undefined): string => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat("en-IN").format(num);
};

export const computeAttpDetails = (input: string | number | undefined | null): {
  normalizedPercentage: string;
  invoiceCount: number;
  displayVal: string;
} => {
  const cleanStr = String(input || "").replace("%", "").trim();
  const num = parseFloat(cleanStr);
  
  if (isNaN(num) || num <= 0) {
    return { normalizedPercentage: "50%", invoiceCount: 2, displayVal: "50" };
  }

  // 100% -> 1 invoice
  if (num >= 99.5) {
    return { normalizedPercentage: "100%", invoiceCount: 1, displayVal: "100" };
  }

  // Exact 75% -> 2 invoices (75% Advance + 25% Final)
  if (Math.abs(num - 75) < 0.5) {
    return { normalizedPercentage: "75%", invoiceCount: 2, displayVal: "75" };
  }

  // User requirement: "If user write like 33 then it would automatically turn it to 33.34 so that it shows 3 Invoices"
  if (Math.abs(num - 33) <= 0.6 || Math.abs(num - 33.33) <= 0.2 || Math.abs(num - 33.34) <= 0.2) {
    return { normalizedPercentage: "33.34%", invoiceCount: 3, displayVal: "33.34" };
  }

  // Standard milestone calculation
  const rawCount = 100 / num;
  const count = Math.max(1, Math.min(50, Math.round(rawCount)));

  let normPct: string;
  let dispVal: string;
  if (count === 3) {
    normPct = "33.34%";
    dispVal = "33.34";
  } else if (Math.abs(100 / count - num) < 0.05) {
    normPct = `${num}%`;
    dispVal = String(num);
  } else if (Number.isInteger(100 / count)) {
    normPct = `${100 / count}%`;
    dispVal = String(100 / count);
  } else {
    normPct = `${(100 / count).toFixed(2)}%`;
    dispVal = (100 / count).toFixed(2);
  }

  return {
    normalizedPercentage: normPct,
    invoiceCount: count,
    displayVal: dispVal,
  };
};

export function addDaysToDateStr(dateStr: string | undefined, days: number): string {
  if (!dateStr || !dateStr.trim()) return "";
  try {
    const parts = dateStr.trim().split(/[-T/]/);
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month, day);
        d.setDate(d.getDate() + days);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dt = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dt}`;
      }
    }
  } catch {}
  return dateStr;
}

export const generateMilestoneInvoices = (
  paymentType: PaymentType,
  attpPercentage: string | undefined,
  installmentCount: number | string | undefined,
  totalAmount: number,
  existingInvoices?: InvoiceMilestone[],
  existingRaisedAmount?: number,
  startDateStr?: string,
  endDateStr?: string
): InvoiceMilestone[] => {
  let count = 1;
  let percentages: { label: string; pct: number }[] = [];

  if (paymentType === "FNF") {
    count = 1;
    percentages = [{ label: "Full and Final Payment (100%)", pct: 100 }];
  } else if (paymentType === "ATP") {
    count = 2;
    percentages = [
      { label: "Advance Payment (50%)", pct: 50 },
      { label: "Final Settlement (50%)", pct: 50 },
    ];
  } else if (paymentType === "ATTP") {
    const details = computeAttpDetails(attpPercentage || "50%");
    count = details.invoiceCount;
    if (count === 3) {
      percentages = [
        { label: "Milestone 1 (33.34%)", pct: 33.34 },
        { label: "Milestone 2 (33.34%)", pct: 33.34 },
        { label: "Milestone 3 (33.32%)", pct: 33.32 },
      ];
    } else if (count === 4 && (details.normalizedPercentage === "25%" || details.displayVal === "25")) {
      percentages = [
        { label: "Milestone 1 (25%)", pct: 25 },
        { label: "Milestone 2 (25%)", pct: 25 },
        { label: "Milestone 3 (25%)", pct: 25 },
        { label: "Milestone 4 (25%)", pct: 25 },
      ];
    } else if (count === 2 && (details.normalizedPercentage === "75%" || details.displayVal === "75")) {
      percentages = [
        { label: "Advance Milestone (75%)", pct: 75 },
        { label: "Final Milestone (25%)", pct: 25 },
      ];
    } else if (count === 1) {
      percentages = [{ label: "Milestone 1 (100%)", pct: 100 }];
    } else {
      const basePct = 100 / count;
      percentages = Array.from({ length: count }, (_, i) => {
        const isLast = i === count - 1;
        const previousTotal = Number((basePct * i).toFixed(2));
        const thisPct = isLast ? Number((100 - previousTotal).toFixed(2)) : Number(basePct.toFixed(2));
        return {
          label: `Milestone ${i + 1} (${thisPct}%)`,
          pct: thisPct,
        };
      });
    }
  } else if (paymentType === "EMI") {
    count = Math.max(1, Math.min(12, Number(installmentCount) || 5));
    const basePct = 100 / count;
    percentages = Array.from({ length: count }, (_, i) => {
      const isLast = i === count - 1;
      const prevSum = Number((basePct * i).toFixed(2));
      const thisPct = isLast ? Number((100 - prevSum).toFixed(2)) : Number(basePct.toFixed(2));
      return {
        label: `Installment ${i + 1} of ${count} (${thisPct}%)`,
        pct: thisPct,
      };
    });
  }

  let accumulatedRaised = 0;
  const targetRaised = existingRaisedAmount ?? 0;

  return percentages.map((item, idx) => {
    const existing = existingInvoices?.[idx];
    const itemAmount = Math.round((totalAmount * item.pct) / 100);
    let isRaised = false;
    let dateRaised = existing?.dateRaised || "";
    let isReceived = false;
    let dateReceived = existing?.dateReceived || "";

    if (existingInvoices && existingInvoices.length === percentages.length && existing) {
      isRaised = Boolean(existing.isRaised);
      dateRaised = existing.dateRaised || "";
      isReceived = Boolean(existing.isReceived);
      dateReceived = existing.dateReceived || "";
    } else if (targetRaised > 0) {
      if (accumulatedRaised + itemAmount <= targetRaised + 50 || (idx === 0 && targetRaised >= itemAmount * 0.4)) {
        isRaised = true;
        dateRaised = startDateStr || new Date().toISOString().slice(0, 10);
        accumulatedRaised += itemAmount;
      }
    }

    // Default scheduled date if not set
    if (!dateRaised && startDateStr) {
      if (percentages.length === 1) {
        dateRaised = startDateStr;
      } else if (percentages.length === 2) {
        dateRaised = idx === 0 ? startDateStr : (endDateStr || addDaysToDateStr(startDateStr, 30));
      } else {
        dateRaised = addDaysToDateStr(startDateStr, idx * 30);
      }
    }

    if (isReceived && !dateReceived && dateRaised) {
      dateReceived = addDaysToDateStr(dateRaised, 15);
    }

    return {
      id: existing?.id || `inv-${idx + 1}-${idx}`,
      invoiceNumber: idx + 1,
      label: item.label,
      percentage: item.pct,
      amount: itemAmount,
      isRaised,
      dateRaised,
      raisedProofUrl: existing?.raisedProofUrl,
      raisedProofName: existing?.raisedProofName,
      isReceived,
      dateReceived,
      receivedProofUrl: existing?.receivedProofUrl,
      receivedProofName: existing?.receivedProofName,
      invoiceCode: existing?.invoiceCode || `INV-${String(idx + 1).padStart(2, "0")}`,
    };
  });
};

/**
 * Calculates number of invoices raised, total invoices, amounts, and progress
 */
export function getProjectInvoiceStats(project: Project) {
  // Total planned invoices (y in x of y Raised) comes directly from Sheet 1 Column U (No of Invoices)
  const rawInvoiceCount = typeof project.invoice_count === "number" ? project.invoice_count : Number(project.invoice_count);
  const rawInstallmentCount = typeof project.installment_count === "number" ? project.installment_count : Number(project.installment_count);
  
  const hasTotalCount = (!isNaN(rawInvoiceCount) && rawInvoiceCount > 0) || (!isNaN(rawInstallmentCount) && rawInstallmentCount > 0);
  const totalCount = hasTotalCount ? (rawInvoiceCount > 0 ? rawInvoiceCount : rawInstallmentCount) : 0;
  const totalGst = Number(project.gst_cost) || (Number(project.total_cost_value) * 1.18);

  const hasDirectInvoices = Boolean(project.invoices && project.invoices.length > 0);
  const milestoneInvoices = hasDirectInvoices
    ? project.invoices!
    : (totalCount > 0
        ? generateMilestoneInvoices(
            project.payment_type || "FNF",
            project.attp_percentage || "50%",
            totalCount,
            totalGst,
            undefined,
            project.invoice_raised || 0
          )
        : []);

  // x = How many times Received based on Column M (Status) in Invoice Tracker sheet
  const receivedCount = milestoneInvoices.filter(
    (i) =>
      i.isReceived ||
      (i.status && i.status.toLowerCase().includes("rec")) ||
      (i.status && i.status.toLowerCase().includes("paid")) ||
      (i.status && i.status.toLowerCase().includes("clear"))
  ).length;

  const raisedCount = receivedCount; // x is number of times received from Column M!

  // If total planned count (Column U) is missing/0 or invoice data is missing
  const isMissing = !hasTotalCount;

  const totalReceivedAmount = milestoneInvoices
    .filter((i) => i.isReceived || (i.status && i.status.toLowerCase().includes("rec")))
    .reduce((sum, i) => sum + (i.amountRaised || i.amount || 0), 0);

  const raisedAmount = Number(project.invoice_raised) || totalReceivedAmount;
  const pendingAmount = Math.max(0, totalGst - raisedAmount);
  const raisedPct = totalGst > 0 ? Math.min(100, Math.round((raisedAmount / totalGst) * 100)) : 0;

  return {
    raisedCount,
    receivedCount,
    totalCount,
    hasTotalCount,
    isMissing,
    raisedAmount,
    pendingAmount,
    raisedPct,
    milestoneInvoices,
  };
}

export const createEmptyDraft = (existingProject?: Project): ProjectDraft => {
  if (existingProject) {
    const defaultPhase = existingProject.phases?.[0] || {
      phase: "Phase 1",
      startDate: "",
      endDate: "",
    };
    return {
      id: existingProject.id,
      collegeName: existingProject.college_name || "",
      projectCode: existingProject.project_code || "",
      academicYear: existingProject.academic_year || "3rd Year",
      passingYear: existingProject.passing_year || "2026",
      studentCount: String(existingProject.student_count || 0),
      costPerStudent: String(existingProject.cost_per_student || 0),
      totalCostValue: String(existingProject.total_cost_value || 0),
      gstCost: String(existingProject.gst_cost || 0),
      manualTotal: Boolean(existingProject.manual_total_cost),
      manualGst: Boolean(existingProject.manual_gst_cost),
      additionalNotes: existingProject.additional_notes || "",
      selectedPhase: defaultPhase.phase,
      phaseStartDate: defaultPhase.startDate || "",
      phaseEndDate: defaultPhase.endDate || "",
      hoursPlanned: String(existingProject.hours_planned || 0),
      hoursGiven: String(existingProject.hours_given || 0),
      trainingCost: String(existingProject.training_cost || 0),
      paymentType: existingProject.payment_type || "FNF",
      attpPercentage: existingProject.attp_percentage || "50%",
      installmentCount: String(existingProject.installment_count || 1),
      invoiceCount: String(existingProject.invoice_count || 1),
      invoiceRaised: String(existingProject.invoice_raised || 0),
      phases: existingProject.phases?.length ? [...existingProject.phases] : [
        { phase: "Phase 1", startDate: "", endDate: "" }
      ],
    };
  }

  return {
    collegeName: "",
    projectCode: "",
    academicYear: "1st Year",
    passingYear: "2026",
    studentCount: "",
    costPerStudent: "",
    totalCostValue: "0",
    gstCost: "0",
    manualTotal: false,
    manualGst: false,
    additionalNotes: "",
    selectedPhase: "Phase 1",
    phaseStartDate: "",
    phaseEndDate: "",
    hoursPlanned: "",
    hoursGiven: "",
    trainingCost: "",
    paymentType: "FNF",
    attpPercentage: "50%",
    installmentCount: "1",
    invoiceCount: "1",
    invoiceRaised: "0",
    phases: [
      { phase: "Phase 1", startDate: "", endDate: "" }
    ],
  };
};
