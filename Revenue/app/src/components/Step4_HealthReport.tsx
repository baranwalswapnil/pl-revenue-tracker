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
  Receipt,
  FileCheck2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
} from "lucide-react";
import type { Project } from "../lib/models";
import { formatINR, formatNumber, getProjectInvoiceStats } from "../lib/mockData";

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
  // If (Contract Value with GST - Trainee Cost) is negative, healthPercent is also negative!
  const healthPercent = contractValueWithGst > 0 ? (rawDiff / contractValueWithGst) * 100 : 0;
  const isProfitable = rawDiff >= 0;
  const scoreDisplay = `${healthPercent.toFixed(1)}%`;
  const formattedScoreWithSign = `${healthPercent > 0 ? "+" : ""}${healthPercent.toFixed(1)}%`;

  // Calculate Number of Invoices Raised stats
  const invoiceStats = getProjectInvoiceStats(project);

  // Health tier classification based on profit margin
  let tierColor = "#16a34a"; // Green
  let statusBadgeText = "Excellent Health";
  let statusBadgeBg = "#dcfce7";
  let statusBadgeBorder = "#86efac";

  if (healthPercent >= 50) {
    tierColor = "#16a34a"; // Green
    statusBadgeText = "Excellent Profit Margin";
    statusBadgeBg = "#dcfce7";
    statusBadgeBorder = "#86efac";
  } else if (healthPercent >= 25) {
    tierColor = "#22c55e"; // Light green
    statusBadgeText = "Healthy Profit Margin";
    statusBadgeBg = "#ecfdf5";
    statusBadgeBorder = "#a7f3d0";
  } else if (healthPercent >= 10) {
    tierColor = "#eab308"; // Amber
    statusBadgeText = "Moderate Margin";
    statusBadgeBg = "#fef9c3";
    statusBadgeBorder = "#fde047";
  } else if (healthPercent >= 0) {
    tierColor = "#f97316"; // Orange
    statusBadgeText = "Low Margin / Break-even";
    statusBadgeBg = "#ffedd5";
    statusBadgeBorder = "#fdba74";
  } else {
    tierColor = "#ef4444"; // Red (Negative Deficit)
    statusBadgeText = "Negative Margin (Deficit)";
    statusBadgeBg = "#fee2e2";
    statusBadgeBorder = "#fca5a5";
  }

  // SVG circular gauge properties
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  // Clamp visual progress between 0 and 100
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
              College, project details, training financials and number of invoices raised
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
              <small className="stat-box-caption">Base Contract Value</small>
            </div>
          </div>

          {/* Card 5: Number of Invoices Raised */}
          <div className="overview-stat-box" style={{ background: "#fdf4ff", borderColor: "#f0abfc" }}>
            <div className="stat-icon-wrapper" style={{ background: "#fae8ff", color: "#c026d3" }}>
              <Receipt size={18} />
            </div>
            <div className="stat-content">
              <span className="stat-box-label" style={{ color: "#a21caf" }}>Number of Invoices Raised</span>
              <strong className="stat-box-title" style={{ color: "#86198f" }}>
                {invoiceStats.raisedCount} of {invoiceStats.totalCount} Raised
              </strong>
              <small className="stat-box-caption" style={{ color: "#a21caf" }}>
                Amount: {formatINR(invoiceStats.raisedAmount)} ({invoiceStats.raisedPct}%)
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Financial Summary (Total Trainee Cost, Total Contract Value, Total with GST, Invoices Raised) */}
      <section className="overview-panel-card">
        <div className="panel-title-row">
          <div className="panel-icon-circle purple-circle">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h2 className="panel-main-title">Financial Summary</h2>
            <p className="panel-sub-title">Complete breakdown of training cost vs contract value and invoice status</p>
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

          {/* Card 4: Invoices Raised */}
          <div className="fin-summary-box purple-fin-box">
            <div className="fin-box-icon" style={{ color: "#7c3aed" }}>
              <Receipt size={20} />
            </div>
            <div className="fin-box-data">
              <span className="fin-label">Invoices Raised</span>
              <strong className="fin-amount" style={{ color: "#6b21a8" }}>
                {formatINR(invoiceStats.raisedAmount)}
              </strong>
              <small className="fin-sub" style={{ color: "#7c3aed" }}>
                {invoiceStats.raisedCount} of {invoiceStats.totalCount} Raised ({invoiceStats.raisedPct}%)
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Health Report - Circular Gauge & Breakdown Card */}
      <section className="overview-panel-card health-report-main-card">
        <div className="panel-title-row">
          <div className="panel-icon-circle green-circle" style={{ background: healthPercent < 0 ? "#fee2e2" : undefined, color: healthPercent < 0 ? "#dc2626" : undefined }}>
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
                <span className="gauge-percentage-number" style={{ color: tierColor, fontSize: scoreDisplay.length > 5 ? "22px" : "26px" }}>
                  {scoreDisplay}
                </span>
                <span
                  className="gauge-score-label"
                  style={{ color: healthPercent < 0 ? "#ef4444" : undefined, fontWeight: healthPercent < 0 ? 700 : undefined }}
                >
                  {healthPercent < 0 ? "Deficit Margin" : "Health Score"}
                </span>
              </div>
            </div>

            {/* Health Status Pill */}
            <div
              style={{
                marginTop: "12px",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                backgroundColor: statusBadgeBg,
                color: tierColor,
                border: `1px solid ${statusBadgeBorder}`,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              {healthPercent < 0 ? <AlertTriangle size={13} /> : <TrendingUp size={13} />}
              <span>{statusBadgeText}</span>
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
                <span
                  className="formula-val font-semibold"
                  style={{ color: rawDiff < 0 ? "#dc2626" : "#16a34a", fontWeight: 700 }}
                >
                  {rawDiff < 0 ? "-" : "+"}{formatINR(Math.abs(rawDiff))}
                </span>
              </div>
              <div className="formula-row">
                <span className="formula-key">Number of Invoices Raised</span>
                <span className="formula-val font-semibold" style={{ color: "#7c3aed" }}>
                  {invoiceStats.raisedCount} of {invoiceStats.totalCount} Raised ({formatINR(invoiceStats.raisedAmount)})
                </span>
              </div>
              <div className="formula-row">
                <span className="formula-key">Invoice to be Raised (Pending)</span>
                <span className="formula-val font-semibold" style={{ color: invoiceStats.pendingAmount > 0 ? "#d97706" : "#16a34a" }}>
                  {formatINR(invoiceStats.pendingAmount)} ({invoiceStats.totalCount - invoiceStats.raisedCount} remaining)
                </span>
              </div>
              <div className="formula-row final-score-row">
                <span className="formula-key final-label">Final Health Score</span>
                <span
                  className="final-score-badge"
                  style={{
                    backgroundColor: statusBadgeBg,
                    color: tierColor,
                    borderColor: statusBadgeBorder,
                    fontWeight: 800,
                    fontSize: "15px",
                  }}
                >
                  {scoreDisplay}
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
