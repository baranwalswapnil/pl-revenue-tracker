import React from "react";
import {
  Building2,
  Calendar,
  Users,
  Coins,
  FileText,
  FileSpreadsheet,
  Edit3,
  Save,
  ArrowLeft,
  Activity,
} from "lucide-react";
import type { Project } from "../lib/models";
import { formatINR, formatNumber } from "../lib/mockData";

interface Step4HealthReportProps {
  project: Project;
  onEditDetails: (project: Project) => void;
  onSaveToRegister: () => void;
  onBackToDashboard: () => void;
}

export const Step4_HealthReport: React.FC<Step4HealthReportProps> = ({
  project,
  onEditDetails,
  onSaveToRegister,
  onBackToDashboard,
}) => {
  // Calculations
  const trainingCost = Number(project.training_cost) || 0;
  // Total Contract Value (Base and with GST)
  const contractValue = Number(project.total_cost_value) || 0;
  const contractValueWithGst = Number(project.gst_cost) || (contractValue * 1.18);

  // Formula: ((Total Contract Value with GST - Trainee Cost) / Total Contract Value with GST) * 100
  const rawDiff = contractValueWithGst - trainingCost;
  const healthPercent = contractValueWithGst > 0 ? (rawDiff / contractValueWithGst) * 100 : 0;
  const formattedScore = Math.abs(healthPercent).toFixed(1);
  const isProfitable = rawDiff >= 0;

  // Health tier classification based on profit margin
  let tierColor = "#16a34a"; // Green
  if (healthPercent >= 50) {
    tierColor = "#16a34a"; // Green
  } else if (healthPercent >= 25) {
    tierColor = "#22c55e"; // Light green
  } else if (healthPercent >= 10) {
    tierColor = "#eab308"; // Amber
  } else if (healthPercent >= 0) {
    tierColor = "#f97316"; // Orange
  } else {
    tierColor = "#ef4444"; // Red
  }

  // SVG circular gauge properties
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  // Clamp progress between 0 and 100
  const visualProgress = Math.min(100, Math.max(0, Math.abs(healthPercent)));
  const strokeDashoffset = circumference - (visualProgress / 100) * circumference;

  return (
    <div className="health-report-container">
      {/* Top Banner / Breadcrumb */}
      <div className="health-page-header">
        <div className="header-breadcrumbs">
          <button type="button" className="back-link-btn" onClick={onBackToDashboard}>
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>
          <span className="breadcrumb-div">/</span>
          <span className="breadcrumb-current-page">Project Overview & Health Report</span>
        </div>
      </div>

      {/* Section 1: Project Overview */}
      <section className="overview-panel-card">
        <div className="panel-title-row">
          <div className="panel-icon-circle blue-circle">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="panel-main-title">Project Overview</h2>
            <p className="panel-sub-title">
              College, project and training details with financial summary
            </p>
          </div>
        </div>

        <div className="overview-stats-grid">
          {/* Card 1: College Name */}
          <div className="overview-stat-box">
            <div className="stat-icon-wrapper blue-tint">
              <Building2 size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-box-label">College Name</span>
              <strong className="stat-box-title">{project.college_name || "N/A"}</strong>
              <small className="stat-box-caption">Project Code: {project.project_code || "N/A"}</small>
            </div>
          </div>

          {/* Card 2: Academic Year */}
          <div className="overview-stat-box">
            <div className="stat-icon-wrapper purple-tint">
              <Calendar size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-box-label">Academic Year</span>
              <strong className="stat-box-title">{project.academic_year || "2025 - 2026"}</strong>
              <small className="stat-box-caption">Passing Year: {project.passing_year || "2026"}</small>
            </div>
          </div>

          {/* Card 3: No. of Students */}
          <div className="overview-stat-box">
            <div className="stat-icon-wrapper green-tint">
              <Users size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-box-label">No. of Students</span>
              <strong className="stat-box-title">{formatNumber(project.student_count)}</strong>
              <small className="stat-box-caption">Rate: {formatINR(project.cost_per_student)} / student</small>
            </div>
          </div>

          {/* Card 4: Total Contract Value */}
          <div className="overview-stat-box">
            <div className="stat-icon-wrapper gold-tint">
              <Coins size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-box-label">Total Contract Value</span>
              <strong className="stat-box-title">{formatINR(contractValue)}</strong>
              <small className="stat-box-caption">Base Contract</small>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Financial Summary (3 Cards: Total Trainee Cost, Total Contract Value, Total Contract Value with GST) */}
      <section className="overview-panel-card">
        <div className="panel-title-row">
          <div className="panel-icon-circle purple-circle">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h2 className="panel-main-title">Financial Summary</h2>
            <p className="panel-sub-title">Complete breakdown of training cost vs contract value</p>
          </div>
        </div>

        <div className="financial-summary-grid">
          {/* Card 1: Total Training Cost */}
          <div className="fin-summary-box blue-fin-box">
            <div className="fin-box-icon blue-text">
              <Coins size={20} />
            </div>
            <div className="fin-box-data">
              <span className="fin-label">Total Trainee Cost</span>
              <strong className="fin-amount">{formatINR(trainingCost)}</strong>
              <small className="fin-sub">Budget Allocated</small>
            </div>
          </div>

          {/* Card 2: Total Contract Value */}
          <div className="fin-summary-box green-fin-box">
            <div className="fin-box-icon green-text">
              <FileText size={20} />
            </div>
            <div className="fin-box-data">
              <span className="fin-label">Total Contract Value</span>
              <strong className="fin-amount">{formatINR(contractValue)}</strong>
              <small className="fin-sub">Revenue Expected (Base)</small>
            </div>
          </div>

          {/* Card 3: Total Contract Value with GST */}
          <div className="fin-summary-box teal-fin-box">
            <div className="fin-box-icon teal-text">
              <FileText size={20} />
            </div>
            <div className="fin-box-data">
              <span className="fin-label">Total Contract Value with GST</span>
              <strong className="fin-amount">{formatINR(contractValueWithGst)}</strong>
              <small className="fin-sub">Total Value (with 18% GST)</small>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Health Report - Circular Gauge & Breakdown Card */}
      <section className="overview-panel-card health-report-main-card">
        <div className="panel-title-row">
          <div className="panel-icon-circle green-circle">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="panel-main-title">Health Report</h2>
            <p className="panel-sub-title">
              Shows the comparison between Total Contract Value with GST and Trainee Cost
            </p>
          </div>
        </div>

        <div className="health-report-two-col-grid">
          {/* Column 1: Round Circle Dashboard Gauge */}
          <div className="health-gauge-box">
            <div className="circular-gauge-wrapper">
              <svg className="gauge-svg" width="160" height="160" viewBox="0 0 160 160">
                {/* Background Ring */}
                <circle
                  className="gauge-bg-ring"
                  cx="80"
                  cy="80"
                  r={radius}
                  strokeWidth="12"
                />
                {/* Value Progress Ring */}
                <circle
                  className="gauge-progress-ring"
                  cx="80"
                  cy="80"
                  r={radius}
                  strokeWidth="12"
                  stroke={tierColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                />
              </svg>
              <div className="gauge-center-content">
                <span className="gauge-percentage-number">{formattedScore}%</span>
                <span className="gauge-score-label">Health Score</span>
              </div>
            </div>
          </div>

          {/* Column 2: Calculation Breakdown Table */}
          <div className="health-formula-box">
            <div className="formula-breakdown-table">
              <div className="formula-row">
                <span className="formula-key">Total Contract Value with GST</span>
                <span className="formula-val font-semibold">{formatINR(contractValueWithGst)}</span>
              </div>
              <div className="formula-row">
                <span className="formula-key">Total Trainee Cost</span>
                <span className="formula-val font-semibold">{formatINR(trainingCost)}</span>
              </div>
              <div className="formula-row">
                <span className="formula-key">Difference (Contract Value with GST - Trainee Cost)</span>
                <span className={`formula-val font-semibold ${rawDiff >= 0 ? "text-green" : "text-amber"}`}>
                  {rawDiff >= 0 ? "+" : "-"}{formatINR(Math.abs(rawDiff))}
                </span>
              </div>
              <div className="formula-row final-score-row">
                <span className="formula-key final-label">Final Health Score</span>
                <span className="final-score-badge" style={{ backgroundColor: `${tierColor}15`, color: tierColor, borderColor: `${tierColor}40` }}>
                  {formattedScore}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Action Buttons */}
      <div className="health-page-bottom-actions">
        <button
          type="button"
          className="health-action-btn edit-details-btn"
          onClick={() => onEditDetails(project)}
        >
          <Edit3 size={16} />
          <span>Edit Details</span>
        </button>

        <button
          type="button"
          className="health-action-btn save-changes-btn"
          onClick={onSaveToRegister}
        >
          <Save size={16} />
          <span>Save Changes & Return</span>
        </button>
      </div>
    </div>
  );
};
