import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Building2,
  FileText,
  Users,
  Calendar,
  Clock,
  Coins,
  CreditCard,
  ListOrdered,
  RotateCcw,
  Send,
  Info,
} from "lucide-react";
import type { ProjectDraft, PaymentType, PhaseType, TrainingPhase, ATTPPercentage } from "../lib/models";
import { computeAttpDetails } from "../lib/mockData";

interface Step3TrainingPhaseProps {
  draft: ProjectDraft;
  onUpdateDraft: (fields: Partial<ProjectDraft>) => void;
  onReset: () => void;
  onSubmit: () => void;
  onBackToDashboard: () => void;
  allColleges?: { name: string; code: string; students: number }[];
}

export const Step3_TrainingPhase: React.FC<Step3TrainingPhaseProps> = ({
  draft,
  onUpdateDraft,
  onReset,
  onSubmit,
  onBackToDashboard,
  allColleges = [],
}) => {
  // Local active phase selection
  const [selectedPhase, setSelectedPhase] = useState<PhaseType>(draft.selectedPhase || "Phase 1");

  // ATTP custom percentage input state
  const [attpInput, setAttpInput] = useState<string>(() => {
    const initial = draft.attpPercentage || "50%";
    return initial.replace("%", "").trim();
  });

  // Keep attpInput in sync if draft changes externally
  useEffect(() => {
    if (draft.attpPercentage) {
      setAttpInput(draft.attpPercentage.replace("%", "").trim());
    }
  }, [draft.attpPercentage]);

  // Sync selected phase with draft.phases array
  const currentPhaseObj = draft.phases.find((p) => p.phase === selectedPhase) || {
    phase: selectedPhase,
    startDate: "",
    endDate: "",
  };

  const handlePhaseChange = (newPhase: PhaseType) => {
    setSelectedPhase(newPhase);
    let existing = draft.phases.find((p) => p.phase === newPhase);
    if (!existing) {
      existing = { phase: newPhase, startDate: "", endDate: "" };
      onUpdateDraft({
        selectedPhase: newPhase,
        phases: [...draft.phases, existing],
        phaseStartDate: "",
        phaseEndDate: "",
      });
    } else {
      onUpdateDraft({
        selectedPhase: newPhase,
        phaseStartDate: existing.startDate || "",
        phaseEndDate: existing.endDate || "",
      });
    }
  };

  const handleDateChange = (type: "startDate" | "endDate", value: string) => {
    const updatedPhases = draft.phases.map((p) => {
      if (p.phase === selectedPhase) {
        return { ...p, [type]: value };
      }
      return p;
    });

    // Ensure current phase exists
    if (!updatedPhases.some((p) => p.phase === selectedPhase)) {
      updatedPhases.push({
        phase: selectedPhase,
        startDate: type === "startDate" ? value : "",
        endDate: type === "endDate" ? value : "",
      });
    }

    onUpdateDraft({
      phases: updatedPhases,
      ...(type === "startDate" ? { phaseStartDate: value } : { phaseEndDate: value }),
    });
  };

  // Payment type and invoice auto calculation
  const handlePaymentTypeChange = (type: PaymentType) => {
    let invCount = "1";
    let instCount = "1";

    if (type === "FNF") {
      invCount = "1";
      instCount = "1";
    } else if (type === "ATP") {
      invCount = "2";
      instCount = "2";
    } else if (type === "ATTP") {
      const details = computeAttpDetails(draft.attpPercentage || attpInput || "50");
      invCount = String(details.invoiceCount);
      instCount = String(details.invoiceCount);
      onUpdateDraft({
        paymentType: type,
        attpPercentage: details.normalizedPercentage,
        installmentCount: instCount,
        invoiceCount: invCount,
      });
      return;
    } else if (type === "EMI") {
      invCount = draft.installmentCount || "5";
      instCount = draft.installmentCount || "5";
    }

    onUpdateDraft({
      paymentType: type,
      installmentCount: instCount,
      invoiceCount: invCount,
    });
  };

  const handleAttpInputChange = (raw: string) => {
    setAttpInput(raw);
    if (raw.trim()) {
      const details = computeAttpDetails(raw);
      onUpdateDraft({
        attpPercentage: raw.includes("%") ? raw : `${raw}%`,
        installmentCount: String(details.invoiceCount),
        invoiceCount: String(details.invoiceCount),
      });
    }
  };

  const handleAttpInputBlur = () => {
    const details = computeAttpDetails(attpInput);
    setAttpInput(details.displayVal);
    onUpdateDraft({
      attpPercentage: details.normalizedPercentage,
      installmentCount: String(details.invoiceCount),
      invoiceCount: String(details.invoiceCount),
    });
  };

  const handleSelectPreset = (presetVal: string) => {
    const details = computeAttpDetails(presetVal);
    setAttpInput(details.displayVal);
    onUpdateDraft({
      attpPercentage: details.normalizedPercentage,
      installmentCount: String(details.invoiceCount),
      invoiceCount: String(details.invoiceCount),
    });
  };

  const handleInstallmentCountChange = (countStr: string) => {
    onUpdateDraft({
      installmentCount: countStr,
      invoiceCount: countStr,
    });
  };

  const getComputedInvoiceCount = (): number => {
    if (draft.paymentType === "FNF") return 1;
    if (draft.paymentType === "ATP") return 2;
    if (draft.paymentType === "ATTP") {
      const details = computeAttpDetails(draft.attpPercentage || attpInput || "50");
      return details.invoiceCount;
    }
    if (draft.paymentType === "EMI") return Number(draft.installmentCount) || 5;
    return 1;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.collegeName.trim()) {
      alert("Please ensure College Name is set in the draft or project.");
      return;
    }
    onSubmit();
  };

  return (
    <div className="training-phase-page-container">
      {/* Top Banner Header */}
      <div className="page-hero-banner">
        <div className="banner-left">
          <div className="banner-icon-badge">
            <GraduationCap size={26} />
          </div>
          <div>
            <h1 className="banner-title">Training Phase Entry</h1>
            <p className="banner-subtitle">
              Add training phase details, hours, cost and payment plan
            </p>
          </div>
        </div>
        <div className="banner-watermark" aria-hidden="true">
          <GraduationCap size={130} />
        </div>
      </div>

      {/* Top Context Bar / Info Badges */}
      <div className="context-info-bar">
        <div className="context-card">
          <div className="context-card-icon blue-text">
            <Building2 size={18} />
          </div>
          <div className="context-card-details">
            <span className="context-label">College Name</span>
            <input
              type="text"
              name="college_name_no_autocomplete"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              className="context-input"
              value={draft.collegeName}
              placeholder="Dr. DY Patil Institute"
              onChange={(e) => onUpdateDraft({ collegeName: e.target.value })}
            />
          </div>
        </div>

        <div className="context-card">
          <div className="context-card-icon purple-text">
            <FileText size={18} />
          </div>
          <div className="context-card-details">
            <span className="context-label">Project Code</span>
            <input
              type="text"
              name="project_code_no_autocomplete"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              className="context-input"
              value={draft.projectCode}
              placeholder="DypCSE-001"
              onChange={(e) => onUpdateDraft({ projectCode: e.target.value })}
            />
          </div>
        </div>

        <div className="context-card">
          <div className="context-card-icon green-text">
            <Users size={18} />
          </div>
          <div className="context-card-details">
            <span className="context-label">No. of Students</span>
            <input
              type="number"
              name="student_count_no_autocomplete"
              autoComplete="off"
              data-lpignore="true"
              className="context-input"
              value={draft.studentCount}
              placeholder="120"
              onChange={(e) => onUpdateDraft({ studentCount: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Main Steps Form */}
      <form onSubmit={handleSubmit} className="training-entry-card" autoComplete="off">
        {/* Step 1: Training Phase & Timeline */}
        <section className="form-step-section">
          <div className="step-section-header">
            <div className="step-badge">1</div>
            <h2 className="step-title">Training Phase & Timeline</h2>
            <div className="step-info-notice">
              <Info size={14} />
              <span>Select phase and set the training start and end dates.</span>
            </div>
          </div>

          <div className="form-fields-grid grid-cols-3">
            <div className="form-field-group">
              <label className="field-label-text" htmlFor="trainingPhaseSelect">
                <Layers size={15} className="label-icon" />
                <span>Training Phase <span className="req-star">*</span></span>
              </label>
              <select
                id="trainingPhaseSelect"
                className="styled-select-control"
                value={selectedPhase}
                onChange={(e) => handlePhaseChange(e.target.value as PhaseType)}
              >
                <option value="Phase 1">Phase 1</option>
                <option value="Phase 2">Phase 2</option>
                <option value="Phase 3">Phase 3</option>
              </select>
            </div>

            <div className="form-field-group">
              <label className="field-label-text" htmlFor="phaseStartDate">
                <Calendar size={15} className="label-icon" />
                <span>Starting Date <span className="req-star">*</span></span>
              </label>
              <input
                type="date"
                id="phaseStartDate"
                name="phase_start_date_no_autocomplete"
                autoComplete="off"
                className="styled-input-control"
                value={currentPhaseObj.startDate || draft.phaseStartDate || ""}
                onChange={(e) => handleDateChange("startDate", e.target.value)}
                required
              />
            </div>

            <div className="form-field-group">
              <label className="field-label-text" htmlFor="phaseEndDate">
                <Calendar size={15} className="label-icon" />
                <span>End Date <span className="req-star">*</span></span>
              </label>
              <input
                type="date"
                id="phaseEndDate"
                name="phase_end_date_no_autocomplete"
                autoComplete="off"
                className="styled-input-control"
                value={currentPhaseObj.endDate || draft.phaseEndDate || ""}
                onChange={(e) => handleDateChange("endDate", e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        {/* Step 2: Total Training Details */}
        <section className="form-step-section">
          <div className="step-section-header">
            <div className="step-badge">2</div>
            <h2 className="step-title">Total Training Details</h2>
            <div className="step-info-notice">
              <Info size={14} />
              <span>Enter total no. of hours to be given, total no. of hours given and total training cost.</span>
            </div>
          </div>

          <div className="form-fields-grid grid-cols-3">
            <div className="form-field-group">
              <label className="field-label-text" htmlFor="hoursPlanned">
                <Clock size={15} className="label-icon" />
                <span>Total No. of Hours (To be given) <span className="req-star">*</span></span>
              </label>
              <input
                type="number"
                id="hoursPlanned"
                name="hours_planned_no_autocomplete"
                autoComplete="off"
                data-lpignore="true"
                className="styled-input-control"
                placeholder="40"
                min="0"
                step="0.5"
                value={draft.hoursPlanned}
                onChange={(e) => onUpdateDraft({ hoursPlanned: e.target.value })}
                required
              />
            </div>

            <div className="form-field-group">
              <label className="field-label-text" htmlFor="hoursGiven">
                <Clock size={15} className="label-icon" />
                <span>Total No. of Hours (Given) <span className="req-star">*</span></span>
              </label>
              <input
                type="number"
                id="hoursGiven"
                name="hours_given_no_autocomplete"
                autoComplete="off"
                data-lpignore="true"
                className="styled-input-control"
                placeholder="35"
                min="0"
                step="0.5"
                value={draft.hoursGiven}
                onChange={(e) => onUpdateDraft({ hoursGiven: e.target.value })}
                required
              />
            </div>

            <div className="form-field-group">
              <label className="field-label-text" htmlFor="trainingCost">
                <Coins size={15} className="label-icon" />
                <span>Total Training Cost (₹) <span className="req-star">*</span></span>
              </label>
              <input
                type="number"
                id="trainingCost"
                name="training_cost_no_autocomplete"
                autoComplete="off"
                data-lpignore="true"
                className="styled-input-control"
                placeholder="50000"
                min="0"
                step="0.01"
                value={draft.trainingCost}
                onChange={(e) => onUpdateDraft({ trainingCost: e.target.value })}
                required
              />
            </div>
          </div>
        </section>

        {/* Step 3: Payment Plan */}
        <section className="form-step-section">
          <div className="step-section-header">
            <div className="step-badge">3</div>
            <h2 className="step-title">Payment Plan</h2>
            <div className="step-info-notice">
              <Info size={14} />
              <span>Select payment type to automatically set number of invoices.</span>
            </div>
          </div>

          <div className="payment-plan-grid">
            <div className="form-field-group">
              <label className="field-label-text" htmlFor="paymentTypeSelect">
                <CreditCard size={15} className="label-icon" />
                <span>Select Payment Type <span className="req-star">*</span></span>
              </label>
              <select
                id="paymentTypeSelect"
                className="styled-select-control"
                value={draft.paymentType}
                onChange={(e) => handlePaymentTypeChange(e.target.value as PaymentType)}
              >
                <option value="FNF">FNF (100%) - Full and Final Payment</option>
                <option value="ATP">ATP (50%) - Advance + Final Payment</option>
                <option value="ATTP">ATTP (Customisable) - Milestone % (25%, 50%, 75%, 100%)</option>
                <option value="EMI">EMI (Installments) - Fixed installment options</option>
              </select>
            </div>

            {/* Payment customization conditional block */}
            {draft.paymentType === "ATTP" ? (
              <div className="form-field-group attp-customizer-field">
                <label className="field-label-text" htmlFor="attpPercentageInput">
                  <Percent size={15} className="label-icon" />
                  <span>Custom Percentage per Milestone (%) <span className="req-star">*</span></span>
                </label>
                
                <div className="attp-input-wrapper-card">
                  <div className="attp-input-row">
                    <div className="attp-input-box">
                      <input
                        type="number"
                        id="attpPercentageInput"
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

                    {/* Quick Presets for convenience */}
                    <div className="attp-quick-presets" role="group" aria-label="Quick percentage presets">
                      {["25", "33.34", "50", "75", "100"].map((preset) => {
                        const details = computeAttpDetails(preset);
                        const isSelected =
                          draft.attpPercentage === details.normalizedPercentage ||
                          attpInput === preset ||
                          attpInput === details.displayVal;
                        return (
                          <button
                            key={preset}
                            type="button"
                            className={`attp-preset-btn ${isSelected ? "active" : ""}`}
                            onClick={() => handleSelectPreset(preset)}
                          >
                            {details.normalizedPercentage}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="attp-live-notice">
                    <Info size={13} />
                    <span>
                      <strong>{draft.attpPercentage || `${attpInput}%`}</strong> per milestone generates{" "}
                      <strong>{getComputedInvoiceCount()} Invoices</strong> automatically.
                    </span>
                  </div>
                </div>
              </div>
            ) : draft.paymentType === "EMI" ? (
              <div className="form-field-group">
                <label className="field-label-text" htmlFor="installmentCountSelect">
                  <ListOrdered size={15} className="label-icon" />
                  <span>Select No. of Installments <span className="req-star">*</span></span>
                </label>
                <select
                  id="installmentCountSelect"
                  className="styled-select-control"
                  value={draft.installmentCount}
                  onChange={(e) => handleInstallmentCountChange(e.target.value)}
                >
                  <option value="2">2 Installments</option>
                  <option value="3">3 Installments</option>
                  <option value="4">4 Installments</option>
                  <option value="5">5 Installments</option>
                  <option value="6">6 Installments</option>
                </select>
              </div>
            ) : (
              <div className="form-field-group disabled-field-group">
                <label className="field-label-text">
                  <ListOrdered size={15} className="label-icon" />
                  <span>Payment Schedule Structure</span>
                </label>
                <div className="fixed-schedule-badge">
                  {draft.paymentType === "FNF" ? "100% Single Milestone (1 Invoice)" : "50% Advance + 50% Final (2 Invoices)"}
                </div>
              </div>
            )}

            {/* Auto Invoices Box */}
            <div className="auto-invoices-card">
              <div className="auto-invoices-header">
                <div className="invoice-badge-icon">
                  <FileText size={18} />
                </div>
                <span className="auto-invoices-label">No. of Invoices (Auto)</span>
              </div>
              <div className="auto-invoices-number">
                {getComputedInvoiceCount()}
              </div>
              <div className="auto-invoices-sub">
                {draft.paymentType === "ATTP"
                  ? `${draft.attpPercentage || "50%"} Milestone Plan`
                  : "Based on selected payment type"}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Actions */}
        <div className="form-bottom-actions">
          <button
            type="button"
            className="form-btn reset-btn"
            onClick={onReset}
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>

          <button
            type="submit"
            className="form-btn primary-submit-btn"
          >
            <Send size={16} />
            <span>Submit & View Health Report</span>
          </button>
        </div>
      </form>
    </div>
  );
};
