import React, { useState, useEffect } from "react";
import {
  FilePlus2,
  Building2,
  FileText,
  Calendar,
  GraduationCap,
  Users,
  Coins,
  Calculator,
  Percent,
  Edit2,
  RotateCcw,
  Save,
  Check,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { ProjectDraft, Project } from "../lib/models";
import { formatINR } from "../lib/mockData";
import { type GoogleSheetCollegeItem } from "../lib/googleSheetsService";
import { FileSpreadsheet, Sparkles, RefreshCw } from "lucide-react";

interface Step2NewEntryProps {
  draft: ProjectDraft;
  onUpdateDraft: (fields: Partial<ProjectDraft>) => void;
  onReset: () => void;
  onSaveEntry: (proceedToTraining: boolean) => void;
  onBackToDashboard: () => void;
  isEditing?: boolean;
  googleSheetColleges?: GoogleSheetCollegeItem[];
  onOpenGoogleSheetSync?: () => void;
  onSelectGoogleSheetCollege?: (item: GoogleSheetCollegeItem) => void;
}

export const Step2_NewEntry: React.FC<Step2NewEntryProps> = ({
  draft,
  onUpdateDraft,
  onReset,
  onSaveEntry,
  onBackToDashboard,
  isEditing = false,
  googleSheetColleges = [],
  onOpenGoogleSheetSync,
  onSelectGoogleSheetCollege,
}) => {
  const [editingTotalCost, setEditingTotalCost] = useState(false);
  const [editingGstCost, setEditingGstCost] = useState(false);
  const [selectedSheetCollegeId, setSelectedSheetCollegeId] = useState<string>("");

  // Auto calculate total cost and GST whenever studentCount or costPerStudent change
  const handleStudentsOrCostChange = (field: "studentCount" | "costPerStudent", value: string) => {
    const students = field === "studentCount" ? Math.max(0, Number(value) || 0) : Math.max(0, Number(draft.studentCount) || 0);
    const cost = field === "costPerStudent" ? Math.max(0, Number(value) || 0) : Math.max(0, Number(draft.costPerStudent) || 0);
    const autoTotal = students * cost;
    const autoGst = autoTotal * 1.18;

    onUpdateDraft({
      [field]: value,
      totalCostValue: draft.manualTotal ? draft.totalCostValue : String(autoTotal),
      gstCost: draft.manualGst ? draft.gstCost : String(autoGst),
    });
  };

  const handleManualTotalCostChange = (val: string) => {
    const num = Math.max(0, Number(val) || 0);
    const autoGst = num * 1.18;
    onUpdateDraft({
      totalCostValue: val,
      manualTotal: true,
      gstCost: draft.manualGst ? draft.gstCost : String(autoGst),
    });
  };

  const handleManualGstCostChange = (val: string) => {
    onUpdateDraft({
      gstCost: val,
      manualGst: true,
    });
  };

  const handleSheetCollegeSelect = (collegeId: string) => {
    setSelectedSheetCollegeId(collegeId);
    const found = googleSheetColleges.find((c) => c.id === collegeId);
    if (found && onSelectGoogleSheetCollege) {
      onSelectGoogleSheetCollege(found);
    }
  };

  const academicYearOptions = [
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
  ];

  const passingYearOptions = [
    "2024",
    "2025",
    "2026",
    "2027",
    "2028",
    "2029",
  ];

  const handleSubmit = (e: React.FormEvent, proceed: boolean) => {
    e.preventDefault();
    if (!draft.collegeName.trim()) {
      alert("Please enter a valid College Name.");
      return;
    }
    if (!draft.projectCode.trim()) {
      alert("Please enter a valid College Project / Project Code.");
      return;
    }
    onSaveEntry(proceed);
  };

  return (
    <div className="new-entry-page-container">
      {/* Top Banner Header */}
      <div className="page-hero-banner">
        <div className="banner-left">
          <div className="banner-icon-badge">
            <FilePlus2 size={26} />
          </div>
          <div>
            <h1 className="banner-title">{isEditing ? "Update College Entry" : "New Entry"}</h1>
            <p className="banner-subtitle">
              Add college project details and estimate financials
            </p>
          </div>
        </div>
        <div className="banner-watermark" aria-hidden="true">
          <GraduationCap size={130} />
        </div>
      </div>

      {/* Google Spreadsheet Quick Pre-fill Bar */}
      <div className="gsheet-prefill-banner">
        <div className="gsheet-prefill-left">
          <div className="gsheet-mini-icon">
            <FileSpreadsheet size={20} />
          </div>
          <div className="gsheet-prefill-info">
            <span className="gsheet-prefill-title">Pre-fill from Google Spreadsheet</span>
            <span className="gsheet-prefill-desc">
              {googleSheetColleges.length > 0
                ? `Select a college to auto-populate all form fields (${googleSheetColleges.length} loaded)`
                : "Connect your Google Spreadsheet to autofill college data automatically"}
            </span>
          </div>
        </div>

        <div className="gsheet-prefill-actions">
          {googleSheetColleges.length > 0 ? (
            <div className="gsheet-select-wrap">
              <select
                className="gsheet-dropdown-select"
                value={selectedSheetCollegeId}
                onChange={(e) => handleSheetCollegeSelect(e.target.value)}
              >
                <option value="">-- Choose College to Auto-fill --</option>
                {googleSheetColleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.college_name} ({c.project_code}) - {c.student_count} Students
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {onOpenGoogleSheetSync && (
            <button
              type="button"
              className="gsheet-sync-trigger-btn"
              onClick={onOpenGoogleSheetSync}
            >
              <RefreshCw size={14} />
              <span>{googleSheetColleges.length > 0 ? "Sync Sheet" : "Connect Spreadsheet"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Form Box */}
      <form onSubmit={(e) => handleSubmit(e, true)} className="entry-form-card" autoComplete="off">
        {/* Row 1: College Name, College Project, Academic Year */}
        <div className="form-fields-grid grid-cols-3">
          <div className="form-field-group">
            <label className="field-label-text" htmlFor="collegeName">
              <Building2 size={15} className="label-icon" />
              <span>College Name <span className="req-star">*</span></span>
            </label>
            <input
              type="text"
              id="collegeName"
              name="college_name_no_autocomplete"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              className="styled-input-control"
              placeholder="Select or enter college name"
              value={draft.collegeName}
              onChange={(e) => onUpdateDraft({ collegeName: e.target.value })}
              required
            />
          </div>

          <div className="form-field-group">
            <label className="field-label-text" htmlFor="projectCode">
              <FileText size={15} className="label-icon" />
              <span>College Project <span className="req-star">*</span></span>
            </label>
            <input
              type="text"
              id="projectCode"
              name="project_code_no_autocomplete"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              className="styled-input-control"
              placeholder="Enter project name / code"
              value={draft.projectCode}
              onChange={(e) => onUpdateDraft({ projectCode: e.target.value })}
              required
            />
          </div>

          <div className="form-field-group">
            <label className="field-label-text" htmlFor="academicYear">
              <Calendar size={15} className="label-icon" />
              <span>Academic Year <span className="req-star">*</span></span>
            </label>
            <select
              id="academicYear"
              className="styled-select-control"
              value={draft.academicYear}
              onChange={(e) => onUpdateDraft({ academicYear: e.target.value })}
              required
            >
              {academicYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Passing Year, No. of Students, Cost Per Student */}
        <div className="form-fields-grid grid-cols-3">
          <div className="form-field-group">
            <label className="field-label-text" htmlFor="passingYear">
              <GraduationCap size={15} className="label-icon" />
              <span>Passing Year <span className="req-star">*</span></span>
            </label>
            <select
              id="passingYear"
              className="styled-select-control"
              value={draft.passingYear}
              onChange={(e) => onUpdateDraft({ passingYear: e.target.value })}
              required
            >
              {passingYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field-group">
            <label className="field-label-text" htmlFor="studentCount">
              <Users size={15} className="label-icon" />
              <span>No. of Students <span className="req-star">*</span></span>
            </label>
            <input
              type="number"
              id="studentCount"
              name="student_count_no_autocomplete"
              autoComplete="off"
              data-lpignore="true"
              className="styled-input-control"
              placeholder="Enter number of students"
              min="0"
              step="1"
              value={draft.studentCount}
              onChange={(e) => handleStudentsOrCostChange("studentCount", e.target.value)}
              required
            />
          </div>

          <div className="form-field-group">
            <label className="field-label-text" htmlFor="costPerStudent">
              <Coins size={15} className="label-icon" />
              <span>Cost Per Student (₹) <span className="req-star">*</span></span>
            </label>
            <input
              type="number"
              id="costPerStudent"
              name="cost_per_student_no_autocomplete"
              autoComplete="off"
              data-lpignore="true"
              className="styled-input-control"
              placeholder="Enter cost per student"
              min="0"
              step="0.01"
              value={draft.costPerStudent}
              onChange={(e) => handleStudentsOrCostChange("costPerStudent", e.target.value)}
              required
            />
          </div>
        </div>

        {/* Row 3: Auto Calculated Boxes with Editable toggle */}
        <div className="calculation-cards-grid">
          {/* Box 1: Total Cost Value with GST */}
          <div className="calc-summary-box blue-calc-box">
            <div className="calc-header-row">
              <div className="calc-icon-title">
                <div className="calc-icon blue-icon">
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 className="calc-box-title">Total Cost Value with GST</h3>
                </div>
              </div>
              <button
                type="button"
                className={`edit-toggle-btn ${editingTotalCost ? "active" : ""}`}
                onClick={() => setEditingTotalCost(!editingTotalCost)}
                title="Toggle Edit Total Cost"
              >
                <Edit2 size={14} />
              </button>
            </div>

            <div className="calc-value-display">
              {editingTotalCost ? (
                <div className="inline-edit-wrap">
                  <span className="rupee-affix">₹</span>
                  <input
                    type="number"
                    className="inline-calc-input"
                    value={draft.totalCostValue}
                    onChange={(e) => handleManualTotalCostChange(e.target.value)}
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
                <span className="calc-amount-text">
                  {formatINR(draft.totalCostValue)}
                </span>
              )}
            </div>
          </div>

          {/* Box 2: Total Estimated Cost with GST */}
          <div className="calc-summary-box green-calc-box">
            <div className="calc-header-row">
              <div className="calc-icon-title">
                <div className="calc-icon green-icon">
                  <Percent size={18} />
                </div>
                <div>
                  <h3 className="calc-box-title">Total Estimated Cost with GST</h3>
                </div>
              </div>
              <button
                type="button"
                className={`edit-toggle-btn ${editingGstCost ? "active" : ""}`}
                onClick={() => setEditingGstCost(!editingGstCost)}
                title="Toggle Edit GST Cost"
              >
                <Edit2 size={14} />
              </button>
            </div>

            <div className="calc-value-display">
              {editingGstCost ? (
                <div className="inline-edit-wrap">
                  <span className="rupee-affix">₹</span>
                  <input
                    type="number"
                    className="inline-calc-input"
                    value={draft.gstCost}
                    onChange={(e) => handleManualGstCostChange(e.target.value)}
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
                <span className="calc-amount-text green-amount">
                  {formatINR(draft.gstCost)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Row 4: Additional Notes (Optional) */}
        <div className="form-field-group">
          <label className="field-label-text" htmlFor="additionalNotes">
            <FileText size={15} className="label-icon" />
            <span>Additional Notes (Optional)</span>
          </label>
          <textarea
            id="additionalNotes"
            className="styled-textarea-control"
            rows={3}
            placeholder="Add any additional details, requirements or notes..."
            value={draft.additionalNotes}
            onChange={(e) => onUpdateDraft({ additionalNotes: e.target.value })}
          />
        </div>

        {/* Action Buttons */}
        <div className="form-bottom-actions">
          <button
            type="button"
            className="form-btn reset-btn"
            onClick={onReset}
          >
            <RotateCcw size={15} />
            <span>Reset</span>
          </button>

          <div className="right-action-btns">
            <button
              type="button"
              className="form-btn secondary-save-btn"
              onClick={(e) => handleSubmit(e, false)}
            >
              <Save size={15} />
              <span>Save Draft</span>
            </button>
            <button
              type="submit"
              className="form-btn primary-submit-btn"
            >
              <span>Save & Proceed to Training Phase</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
