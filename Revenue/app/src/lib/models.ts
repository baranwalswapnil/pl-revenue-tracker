export type PaymentType = "FNF" | "ATP" | "ATTP" | "EMI";

export type ATTPPercentage = string;

export type PhaseType = "Phase 1" | "Phase 2" | "Phase 3";

export type TrainingPhase = {
  id?: string;
  phase: PhaseType;
  startDate: string;
  endDate: string;
  hoursPlanned?: number;
  hoursGiven?: number;
  trainingCost?: number;
  paymentType?: PaymentType;
  attpPercentage?: ATTPPercentage;
  invoiceCount?: number;
};

export type InvoiceMilestone = {
  id: string;
  invoiceNumber: number;
  label: string;
  percentage: number;
  amount: number;
  amountFromMou?: number;
  amountRaised?: number;
  isRaised: boolean;
  dateRaised?: string;
  raisedProofUrl?: string;
  raisedProofName?: string;
  isReceived?: boolean;
  dateReceived?: string;
  receivedProofUrl?: string;
  receivedProofName?: string;
  invoiceCode?: string;
  invoiceType?: string;
  status?: string;
  remarks?: string;
  gaInvoiceCode?: string;
  printed?: string | boolean;
  tdsStatus?: string;
};

export type Project = {
  id: string;
  college_name: string;
  project_code: string;
  academic_year: string;
  passing_year: string;
  student_count: number;
  cost_per_student: number;
  total_cost_value: number;
  gst_cost: number;
  manual_total_cost?: boolean;
  manual_gst_cost?: boolean;
  phases: TrainingPhase[];
  hours_planned: number;
  hours_given: number;
  training_cost: number;
  payment_type: PaymentType;
  attp_percentage?: ATTPPercentage;
  installment_count: number;
  invoice_count: number;
  invoice_raised: number;
  invoice_received?: number;
  raised_invoice_proof?: string;
  received_invoice_proof?: string;
  invoices?: InvoiceMilestone[];
  additional_notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type Organization = {
  id: string;
  name: string;
  role: "owner" | "member";
};

export type ProjectDraft = {
  id?: string;
  collegeName: string;
  projectCode: string;
  academicYear: string;
  passingYear: string;
  studentCount: string;
  costPerStudent: string;
  totalCostValue: string;
  gstCost: string;
  manualTotal: boolean;
  manualGst: boolean;
  additionalNotes: string;
  // Step 3 Training Phase specific draft state
  selectedPhase: PhaseType;
  phaseStartDate: string;
  phaseEndDate: string;
  hoursPlanned: string;
  hoursGiven: string;
  trainingCost: string;
  paymentType: PaymentType;
  attpPercentage: ATTPPercentage;
  installmentCount: string;
  invoiceCount: string;
  invoiceRaised: string;
  invoiceReceived?: string;
  invoices?: InvoiceMilestone[];
  phases: TrainingPhase[];
};