import type { Project, ProjectDraft, PaymentType, InvoiceMilestone } from "./models";

export const INITIAL_PROJECTS: Project[] = [
  {
    id: "proj-1",
    college_name: "Dr. DY Patil Institute",
    project_code: "DYPIEMR-001",
    academic_year: "4th Year",
    passing_year: "2026",
    student_count: 120,
    cost_per_student: 4166.67,
    total_cost_value: 500000,
    gst_cost: 590000,
    phases: [
      {
        id: "p1",
        phase: "Phase 1",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        hoursPlanned: 40,
        hoursGiven: 35,
        trainingCost: 50000,
        paymentType: "FNF",
        invoiceCount: 1,
      },
      {
        id: "p2",
        phase: "Phase 2",
        startDate: "2026-02-01",
        endDate: "2026-02-28",
        hoursPlanned: 40,
        hoursGiven: 35,
        trainingCost: 45000,
        paymentType: "ATP",
        invoiceCount: 2,
      },
      {
        id: "p3",
        phase: "Phase 3",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        hoursPlanned: 40,
        hoursGiven: 40,
        trainingCost: 55000,
        paymentType: "EMI",
        invoiceCount: 5,
      },
    ],
    hours_planned: 120,
    hours_given: 110,
    training_cost: 500000,
    payment_type: "EMI",
    installment_count: 5,
    invoice_count: 5,
    invoice_raised: 300000,
    additional_notes: "Full stack web development & AI training programme for 2026 batch.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "proj-2",
    college_name: "Pimpri Chinchwad College",
    project_code: "PCCOE-002",
    academic_year: "3rd Year",
    passing_year: "2026",
    student_count: 70,
    cost_per_student: 5000,
    total_cost_value: 350000,
    gst_cost: 413000,
    phases: [
      {
        id: "p2-1",
        phase: "Phase 1",
        startDate: "2026-01-15",
        endDate: "2026-02-15",
        hoursPlanned: 50,
        hoursGiven: 50,
        trainingCost: 150000,
        paymentType: "ATP",
        invoiceCount: 2,
      },
      {
        id: "p2-2",
        phase: "Phase 2",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        hoursPlanned: 40,
        hoursGiven: 40,
        trainingCost: 170000,
        paymentType: "ATP",
        invoiceCount: 2,
      },
    ],
    hours_planned: 90,
    hours_given: 90,
    training_cost: 320000,
    payment_type: "ATP",
    installment_count: 2,
    invoice_count: 2,
    invoice_raised: 413000,
    additional_notes: "Completed phase 1 and 2 delivery. All invoices cleared.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "proj-3",
    college_name: "Rajarshi Shahu College",
    project_code: "RSCOE-003",
    academic_year: "3rd Year",
    passing_year: "2026",
    student_count: 100,
    cost_per_student: 4200,
    total_cost_value: 420000,
    gst_cost: 495600,
    phases: [
      {
        id: "p3-1",
        phase: "Phase 1",
        startDate: "2026-01-10",
        endDate: "2026-02-10",
        hoursPlanned: 45,
        hoursGiven: 40,
        trainingCost: 200000,
        paymentType: "EMI",
        invoiceCount: 4,
      },
    ],
    hours_planned: 80,
    hours_given: 40,
    training_cost: 390000,
    payment_type: "EMI",
    installment_count: 4,
    invoice_count: 4,
    invoice_raised: 200000,
    additional_notes: "Cloud & DevOps engineering track.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "proj-4",
    college_name: "Vishwakarma Institute",
    project_code: "VIIT-004",
    academic_year: "4th Year",
    passing_year: "2026",
    student_count: 150,
    cost_per_student: 4000,
    total_cost_value: 600000,
    gst_cost: 708000,
    phases: [
      {
        id: "p4-1",
        phase: "Phase 1",
        startDate: "2026-02-01",
        endDate: "2026-03-15",
        hoursPlanned: 60,
        hoursGiven: 20,
        trainingCost: 250000,
        paymentType: "ATTP",
        invoiceCount: 3,
      },
    ],
    hours_planned: 120,
    hours_given: 20,
    training_cost: 550000,
    payment_type: "ATTP",
    installment_count: 3,
    invoice_count: 3,
    invoice_raised: 0,
    additional_notes: "Data science and analytics fast-track workshop.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "proj-5",
    college_name: "MIT Academy of Engineering",
    project_code: "MITAOE-005",
    academic_year: "2nd Year",
    passing_year: "2026",
    student_count: 55,
    cost_per_student: 5000,
    total_cost_value: 275000,
    gst_cost: 324500,
    phases: [
      {
        id: "p5-1",
        phase: "Phase 1",
        startDate: "2026-01-05",
        endDate: "2026-01-28",
        hoursPlanned: 40,
        hoursGiven: 40,
        trainingCost: 120000,
        paymentType: "ATP",
        invoiceCount: 2,
      },
    ],
    hours_planned: 60,
    hours_given: 40,
    training_cost: 250000,
    payment_type: "ATP",
    installment_count: 2,
    invoice_count: 2,
    invoice_raised: 150000,
    additional_notes: "Cybersecurity and ethical hacking lab training.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "proj-6",
    college_name: "Sinhgad College",
    project_code: "SCTR-006",
    academic_year: "3rd Year",
    passing_year: "2026",
    student_count: 120,
    cost_per_student: 4000,
    total_cost_value: 480000,
    gst_cost: 566400,
    phases: [
      {
        id: "p6-1",
        phase: "Phase 1",
        startDate: "2025-12-01",
        endDate: "2026-01-15",
        hoursPlanned: 40,
        hoursGiven: 40,
        trainingCost: 200000,
        paymentType: "EMI",
        invoiceCount: 4,
      },
    ],
    hours_planned: 90,
    hours_given: 85,
    training_cost: 440000,
    payment_type: "EMI",
    installment_count: 4,
    invoice_count: 4,
    invoice_raised: 500000,
    additional_notes: "Software testing and automated QA training.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "proj-7",
    college_name: "AISSMS College",
    project_code: "AISSMS-007",
    academic_year: "1st Year",
    passing_year: "2026",
    student_count: 80,
    cost_per_student: 4000,
    total_cost_value: 320000,
    gst_cost: 377600,
    phases: [
      {
        id: "p7-1",
        phase: "Phase 1",
        startDate: "2026-02-15",
        endDate: "2026-03-30",
        hoursPlanned: 50,
        hoursGiven: 10,
        trainingCost: 150000,
        paymentType: "FNF",
        invoiceCount: 1,
      },
    ],
    hours_planned: 70,
    hours_given: 10,
    training_cost: 300000,
    payment_type: "FNF",
    installment_count: 1,
    invoice_count: 1,
    invoice_raised: 0,
    additional_notes: "Modern UI/UX frontend development.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "proj-8",
    college_name: "College of Engineering Pune",
    project_code: "COEP-008",
    academic_year: "4th Year",
    passing_year: "2026",
    student_count: 150,
    cost_per_student: 5000,
    total_cost_value: 750000,
    gst_cost: 885000,
    phases: [
      {
        id: "p8-1",
        phase: "Phase 1",
        startDate: "2025-11-01",
        endDate: "2025-12-15",
        hoursPlanned: 50,
        hoursGiven: 50,
        trainingCost: 220000,
        paymentType: "EMI",
        invoiceCount: 5,
      },
      {
        id: "p8-2",
        phase: "Phase 2",
        startDate: "2026-01-05",
        endDate: "2026-02-20",
        hoursPlanned: 50,
        hoursGiven: 45,
        trainingCost: 230000,
        paymentType: "EMI",
        invoiceCount: 5,
      },
    ],
    hours_planned: 140,
    hours_given: 95,
    training_cost: 680000,
    payment_type: "EMI",
    installment_count: 5,
    invoice_count: 5,
    invoice_raised: 600000,
    additional_notes: "Deep learning & computer vision specialization.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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

export const generateMilestoneInvoices = (
  paymentType: PaymentType,
  attpPercentage: string | undefined,
  installmentCount: number | string | undefined,
  totalAmount: number,
  existingInvoices?: InvoiceMilestone[],
  existingRaisedAmount?: number
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
      dateRaised = existing.dateRaised || (isRaised ? new Date().toISOString().slice(0, 10) : "");
      isReceived = Boolean(existing.isReceived);
      dateReceived = existing.dateReceived || (isReceived ? new Date().toISOString().slice(0, 10) : "");
    } else if (targetRaised > 0) {
      if (accumulatedRaised + itemAmount <= targetRaised + 50 || (idx === 0 && targetRaised >= itemAmount * 0.4)) {
        isRaised = true;
        dateRaised = new Date().toISOString().slice(0, 10);
        accumulatedRaised += itemAmount;
      }
    }

    return {
      id: existing?.id || `inv-${idx + 1}-${idx}`,
      invoiceNumber: idx + 1,
      label: item.label,
      percentage: item.pct,
      amount: itemAmount,
      isRaised,
      dateRaised,
      isReceived,
      dateReceived,
      invoiceCode: existing?.invoiceCode || `INV-${String(idx + 1).padStart(2, "0")}`,
    };
  });
};

/**
 * Calculates number of invoices raised, total invoices, amounts, and progress
 */
export function getProjectInvoiceStats(project: Project) {
  const totalCount = Math.max(1, project.invoice_count || project.installment_count || 1);
  const totalGst = Number(project.gst_cost) || (Number(project.total_cost_value) * 1.18);
  const milestoneInvoices = generateMilestoneInvoices(
    project.payment_type || "FNF",
    project.attp_percentage || "50%",
    totalCount,
    totalGst,
    project.invoices,
    project.invoice_raised || 0
  );
  const raisedCount = milestoneInvoices.filter((i) => i.isRaised).length;
  const raisedAmount = Number(project.invoice_raised) || 0;
  const pendingAmount = Math.max(0, totalGst - raisedAmount);
  const raisedPct = totalGst > 0 ? Math.min(100, Math.round((raisedAmount / totalGst) * 100)) : 0;

  return {
    raisedCount,
    totalCount,
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
