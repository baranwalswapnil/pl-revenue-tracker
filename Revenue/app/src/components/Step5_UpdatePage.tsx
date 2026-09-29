import React, { useState } from "react";
import {
  Building2,
  FileText,
  Calendar,
  GraduationCap,
  Users,
  Coins,
  Calculator,
  Percent,
  Edit2,
  Edit3,
  RotateCcw,
  Save,
  Check,
  Plus,
  Trash2,
  ArrowLeft,
  Info,
  CheckCircle2,
  Layers,
  CreditCard,
  ListOrdered,
  CheckSquare,
  Square,
  Clock,
  DollarSign,
  Camera,
  Paperclip,
  ExternalLink,
  X,
  UploadCloud,
  FileCheck,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import type { Project, TrainingPhase, PaymentType, PhaseType, InvoiceMilestone } from "../lib/models";
import { formatINR, computeAttpDetails, generateMilestoneInvoices } from "../lib/mockData";
import {
  type GoogleSheetCollegeItem,
  uploadInvoiceProofToDrive,
  loadSavedSheetConfig,
  GOOGLE_DRIVE_FOLDERS,
} from "../lib/googleSheetsService";

interface Step5UpdatePageProps {
  project: Project;
  onSaveProject: (updated: Project) => void;
  onBackToDashboard: () => void;
  onResetToOriginal: () => void;
  googleSheetColleges?: GoogleSheetCollegeItem[];
  onOpenGoogleSheetSync?: () => void;
}

export const Step5_UpdatePage: React.FC<Step5UpdatePageProps> = ({
  project,
  onSaveProject,
  onBackToDashboard,
  onResetToOriginal,
  googleSheetColleges = [],
  onOpenGoogleSheetSync,
}) => {
  const [formData, setFormData] = useState<Project>({ ...project });
  const [editingTotalCost, setEditingTotalCost] = useState(false);
  const [editingGstCost, setEditingGstCost] = useState(false);
  const [editingTrainingCost, setEditingTrainingCost] = useState(false);
  const [sheetSyncAlert, setSheetSyncAlert] = useState<string | null>(null);

  // Invoices milestone checklist state
  const [invoices, setInvoices] = useState<InvoiceMilestone[]>(() => {
    const totalAmount = project.gst_cost || project.total_cost_value * 1.18;
    return generateMilestoneInvoices(
      project.payment_type || "FNF",
      project.attp_percentage || "50%",
      project.installment_count || 5,
      totalAmount,
      project.invoices,
      project.invoice_raised
    );
  });

  // Uploading state for proof attachments
  const [uploadingIdx, setUploadingIdx] = useState<{ index: number; type: "raised" | "received" } | null>(null);
  const [proofToast, setProofToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const handleUploadProof = async (index: number, type: "raised" | "received", file: File) => {
    setUploadingIdx({ index, type });
    try {
      const result = await uploadInvoiceProofToDrive({
        file,
        type,
        projectCode: formData.project_code,
        collegeName: formData.college_name,
        invoiceCode: invoices[index]?.invoiceCode || `INV-${String(index + 1).padStart(2, "0")}`,
        milestoneIndex: index,
      });

      const updated = [...invoices];
      if (type === "raised") {
        updated[index] = {
          ...updated[index],
          isRaised: true, // Automatically tick when proof is uploaded
          dateRaised: updated[index].dateRaised || new Date().toISOString().slice(0, 10),
          raisedProofUrl: result.fileUrl,
          raisedProofName: file.name,
        };
      } else {
        updated[index] = {
          ...updated[index],
          isReceived: true, // Automatically tick when payment proof is uploaded
          dateReceived: updated[index].dateReceived || new Date().toISOString().slice(0, 10),
          receivedProofUrl: result.fileUrl,
          receivedProofName: file.name,
        };
      }

      setInvoices(updated);

      const allRaised = updated.map((i) => i.raisedProofUrl).filter(Boolean).join("\n");
      const allReceived = updated.map((i) => i.receivedProofUrl).filter(Boolean).join("\n");
      const raisedSum = updated.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
      const receivedSum = updated.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

      setFormData((prev) => ({
        ...prev,
        invoices: updated,
        raised_invoice_proof: allRaised,
        received_invoice_proof: allReceived,
        invoice_raised: raisedSum,
        invoice_received: receivedSum,
      }));

      setProofToast({ message: result.message });
      setTimeout(() => setProofToast(null), 4500);
    } catch (err: any) {
      setProofToast({ message: `Upload error: ${err.message}`, isError: true });
      setTimeout(() => setProofToast(null), 4500);
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleRemoveProof = (index: number, type: "raised" | "received") => {
    const updated = [...invoices];
    if (type === "raised") {
      updated[index] = {
        ...updated[index],
        raisedProofUrl: undefined,
        raisedProofName: undefined,
      };
    } else {
      updated[index] = {
        ...updated[index],
        receivedProofUrl: undefined,
        receivedProofName: undefined,
      };
    }
    setInvoices(updated);

    const allRaised = updated.map((i) => i.raisedProofUrl).filter(Boolean).join("\n");
    const allReceived = updated.map((i) => i.receivedProofUrl).filter(Boolean).join("\n");

    setFormData((prev) => ({
      ...prev,
      invoices: updated,
      raised_invoice_proof: allRaised,
      received_invoice_proof: allReceived,
    }));
  };

  // Handle reload directly from Google Sheet data if matching
  const handleReloadFromSheet = () => {
    const code = formData.project_code.trim().toLowerCase();
    const name = formData.college_name.trim().toLowerCase();
    const match = googleSheetColleges.find(
      (c) =>
        (c.project_code && c.project_code.trim().toLowerCase() === code) ||
        (c.college_name && c.college_name.trim().toLowerCase() === name)
    );

    if (match) {
      const newTotal = match.total_cost_value || match.student_count * match.cost_per_student;
      const newGst = match.gst_cost || newTotal * 1.18;

      const newInvoices = generateMilestoneInvoices(
        match.payment_type,
        match.attp_percentage,
        match.invoice_count,
        newGst,
        invoices,
        formData.invoice_raised
      );

      const raisedSum = newInvoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
      const receivedSum = newInvoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

      setFormData((prev) => ({
        ...prev,
        college_name: match.college_name,
        project_code: match.project_code,
        academic_year: match.academic_year,
        passing_year: match.passing_year,
        student_count: match.student_count,
        cost_per_student: match.cost_per_student,
        total_cost_value: newTotal,
        gst_cost: newGst,
        hours_planned: match.hours_planned,
        payment_type: match.payment_type,
        attp_percentage: match.attp_percentage,
        installment_count: match.invoice_count,
        invoice_count: match.invoice_count,
        invoice_raised: raisedSum,
        invoice_received: receivedSum,
        invoices: newInvoices,
        additional_notes: match.additional_notes || prev.additional_notes,
      }));
      setInvoices(newInvoices);
      setSheetSyncAlert(`Synced updated values for ${match.college_name} from Google Sheet!`);
      setTimeout(() => setSheetSyncAlert(null), 4000);
    } else {
      if (onOpenGoogleSheetSync) {
        onOpenGoogleSheetSync();
      } else {
        alert("No exact match found in current Google Sheet cache. Please sync your spreadsheet.");
      }
    }
  };

  // ATTP custom percentage input state
  const [attpInput, setAttpInput] = useState<string>(() => {
    const initial = formData.attp_percentage || "50%";
    return initial.replace("%", "").trim();
  });

  // Recalculate auto values when student_count or cost_per_student change
  const handleStudentsOrCostChange = (field: "student_count" | "cost_per_student", value: number) => {
    const students = field === "student_count" ? value : formData.student_count;
    const cost = field === "cost_per_student" ? value : formData.cost_per_student;
    const autoTotal = students * cost;
    const autoGst = autoTotal * 1.18;

    const newTotalCost = formData.manual_total_cost ? formData.total_cost_value : autoTotal;
    const newGstCost = formData.manual_gst_cost ? formData.gst_cost : autoGst;

    // Rescale invoices with new GST cost
    const updatedInvoices = generateMilestoneInvoices(
      formData.payment_type,
      formData.attp_percentage,
      formData.installment_count,
      newGstCost,
      invoices,
      formData.invoice_raised
    );

    const raisedSum = updatedInvoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
    const receivedSum = updatedInvoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(updatedInvoices);
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      total_cost_value: newTotalCost,
      gst_cost: newGstCost,
      invoice_raised: raisedSum,
      invoice_received: receivedSum,
      invoice_count: updatedInvoices.length,
      invoices: updatedInvoices,
    }));
  };

  const handleManualTotalCost = (val: number) => {
    const newGst = formData.manual_gst_cost ? formData.gst_cost : val * 1.18;
    const updatedInvoices = generateMilestoneInvoices(
      formData.payment_type,
      formData.attp_percentage,
      formData.installment_count,
      newGst,
      invoices,
      formData.invoice_raised
    );
    const raisedSum = updatedInvoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
    const receivedSum = updatedInvoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(updatedInvoices);
    setFormData((prev) => ({
      ...prev,
      total_cost_value: val,
      manual_total_cost: true,
      gst_cost: newGst,
      invoice_raised: raisedSum,
      invoice_received: receivedSum,
      invoice_count: updatedInvoices.length,
      invoices: updatedInvoices,
    }));
  };

  const handleManualGstCost = (val: number) => {
    const updatedInvoices = generateMilestoneInvoices(
      formData.payment_type,
      formData.attp_percentage,
      formData.installment_count,
      val,
      invoices,
      formData.invoice_raised
    );
    const raisedSum = updatedInvoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
    const receivedSum = updatedInvoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(updatedInvoices);
    setFormData((prev) => ({
      ...prev,
      gst_cost: val,
      manual_gst_cost: true,
      invoice_raised: raisedSum,
      invoice_received: receivedSum,
      invoice_count: updatedInvoices.length,
      invoices: updatedInvoices,
    }));
  };

  // Phase management
  const handleAddPhase = () => {
    const phases = formData.phases || [];
    const phaseOrder: PhaseType[] = ["Phase 1", "Phase 2", "Phase 3"];
    const used = new Set(phases.map((p) => p.phase));
    const nextPhase = phaseOrder.find((p) => !used.has(p)) || "Phase 3";

    const newPhase: TrainingPhase = {
      id: crypto.randomUUID(),
      phase: nextPhase,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      hoursPlanned: 40,
      hoursGiven: 0,
    };

    const updatedPhases = [...phases, newPhase];
    const totalPlannedHours = updatedPhases.reduce((sum, p) => sum + (p.hoursPlanned || 0), 0);
    const totalGivenHours = updatedPhases.reduce((sum, p) => sum + (p.hoursGiven || 0), 0);

    setFormData((prev) => ({
      ...prev,
      phases: updatedPhases,
      hours_planned: totalPlannedHours,
      hours_given: totalGivenHours,
    }));
  };

  const handleUpdatePhase = (index: number, field: keyof TrainingPhase, value: any) => {
    const updatedPhases = (formData.phases || []).map((p, i) => {
      if (i !== index) return p;
      return { ...p, [field]: value };
    });

    const totalPlannedHours = updatedPhases.reduce((sum, p) => sum + (Number(p.hoursPlanned) || 0), 0);
    const totalGivenHours = updatedPhases.reduce((sum, p) => sum + (Number(p.hoursGiven) || 0), 0);

    setFormData((prev) => ({
      ...prev,
      phases: updatedPhases,
      hours_planned: totalPlannedHours,
      hours_given: totalGivenHours,
    }));
  };

  const handleDeletePhase = (index: number) => {
    const updatedPhases = (formData.phases || []).filter((_, i) => i !== index);
    const totalPlannedHours = updatedPhases.reduce((sum, p) => sum + (Number(p.hoursPlanned) || 0), 0);
    const totalGivenHours = updatedPhases.reduce((sum, p) => sum + (Number(p.hoursGiven) || 0), 0);

    setFormData((prev) => ({
      ...prev,
      phases: updatedPhases,
      hours_planned: totalPlannedHours,
      hours_given: totalGivenHours,
    }));
  };

  // =========================================================================
  // Section 3: Update Invoices & Payment Plan Handlers
  // =========================================================================

  const handlePaymentTypeChange = (newType: PaymentType) => {
    let newAttp = formData.attp_percentage || "50%";
    let newInstCount = formData.installment_count || 5;

    if (newType === "ATTP") {
      const details = computeAttpDetails(formData.attp_percentage || attpInput || "50");
      newAttp = details.normalizedPercentage;
      setAttpInput(details.displayVal);
    }

    const totalAmount = formData.gst_cost || formData.total_cost_value * 1.18;
    const newInvoices = generateMilestoneInvoices(
      newType,
      newAttp,
      newInstCount,
      totalAmount,
      undefined,
      formData.invoice_raised
    );

    const raisedSum = newInvoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
    const receivedSum = newInvoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(newInvoices);
    setFormData((prev) => ({
      ...prev,
      payment_type: newType,
      attp_percentage: newAttp,
      installment_count: newInstCount,
      invoice_count: newInvoices.length,
      invoice_raised: raisedSum,
      invoice_received: receivedSum,
      invoices: newInvoices,
    }));
  };

  const handleAttpInputChange = (rawVal: string) => {
    setAttpInput(rawVal);
    if (rawVal.trim()) {
      const details = computeAttpDetails(rawVal);
      const totalAmount = formData.gst_cost || formData.total_cost_value * 1.18;
      const newInvoices = generateMilestoneInvoices(
        "ATTP",
        details.normalizedPercentage,
        formData.installment_count,
        totalAmount,
        undefined,
        formData.invoice_raised
      );
      const raisedSum = newInvoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
      const receivedSum = newInvoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

      setInvoices(newInvoices);
      setFormData((prev) => ({
        ...prev,
        attp_percentage: rawVal.includes("%") ? rawVal : `${rawVal}%`,
        invoice_count: newInvoices.length,
        invoice_raised: raisedSum,
        invoice_received: receivedSum,
        invoices: newInvoices,
      }));
    }
  };

  const handleAttpInputBlur = () => {
    const details = computeAttpDetails(attpInput);
    setAttpInput(details.displayVal);
    const totalAmount = formData.gst_cost || formData.total_cost_value * 1.18;
    const newInvoices = generateMilestoneInvoices(
      "ATTP",
      details.normalizedPercentage,
      formData.installment_count,
      totalAmount,
      undefined,
      formData.invoice_raised
    );
    const raisedSum = newInvoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
    const receivedSum = newInvoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(newInvoices);
    setFormData((prev) => ({
      ...prev,
      attp_percentage: details.normalizedPercentage,
      invoice_count: newInvoices.length,
      invoice_raised: raisedSum,
      invoice_received: receivedSum,
      invoices: newInvoices,
    }));
  };

  const handleSelectAttpPreset = (preset: string) => {
    const details = computeAttpDetails(preset);
    setAttpInput(details.displayVal);
    const totalAmount = formData.gst_cost || formData.total_cost_value * 1.18;
    const newInvoices = generateMilestoneInvoices(
      "ATTP",
      details.normalizedPercentage,
      formData.installment_count,
      totalAmount,
      undefined,
      formData.invoice_raised
    );
    const raisedSum = newInvoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
    const receivedSum = newInvoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(newInvoices);
    setFormData((prev) => ({
      ...prev,
      attp_percentage: details.normalizedPercentage,
      invoice_count: newInvoices.length,
      invoice_raised: raisedSum,
      invoice_received: receivedSum,
      invoices: newInvoices,
    }));
  };

  const handleInstallmentCountChange = (countStr: string) => {
    const countNum = Number(countStr) || 5;
    const totalAmount = formData.gst_cost || formData.total_cost_value * 1.18;
    const newInvoices = generateMilestoneInvoices(
      "EMI",
      formData.attp_percentage,
      countNum,
      totalAmount,
      undefined,
      formData.invoice_raised
    );
    const raisedSum = newInvoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
    const receivedSum = newInvoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(newInvoices);
    setFormData((prev) => ({
      ...prev,
      installment_count: countNum,
      invoice_count: newInvoices.length,
      invoice_raised: raisedSum,
      invoice_received: receivedSum,
      invoices: newInvoices,
    }));
  };

  // Toggle Raised Checkbox & Jump/Focus to Date of Raised
  const handleToggleRaised = (index: number) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = invoices.map((inv, i) => {
      if (i === index) {
        const nextRaised = !inv.isRaised;
        const nextDate = nextRaised ? (inv.dateRaised || todayStr) : "";
        return { ...inv, isRaised: nextRaised, dateRaised: nextDate };
      }
      return inv;
    });

    const raisedSum = updated.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(updated);
    setFormData((prev) => ({
      ...prev,
      invoice_raised: raisedSum,
      invoice_count: updated.length,
      invoices: updated,
    }));

    // If checked, jump to and focus date input
    if (!invoices[index].isRaised) {
      setTimeout(() => {
        const el = document.getElementById(`date-raised-${index}`);
        if (el) el.focus();
      }, 50);
    }
  };

  const handleDateRaisedChange = (index: number, val: string) => {
    const updated = invoices.map((inv, i) => {
      if (i === index) {
        const isRaised = Boolean(val.trim());
        return { ...inv, dateRaised: val, isRaised };
      }
      return inv;
    });

    const raisedSum = updated.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(updated);
    setFormData((prev) => ({
      ...prev,
      invoice_raised: raisedSum,
      invoice_count: updated.length,
      invoices: updated,
    }));
  };

  // If user doesn't fill date, untick it
  const handleDateRaisedBlur = (index: number) => {
    const inv = invoices[index];
    if (inv && inv.isRaised && !inv.dateRaised) {
      const updated = invoices.map((item, i) => {
        if (i === index) {
          return { ...item, isRaised: false, dateRaised: "" };
        }
        return item;
      });
      const raisedSum = updated.filter((item) => item.isRaised).reduce((sum, item) => sum + item.amount, 0);

      setInvoices(updated);
      setFormData((prev) => ({
        ...prev,
        invoice_raised: raisedSum,
        invoice_count: updated.length,
        invoices: updated,
      }));
    }
  };

  // Toggle Recieved Checkbox & Jump/Focus to Date of Recieved
  const handleToggleReceived = (index: number) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = invoices.map((inv, i) => {
      if (i === index) {
        const nextReceived = !inv.isReceived;
        const nextDate = nextReceived ? (inv.dateReceived || todayStr) : "";
        return { ...inv, isReceived: nextReceived, dateReceived: nextDate };
      }
      return inv;
    });

    const receivedSum = updated.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(updated);
    setFormData((prev) => ({
      ...prev,
      invoice_received: receivedSum,
      invoices: updated,
    }));

    // If checked, jump to and focus date input
    if (!invoices[index].isReceived) {
      setTimeout(() => {
        const el = document.getElementById(`date-received-${index}`);
        if (el) el.focus();
      }, 50);
    }
  };

  const handleDateReceivedChange = (index: number, val: string) => {
    const updated = invoices.map((inv, i) => {
      if (i === index) {
        const isReceived = Boolean(val.trim());
        return { ...inv, dateReceived: val, isReceived };
      }
      return inv;
    });

    const receivedSum = updated.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(updated);
    setFormData((prev) => ({
      ...prev,
      invoice_received: receivedSum,
      invoices: updated,
    }));
  };

  // If user doesn't fill date, untick it
  const handleDateReceivedBlur = (index: number) => {
    const inv = invoices[index];
    if (inv && inv.isReceived && !inv.dateReceived) {
      const updated = invoices.map((item, i) => {
        if (i === index) {
          return { ...item, isReceived: false, dateReceived: "" };
        }
        return item;
      });
      const receivedSum = updated.filter((item) => item.isReceived).reduce((sum, item) => sum + item.amount, 0);

      setInvoices(updated);
      setFormData((prev) => ({
        ...prev,
        invoice_received: receivedSum,
        invoices: updated,
      }));
    }
  };

  // Header quick batch actions
  const handleMarkAllRaised = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = invoices.map((inv) => ({
      ...inv,
      isRaised: true,
      dateRaised: inv.dateRaised || todayStr,
    }));
    const raisedSum = updated.reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(updated);
    setFormData((prev) => ({
      ...prev,
      invoice_raised: raisedSum,
      invoices: updated,
    }));
  };

  const handleMarkAllReceived = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = invoices.map((inv) => ({
      ...inv,
      isReceived: true,
      dateReceived: inv.dateReceived || todayStr,
    }));
    const receivedSum = updated.reduce((sum, inv) => sum + inv.amount, 0);

    setInvoices(updated);
    setFormData((prev) => ({
      ...prev,
      invoice_received: receivedSum,
      invoices: updated,
    }));
  };

  const handleClearAllInvoices = () => {
    const updated = invoices.map((inv) => ({
      ...inv,
      isRaised: false,
      dateRaised: "",
      isReceived: false,
      dateReceived: "",
    }));

    setInvoices(updated);
    setFormData((prev) => ({
      ...prev,
      invoice_raised: 0,
      invoice_received: 0,
      invoices: updated,
    }));
  };

  const handleUpdateInvoiceField = (index: number, field: keyof InvoiceMilestone, value: any) => {
    const updated = invoices.map((inv, i) => {
      if (i === index) {
        return { ...inv, [field]: value };
      }
      return inv;
    });
    setInvoices(updated);
    setFormData((prev) => ({
      ...prev,
      invoices: updated,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.college_name.trim()) {
      alert("Please enter a valid College Name.");
      return;
    }
    if (!formData.project_code.trim()) {
      alert("Please enter a valid Project Code.");
      return;
    }

    const raisedSum = invoices.filter((inv) => inv.isRaised).reduce((sum, inv) => sum + inv.amount, 0);
    const receivedSum = invoices.filter((inv) => inv.isReceived).reduce((sum, inv) => sum + inv.amount, 0);

    const allRaisedProofs = invoices.map((i) => i.raisedProofUrl).filter(Boolean).join("\n");
    const allReceivedProofs = invoices.map((i) => i.receivedProofUrl).filter(Boolean).join("\n");

    const finalPayload: Project = {
      ...formData,
      invoices,
      raised_invoice_proof: allRaisedProofs || formData.raised_invoice_proof || "",
      received_invoice_proof: allReceivedProofs || formData.received_invoice_proof || "",
      invoice_count: invoices.length,
      invoice_raised: raisedSum,
      invoice_received: receivedSum,
      updated_at: new Date().toISOString(),
    };

    onSaveProject(finalPayload);
  };

  const getPhaseBadgeClass = (phaseName: string) => {
    if (phaseName === "Phase 1") return "phase-badge-blue";
    if (phaseName === "Phase 2") return "phase-badge-green";
    return "phase-badge-amber";
  };

  const totalContractValWithGst = formData.gst_cost || (formData.total_cost_value * 1.18);
  const tickedRaisedCount = invoices.filter((inv) => inv.isRaised).length;
  const tickedReceivedCount = invoices.filter((inv) => inv.isReceived).length;
  const totalRaisedAmount = formData.invoice_raised || 0;
  const totalReceivedAmount = formData.invoice_received || 0;
  const remainingToRaise = Math.max(0, totalContractValWithGst - totalRaisedAmount);
  const remainingToReceive = Math.max(0, totalRaisedAmount - totalReceivedAmount);

  return (
    <div className="update-page-container">
      {/* Top Banner */}
      <div className="update-page-banner">
        <div className="update-banner-left">
          <button
            type="button"
            className="update-back-btn"
            onClick={onBackToDashboard}
            aria-label="Back to Projects"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className="update-banner-icon">
            <Edit3 size={24} />
          </div>
          <div>
            <h1 className="update-banner-title">Update College Project Details</h1>
            <p className="update-banner-subtitle">
              Modify college financials, training phases and manage raised & received invoice dates below.
            </p>
          </div>
        </div>

        <div className="update-banner-right-actions">
          <button
            type="button"
            className="gsheet-sync-trigger-btn"
            onClick={handleReloadFromSheet}
            title="Refresh latest numbers for this college from Google Spreadsheet"
          >
            <RefreshCw size={14} />
            <span>Sync from Google Sheet</span>
          </button>
          <div className="editing-status-pill">
            <CheckCircle2 size={16} />
            <span>Editing: {formData.college_name || "Project"}</span>
          </div>
        </div>
      </div>

      {sheetSyncAlert && (
        <div className="gsheet-alert success-alert" style={{ marginBottom: "1rem" }}>
          <CheckCircle2 size={18} />
          <span>{sheetSyncAlert}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="update-form-main">
        {/* Section 1: College & Project Details */}
        <section className="update-section-card">
          <div className="section-card-header">
            <div className="step-badge">1</div>
            <h2 className="section-card-title">College & Project Details</h2>
          </div>

          <div className="update-details-split-layout">
            {/* Left 6 input grid */}
            <div className="details-inputs-grid">
              <div className="form-field-group">
                <label className="field-label-text" htmlFor="editCollegeName">
                  <Building2 size={15} className="label-icon" />
                  <span>College Name <span className="req-star">*</span></span>
                </label>
                <input
                  type="text"
                  id="editCollegeName"
                  name="edit_college_name_no_autocomplete"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  className="styled-input-control"
                  value={formData.college_name}
                  onChange={(e) => setFormData({ ...formData, college_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-field-group">
                <label className="field-label-text" htmlFor="editProjectCode">
                  <FileText size={15} className="label-icon" />
                  <span>Project Code <span className="req-star">*</span></span>
                </label>
                <input
                  type="text"
                  id="editProjectCode"
                  name="edit_project_code_no_autocomplete"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  className="styled-input-control"
                  value={formData.project_code}
                  onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                  required
                />
              </div>

              <div className="form-field-group">
                <label className="field-label-text" htmlFor="editAcademicYear">
                  <Calendar size={15} className="label-icon" />
                  <span>Academic Year <span className="req-star">*</span></span>
                </label>
                <select
                  id="editAcademicYear"
                  className="styled-select-control"
                  value={formData.academic_year}
                  onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div className="form-field-group">
                <label className="field-label-text" htmlFor="editPassingYear">
                  <GraduationCap size={15} className="label-icon" />
                  <span>Passing Year <span className="req-star">*</span></span>
                </label>
                <select
                  id="editPassingYear"
                  className="styled-select-control"
                  value={formData.passing_year || "2026"}
                  onChange={(e) => setFormData({ ...formData, passing_year: e.target.value })}
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                  <option value="2029">2029</option>
                </select>
              </div>

              <div className="form-field-group">
                <label className="field-label-text" htmlFor="editStudentCount">
                  <Users size={15} className="label-icon" />
                  <span>No. of Students <span className="req-star">*</span></span>
                </label>
                <input
                  type="number"
                  id="editStudentCount"
                  name="edit_student_count_no_autocomplete"
                  autoComplete="off"
                  data-lpignore="true"
                  className="styled-input-control"
                  min="0"
                  step="1"
                  value={formData.student_count}
                  onChange={(e) =>
                    handleStudentsOrCostChange("student_count", Math.max(0, Number(e.target.value) || 0))
                  }
                  required
                />
              </div>

              <div className="form-field-group">
                <label className="field-label-text" htmlFor="editCostPerStudent">
                  <Coins size={15} className="label-icon" />
                  <span>Cost Per Student (₹) <span className="req-star">*</span></span>
                </label>
                <input
                  type="number"
                  id="editCostPerStudent"
                  name="edit_cost_per_student_no_autocomplete"
                  autoComplete="off"
                  data-lpignore="true"
                  className="styled-input-control"
                  min="0"
                  step="0.01"
                  value={formData.cost_per_student}
                  onChange={(e) =>
                    handleStudentsOrCostChange("cost_per_student", Math.max(0, Number(e.target.value) || 0))
                  }
                  required
                />
              </div>
            </div>

            {/* Right Auto Calculated Values (Editable) Box */}
            <div className="auto-calc-box-panel">
              <div className="auto-calc-panel-header">
                <Calculator size={17} className="panel-calc-icon" />
                <span>Auto Calculated Values (Editable)</span>
              </div>

              {/* Total Cost Value with GST box */}
              <div className="calc-item-card">
                <div className="calc-item-header">
                  <div>
                    <span className="calc-item-name">Total Cost Value with GST (₹)</span>
                  </div>
                  <button
                    type="button"
                    className="calc-edit-btn"
                    onClick={() => setEditingTotalCost(!editingTotalCost)}
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
                <div className="calc-item-value">
                  {editingTotalCost ? (
                    <div className="inline-edit-wrap">
                      <span className="rupee-affix">₹</span>
                      <input
                        type="number"
                        className="inline-calc-input"
                        value={formData.total_cost_value}
                        onChange={(e) => handleManualTotalCost(Math.max(0, Number(e.target.value) || 0))}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="done-edit-btn"
                        onClick={() => setEditingTotalCost(false)}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <span>{formatINR(formData.total_cost_value)}</span>
                  )}
                </div>
              </div>

              {/* Total Estimated Cost with GST box */}
              <div className="calc-item-card">
                <div className="calc-item-header">
                  <div>
                    <span className="calc-item-name">Total Estimated Cost with GST (₹)</span>
                  </div>
                  <button
                    type="button"
                    className="calc-edit-btn"
                    onClick={() => setEditingGstCost(!editingGstCost)}
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
                <div className="calc-item-value">
                  {editingGstCost ? (
                    <div className="inline-edit-wrap">
                      <span className="rupee-affix">₹</span>
                      <input
                        type="number"
                        className="inline-calc-input"
                        value={formData.gst_cost}
                        onChange={(e) => handleManualGstCost(Math.max(0, Number(e.target.value) || 0))}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="done-edit-btn"
                        onClick={() => setEditingGstCost(false)}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-green">{formatINR(formData.gst_cost)}</span>
                  )}
                </div>
              </div>

              {/* Total Training Cost box */}
              <div className="calc-item-card">
                <div className="calc-item-header">
                  <div>
                    <span className="calc-item-name">Total Training Cost (₹)</span>
                  </div>
                  <button
                    type="button"
                    className="calc-edit-btn"
                    onClick={() => setEditingTrainingCost(!editingTrainingCost)}
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
                <div className="calc-item-value">
                  {editingTrainingCost ? (
                    <div className="inline-edit-wrap">
                      <span className="rupee-affix">₹</span>
                      <input
                        type="number"
                        className="inline-calc-input"
                        value={formData.training_cost}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            training_cost: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        autoFocus
                      />
                      <button
                        type="button"
                        className="done-edit-btn"
                        onClick={() => setEditingTrainingCost(false)}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-purple">{formatINR(formData.training_cost)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Training Phases Table */}
        <section className="update-section-card">
          <div className="section-card-header flex-between">
            <div className="header-with-badge">
              <div className="step-badge">2</div>
              <h2 className="section-card-title">Training Phases</h2>
            </div>
            <button
              type="button"
              className="add-phase-btn"
              onClick={handleAddPhase}
              disabled={(formData.phases || []).length >= 3}
            >
              <Plus size={15} />
              <span>Add New Phase</span>
            </button>
          </div>

          <div className="phases-table-wrapper">
            <table className="phases-table">
              <thead>
                <tr>
                  <th className="th-phase-num">#</th>
                  <th className="th-phase-name">Training Phase</th>
                  <th className="th-phase-date">Starting Date</th>
                  <th className="th-phase-date">End Date</th>
                  <th className="th-phase-hours">No. of Hours (To be given)</th>
                  <th className="th-phase-hours">No. of Hours (Given)</th>
                  <th className="th-phase-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!formData.phases || formData.phases.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="empty-phases-row">
                      No training phases added. Click "+ Add New Phase" to add one.
                    </td>
                  </tr>
                ) : (
                  formData.phases.map((phase, index) => {
                    return (
                      <tr key={phase.id || index} className="phase-row-item">
                        <td className="td-phase-num">{index + 1}</td>
                        <td className="td-phase-name">
                          <select
                            className={`phase-select-badge ${getPhaseBadgeClass(phase.phase)}`}
                            value={phase.phase}
                            onChange={(e) =>
                              handleUpdatePhase(index, "phase", e.target.value as PhaseType)
                            }
                          >
                            <option value="Phase 1">Phase 1</option>
                            <option value="Phase 2">Phase 2</option>
                            <option value="Phase 3">Phase 3</option>
                          </select>
                        </td>
                        <td className="td-phase-date">
                          <input
                            type="date"
                            className="table-date-input"
                            value={phase.startDate || ""}
                            onChange={(e) => handleUpdatePhase(index, "startDate", e.target.value)}
                          />
                        </td>
                        <td className="td-phase-date">
                          <input
                            type="date"
                            className="table-date-input"
                            value={phase.endDate || ""}
                            onChange={(e) => handleUpdatePhase(index, "endDate", e.target.value)}
                          />
                        </td>
                        <td className="td-phase-hours">
                          <input
                            type="number"
                            className="table-num-input"
                            value={phase.hoursPlanned ?? 40}
                            onChange={(e) =>
                              handleUpdatePhase(index, "hoursPlanned", Number(e.target.value))
                            }
                          />
                        </td>
                        <td className="td-phase-hours">
                          <input
                            type="number"
                            className="table-num-input"
                            value={phase.hoursGiven ?? 35}
                            onChange={(e) =>
                              handleUpdatePhase(index, "hoursGiven", Number(e.target.value))
                            }
                          />
                        </td>
                        <td className="td-phase-actions">
                          <div className="phase-action-btns">
                            <button
                              type="button"
                              className="phase-trash-btn"
                              title="Delete phase"
                              onClick={() => handleDeletePhase(index)}
                              disabled={formData.phases.length <= 1}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Update Invoices & Payment Plan */}
        <section className="update-section-card invoice-management-section">
          <div className="section-card-header flex-between">
            <div className="header-with-badge">
              <div className="step-badge">3</div>
              <div>
                <h2 className="section-card-title">Update Invoices & Payment Plan</h2>
                <p className="section-card-subtitle">
                  Configure payment structure, tick raised/received invoices, and enter dates.
                </p>
              </div>
            </div>
            
            <div className="invoice-header-actions">
              <button
                type="button"
                className="invoice-quick-btn tick-all-btn"
                onClick={handleMarkAllRaised}
                title="Mark all invoices as Raised"
              >
                <CheckSquare size={14} />
                <span>Mark All Raised</span>
              </button>
              <button
                type="button"
                className="invoice-quick-btn tick-all-received-btn"
                onClick={handleMarkAllReceived}
                title="Mark all invoices as Received"
              >
                <Check size={14} />
                <span>Mark All Recieved</span>
              </button>
              <button
                type="button"
                className="invoice-quick-btn clear-all-btn"
                onClick={handleClearAllInvoices}
                title="Clear all ticked statuses"
              >
                <Square size={14} />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Payment Plan Config Bar */}
          <div className="update-invoice-controls-grid">
            {/* Select Payment Type */}
            <div className="form-field-group">
              <label className="field-label-text" htmlFor="updatePaymentTypeSelect">
                <CreditCard size={15} className="label-icon" />
                <span>Select Payment Type <span className="req-star">*</span></span>
              </label>
              <select
                id="updatePaymentTypeSelect"
                className="styled-select-control"
                value={formData.payment_type}
                onChange={(e) => handlePaymentTypeChange(e.target.value as PaymentType)}
              >
                <option value="FNF">FNF (100%) - Full and Final Payment (1 Invoice)</option>
                <option value="ATP">ATP (50%) - Advance + Final Settlement (2 Invoices)</option>
                <option value="ATTP">ATTP (Customisable %) - Milestone Based Plan</option>
                <option value="EMI">EMI (Installments) - Equal Installment Schedule</option>
              </select>
            </div>

            {/* Custom ATTP Input or EMI Count */}
            {formData.payment_type === "ATTP" && (
              <div className="form-field-group">
                <label className="field-label-text" htmlFor="updateAttpInput">
                  <Percent size={15} className="label-icon" />
                  <span>Custom Milestone % <span className="req-star">*</span></span>
                </label>
                <div className="attp-input-wrapper-card">
                  <div className="attp-input-row">
                    <div className="attp-input-box">
                      <input
                        type="number"
                        id="updateAttpInput"
                        className="styled-input-control attp-number-input"
                        placeholder="e.g. 33, 25, 50"
                        step="any"
                        min="1"
                        max="100"
                        value={attpInput}
                        onChange={(e) => handleAttpInputChange(e.target.value)}
                        onBlur={handleAttpInputBlur}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAttpInputBlur();
                          }
                        }}
                      />
                      <span className="attp-percent-suffix">%</span>
                    </div>

                    <div className="attp-quick-presets" role="group" aria-label="Presets">
                      {["25", "33.34", "50", "75", "100"].map((preset) => {
                        const details = computeAttpDetails(preset);
                        const isSelected =
                          formData.attp_percentage === details.normalizedPercentage ||
                          attpInput === preset ||
                          attpInput === details.displayVal;
                        return (
                          <button
                            key={preset}
                            type="button"
                            className={`attp-preset-btn ${isSelected ? "active" : ""}`}
                            onClick={() => handleSelectAttpPreset(preset)}
                          >
                            {details.normalizedPercentage}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="attp-live-notice">
                    <Info size={12} />
                    <span>
                      <strong>{formData.attp_percentage || `${attpInput}%`}</strong> per milestone generates{" "}
                      <strong>{invoices.length} Invoices</strong> automatically.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {formData.payment_type === "EMI" && (
              <div className="form-field-group">
                <label className="field-label-text" htmlFor="updateInstallmentSelect">
                  <ListOrdered size={15} className="label-icon" />
                  <span>Select No. of Installments <span className="req-star">*</span></span>
                </label>
                <select
                  id="updateInstallmentSelect"
                  className="styled-select-control"
                  value={formData.installment_count || 5}
                  onChange={(e) => handleInstallmentCountChange(e.target.value)}
                >
                  <option value="2">2 Installments (2 Invoices)</option>
                  <option value="3">3 Installments (3 Invoices)</option>
                  <option value="4">4 Installments (4 Invoices)</option>
                  <option value="5">5 Installments (5 Invoices)</option>
                  <option value="6">6 Installments (6 Invoices)</option>
                </select>
              </div>
            )}
          </div>

          {/* Quick Financial Summary Badges */}
          <div className="invoice-summary-kpis-grid">
            <div className="invoice-kpi-card">
              <span className="kpi-title">Total Invoices</span>
              <strong className="kpi-val text-purple">{invoices.length} Invoices</strong>
              <span className="kpi-sub">Total Milestones</span>
            </div>

            <div className="invoice-kpi-card">
              <span className="kpi-title">Invoices Raised</span>
              <strong className="kpi-val text-blue">
                {tickedRaisedCount} / {invoices.length} Raised
              </strong>
              <span className="kpi-sub">{formatINR(totalRaisedAmount)} Raised</span>
            </div>

            <div className="invoice-kpi-card">
              <span className="kpi-title">Invoices Recieved</span>
              <strong className="kpi-val text-green">
                {tickedReceivedCount} / {invoices.length} Recieved
              </strong>
              <span className="kpi-sub">{formatINR(totalReceivedAmount)} Collected</span>
            </div>

            <div className="invoice-kpi-card">
              <span className="kpi-title">Invoice to be Raised</span>
              <strong className="kpi-val text-amber">{formatINR(remainingToRaise)}</strong>
              <span className="kpi-sub">Pending Generation</span>
            </div>
          </div>

          {/* Google Drive Upload Sync Information Banner */}
          <div className="proof-drive-info-banner">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid #ccfbf1", paddingBottom: "6px", marginBottom: "4px" }}>
              <span style={{ fontWeight: 700, color: "#0f766e", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <UploadCloud size={14} />
                <span>Google Drive & Spreadsheet Real-time Proof Sync</span>
              </span>
              {loadSavedSheetConfig().scriptUrl ? (
                <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700, background: "#d1fae5", padding: "2px 8px", borderRadius: "10px" }}>
                  🟢 Live Apps Script Connected
                </span>
              ) : (
                onOpenGoogleSheetSync && (
                  <button
                    type="button"
                    onClick={onOpenGoogleSheetSync}
                    style={{
                      fontSize: "11px",
                      color: "#b45309",
                      fontWeight: 700,
                      background: "#fef3c7",
                      border: "1px solid #fde68a",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    ⚠️ Connect Apps Script URL for Live Drive Sync
                  </button>
                )
              )}
            </div>
            <div className="proof-drive-item">
              <span className="drive-tag raised-tag">📁 Raised Proofs:</span>
              <a
                href="https://drive.google.com/drive/folders/1Aqg6rmMETXqtjcEz6z07XDsj1jYWRfNf?usp=sharing"
                target="_blank"
                rel="noreferrer"
                className="drive-folder-link"
              >
                <span>Google Drive Folder (Raised)</span>
                <ExternalLink size={12} />
              </a>
              <span className="sheet-target-col">→ Sheet Column: <strong>Raised Invoice proof</strong></span>
            </div>
            <div className="proof-drive-item">
              <span className="drive-tag received-tag">📁 Received Proofs:</span>
              <a
                href="https://drive.google.com/drive/folders/1WgW61UJJ-TTwkZeYzOo3-GdQxD2upqtB?usp=sharing"
                target="_blank"
                rel="noreferrer"
                className="drive-folder-link"
              >
                <span>Google Drive Folder (Received)</span>
                <ExternalLink size={12} />
              </a>
              <span className="sheet-target-col">→ Sheet Column: <strong>Recieved Invoice</strong></span>
            </div>
          </div>

          {/* Proof Upload Status Alert */}
          {proofToast && (
            <div className={`proof-toast-alert ${proofToast.isError ? "error" : "success"}`}>
              {proofToast.isError ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
              <span>{proofToast.message}</span>
              <button type="button" className="toast-dismiss-btn" onClick={() => setProofToast(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Invoices Checklist Table with Photo Upload Options */}
          <div className="update-invoices-table-wrap">
            <table className="update-invoices-table">
              <thead>
                <tr>
                  <th className="th-inv-tick">Tick Raised & Photo</th>
                  <th className="th-inv-date">Date of Raised</th>
                  <th className="th-inv-tick">Recieved & Photo</th>
                  <th className="th-inv-date">Date of Recieved</th>
                  <th className="th-inv-pct">Share (%)</th>
                  <th className="th-inv-amount">Amount (₹)</th>
                  <th className="th-inv-code">Invoice Code</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => {
                  const isRaised = Boolean(inv.isRaised);
                  const isReceived = Boolean(inv.isReceived);
                  const isUploadingRaised = uploadingIdx?.index === idx && uploadingIdx.type === "raised";
                  const isUploadingReceived = uploadingIdx?.index === idx && uploadingIdx.type === "received";

                  return (
                    <tr
                      key={inv.id || idx}
                      className={`inv-checklist-row ${isReceived ? "inv-row-received" : isRaised ? "inv-row-ticked" : "inv-row-pending"}`}
                    >
                      {/* 1. Tick Raised & Upload Photo */}
                      <td className="td-inv-tick">
                        <div className="inv-tick-cell-content">
                          <label className="inv-checkbox-container" htmlFor={`inv-raised-check-${idx}`}>
                            <input
                              type="checkbox"
                              id={`inv-raised-check-${idx}`}
                              className="inv-custom-checkbox"
                              checked={isRaised}
                              onChange={() => handleToggleRaised(idx)}
                            />
                            <span className="inv-checkbox-checkmark checkmark-raised">
                              {isRaised && <Check size={13} strokeWidth={3} />}
                            </span>
                            <span className={`inv-tick-label ${isRaised ? "text-green" : ""}`}>
                              {isRaised ? "Raised" : "Pending"}
                            </span>
                          </label>

                          {/* Upload Photo Button & Proof Link for Raised Invoice */}
                          <div className="proof-action-wrapper">
                            {inv.raisedProofUrl ? (
                              <div className="proof-pill-container">
                                <a
                                  href={inv.raisedProofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="proof-link-badge raised-proof-badge"
                                  title="View photo proof in Google Drive"
                                >
                                  <Paperclip size={12} />
                                  <span>Proof</span>
                                  <ExternalLink size={11} />
                                </a>
                                <label className="proof-icon-btn change-btn" title="Change photo proof">
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => e.target.files?.[0] && handleUploadProof(idx, "raised", e.target.files[0])}
                                    hidden
                                  />
                                  <Camera size={12} />
                                </label>
                                <button
                                  type="button"
                                  className="proof-icon-btn remove-btn"
                                  onClick={() => handleRemoveProof(idx, "raised")}
                                  title="Remove proof"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <label className="proof-upload-btn-styled raised-upload" title="Upload Photo to Raised Invoices Drive Folder">
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => e.target.files?.[0] && handleUploadProof(idx, "raised", e.target.files[0])}
                                  hidden
                                />
                                {isUploadingRaised ? (
                                  <>
                                    <RefreshCw size={12} className="spinning" />
                                    <span>Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Camera size={12} />
                                    <span>Upload Photo</span>
                                  </>
                                )}
                              </label>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Date of Raised */}
                      <td className="td-inv-date">
                        <input
                          type="date"
                          id={`date-raised-${idx}`}
                          className={`table-inv-date-input ${isRaised ? "date-active" : ""}`}
                          value={inv.dateRaised || ""}
                          onChange={(e) => handleDateRaisedChange(idx, e.target.value)}
                          onBlur={() => handleDateRaisedBlur(idx)}
                        />
                      </td>

                      {/* 3. Recieved & Upload Photo */}
                      <td className="td-inv-tick">
                        <div className="inv-tick-cell-content">
                          <label className="inv-checkbox-container" htmlFor={`inv-received-check-${idx}`}>
                            <input
                              type="checkbox"
                              id={`inv-received-check-${idx}`}
                              className="inv-custom-checkbox"
                              checked={isReceived}
                              onChange={() => handleToggleReceived(idx)}
                            />
                            <span className="inv-checkbox-checkmark checkmark-received">
                              {isReceived && <Check size={13} strokeWidth={3} />}
                            </span>
                            <span className={`inv-tick-label ${isReceived ? "text-emerald" : ""}`}>
                              {isReceived ? "Recieved" : "Pending"}
                            </span>
                          </label>

                          {/* Upload Photo Button & Proof Link for Received Invoice */}
                          <div className="proof-action-wrapper">
                            {inv.receivedProofUrl ? (
                              <div className="proof-pill-container">
                                <a
                                  href={inv.receivedProofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="proof-link-badge received-proof-badge"
                                  title="View payment receipt in Google Drive"
                                >
                                  <Paperclip size={12} />
                                  <span>Proof</span>
                                  <ExternalLink size={11} />
                                </a>
                                <label className="proof-icon-btn change-btn" title="Change payment proof">
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => e.target.files?.[0] && handleUploadProof(idx, "received", e.target.files[0])}
                                    hidden
                                  />
                                  <Camera size={12} />
                                </label>
                                <button
                                  type="button"
                                  className="proof-icon-btn remove-btn"
                                  onClick={() => handleRemoveProof(idx, "received")}
                                  title="Remove proof"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <label className="proof-upload-btn-styled received-upload" title="Upload Photo to Received Invoices Drive Folder">
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => e.target.files?.[0] && handleUploadProof(idx, "received", e.target.files[0])}
                                  hidden
                                />
                                {isUploadingReceived ? (
                                  <>
                                    <RefreshCw size={12} className="spinning" />
                                    <span>Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Camera size={12} />
                                    <span>Upload Photo</span>
                                  </>
                                )}
                              </label>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Date of Recieved */}
                      <td className="td-inv-date">
                        <input
                          type="date"
                          id={`date-received-${idx}`}
                          className={`table-inv-date-input ${isReceived ? "date-active-emerald" : ""}`}
                          value={inv.dateReceived || ""}
                          onChange={(e) => handleDateReceivedChange(idx, e.target.value)}
                          onBlur={() => handleDateReceivedBlur(idx)}
                        />
                      </td>

                      {/* 5. Share (%) */}
                      <td className="td-inv-pct">
                        <span className="inv-percentage-badge">{inv.percentage}%</span>
                      </td>

                      {/* 6. Amount (₹) */}
                      <td className="td-inv-amount">
                        <span className="inv-amount-text">{formatINR(inv.amount)}</span>
                      </td>

                      {/* 7. Invoice Code */}
                      <td className="td-inv-code">
                        <input
                          type="text"
                          className="table-code-input"
                          value={inv.invoiceCode || `INV-${String(idx + 1).padStart(2, "0")}`}
                          onChange={(e) => handleUpdateInvoiceField(idx, "invoiceCode", e.target.value)}
                          placeholder="INV-01"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Additional Notes (Optional) */}
        <section className="update-section-card">
          <div className="section-card-header">
            <div className="step-badge">4</div>
            <h2 className="section-card-title">Additional Notes (Optional)</h2>
          </div>

          <div className="form-field-group">
            <textarea
              className="styled-textarea-control"
              rows={3}
              placeholder="Add any additional details, payment terms, or project notes..."
              value={formData.additional_notes || ""}
              onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
            />
          </div>
        </section>

        {/* Bottom Actions */}
        <div className="form-bottom-actions">
          <button
            type="button"
            className="form-btn reset-btn"
            onClick={onResetToOriginal}
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>

          <button
            type="submit"
            className="form-btn primary-submit-btn"
          >
            <Save size={16} />
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
