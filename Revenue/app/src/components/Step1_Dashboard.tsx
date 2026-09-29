import React, { useState, useMemo } from "react";
import {
  Plus,
  Edit3,
  Search,
  Filter,
  Eye,
  Trash2,
  Building2,
  ArrowRight,
  Download,
  FileSpreadsheet,
  ChevronDown,
  Clock,
  TrendingUp,
  Layers,
  Sparkles,
} from "lucide-react";
import type { Project } from "../lib/models";
import { formatINR, getProjectInvoiceStats } from "../lib/mockData";
import { OutstandingDropdown } from "./OutstandingDropdown";
import { type OutstandingPeriod, getDefaultPeriod } from "../lib/outstandingService";

interface Step1DashboardProps {
  projects: Project[];
  onOpenAddCollege: () => void;
  onOpenUpdateModal: () => void;
  onOpenOutstanding: (period?: OutstandingPeriod) => void;
  onViewProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenGoogleSheetSync?: () => void;
  googleSheetCount?: number;
}

export const Step1_Dashboard: React.FC<Step1DashboardProps> = ({
  projects,
  onOpenAddCollege,
  onOpenUpdateModal,
  onOpenOutstanding,
  onViewProject,
  onEditProject,
  onDeleteProject,
  onOpenGoogleSheetSync,
  googleSheetCount = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "pending" | "cleared">("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isOutstandingMenuOpen, setIsOutstandingMenuOpen] = useState(false);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        project.college_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.project_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.academic_year.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const pending = Math.max(0, project.gst_cost - project.invoice_raised);
      if (filterType === "pending") return pending > 0;
      if (filterType === "cleared") return pending === 0;

      return true;
    });
  }, [projects, searchTerm, filterType]);

  const exportToCSV = () => {
    const headers = [
      "#",
      "Project Code",
      "College Name",
      "Academic Year",
      "Total Cost Value (INR)",
      "Total Cost Value with GST (INR)",
      "Invoices Raised Count",
      "Invoice Raised (INR)",
      "Invoice to be Raised (INR)",
    ];

    const rows = filteredProjects.map((p, index) => {
      const stats = getProjectInvoiceStats(p);
      return [
        index + 1,
        `"${p.project_code}"`,
        `"${p.college_name}"`,
        `"${p.academic_year}"`,
        p.total_cost_value,
        p.gst_cost,
        `"${stats.raisedCount} of ${stats.totalCount}"`,
        p.invoice_raised,
        Math.max(0, p.gst_cost - p.invoice_raised),
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `college_projects_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelectOutstandingPeriod = (period: OutstandingPeriod) => {
    setIsOutstandingMenuOpen(false);
    onOpenOutstanding(period);
  };

  return (
    <div className="dashboard-container">
      {/* Top Section - Add College, Update College and Outstanding Cards */}
      <section className="top-action-cards-grid">
        {/* Card 1: Add College Card */}
        <div className="action-card add-card" onClick={onOpenAddCollege} role="button" tabIndex={0}>
          <div className="action-card-content">
            <div className="action-card-header-row">
              <div className="action-icon-wrap add-icon-wrap">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2l10 5H2l10-5z" />
                  <circle cx="18.5" cy="5.5" r="4.5" fill="#2563eb" stroke="white" strokeWidth="1.5" />
                  <path d="M18.5 3.5v4M16.5 5.5h4" stroke="white" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="action-card-text">
                <h2 className="action-card-title">Add College</h2>
                <p className="action-card-desc">
                  Add new college, project details and estimate financials including GST.
                </p>
              </div>
            </div>

            <div className="action-btn-row">
              <button
                type="button"
                className="action-btn add-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAddCollege();
                }}
                id="add-college-btn"
              >
                <span>+ Add College</span>
                <ArrowRight size={16} className="btn-arrow" />
              </button>
            </div>
          </div>

          <div className="action-card-art-wrap add-art-wrap" aria-hidden="true">
            <svg viewBox="0 0 170 140" fill="none" className="card-illustration-svg">
              <path d="M25 50 L85 18 L145 50 Z" fill="#93c5fd" fillOpacity="0.45" />
              <rect x="30" y="50" width="110" height="9" rx="2" fill="#60a5fa" fillOpacity="0.35" />
              <rect x="38" y="65" width="12" height="48" rx="2" fill="#60a5fa" fillOpacity="0.3" />
              <rect x="66" y="65" width="12" height="48" rx="2" fill="#60a5fa" fillOpacity="0.3" />
              <rect x="94" y="65" width="12" height="48" rx="2" fill="#60a5fa" fillOpacity="0.3" />
              <rect x="122" y="65" width="12" height="48" rx="2" fill="#60a5fa" fillOpacity="0.3" />
              <rect x="22" y="113" width="126" height="12" rx="3" fill="#93c5fd" fillOpacity="0.45" />
              <circle cx="132" cy="98" r="20" fill="#dbeafe" stroke="#60a5fa" strokeWidth="3" />
              <path d="M132 88 v20 M122 98 h20" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 2: Update College Card */}
        <div className="action-card update-card" onClick={onOpenUpdateModal} role="button" tabIndex={0}>
          <div className="action-card-content">
            <div className="action-card-header-row">
              <div className="action-icon-wrap update-icon-wrap">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M12 2l10 5H2l10-5z" />
                  <circle cx="18.5" cy="5.5" r="4.5" fill="#7c3aed" stroke="white" strokeWidth="1.5" />
                  <path d="M16 4.5l3.5 3.5M19 4l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="action-card-text">
                <h2 className="action-card-title">Update College</h2>
                <p className="action-card-desc">
                  Update existing college details, training phases and financials.
                </p>
              </div>
            </div>

            <div className="action-btn-row">
              <button
                type="button"
                className="action-btn update-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenUpdateModal();
                }}
                id="update-college-btn"
              >
                <span>Update College</span>
                <ArrowRight size={16} className="btn-arrow" />
              </button>
            </div>
          </div>

          <div className="action-card-art-wrap update-art-wrap" aria-hidden="true">
            <svg viewBox="0 0 170 140" fill="none" className="card-illustration-svg">
              <path d="M25 50 L85 18 L145 50 Z" fill="#c4b5fd" fillOpacity="0.45" />
              <rect x="30" y="50" width="110" height="9" rx="2" fill="#a78bfa" fillOpacity="0.35" />
              <rect x="38" y="65" width="12" height="48" rx="2" fill="#a78bfa" fillOpacity="0.3" />
              <rect x="66" y="65" width="12" height="48" rx="2" fill="#a78bfa" fillOpacity="0.3" />
              <rect x="94" y="65" width="12" height="48" rx="2" fill="#a78bfa" fillOpacity="0.3" />
              <rect x="122" y="65" width="12" height="48" rx="2" fill="#a78bfa" fillOpacity="0.3" />
              <rect x="22" y="113" width="126" height="12" rx="3" fill="#c4b5fd" fillOpacity="0.45" />
              <circle cx="132" cy="98" r="20" fill="#ede9fe" stroke="#a78bfa" strokeWidth="3" />
              <path d="M125 105 l3.5 -10.5 l9 -9 l3.5 3.5 l-9 9 z" fill="#7c3aed" />
              <path d="M135 87 l2.5 2.5" stroke="white" strokeWidth="1.5" />
            </svg>
          </div>
        </div>

        {/* Card 3: Outstanding Card (NEW!) */}
        <div
          className="action-card outstanding-card"
          onClick={() => setIsOutstandingMenuOpen(true)}
          role="button"
          tabIndex={0}
        >
          <div className="action-card-content">
            <div className="action-card-header-row">
              <div className="action-icon-wrap outstanding-icon-wrap">
                <Clock size={26} />
              </div>
              <div className="action-card-text">
                <h2 className="action-card-title">Outstanding</h2>
                <p className="action-card-desc">
                  Quarterly & Monthly breakdown of raised vs. received invoices.
                </p>
              </div>
            </div>

            <div className="action-btn-row">
              <button
                type="button"
                className="action-btn outstanding-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOutstandingMenuOpen(true);
                }}
                id="outstanding-btn"
              >
                <span>Outstanding</span>
                <ChevronDown size={16} className="btn-arrow" />
              </button>
            </div>
          </div>

          <div className="action-card-art-wrap outstanding-art-wrap" aria-hidden="true">
            <svg viewBox="0 0 170 140" fill="none" className="card-illustration-svg">
              <circle cx="95" cy="70" r="50" fill="#fed7aa" fillOpacity="0.45" />
              <circle cx="95" cy="70" r="38" fill="#ffffff" fillOpacity="0.6" />
              <path d="M95 44 v26 l16 10" stroke="#ea580c" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="135" cy="40" r="14" fill="#ffedd5" stroke="#f97316" strokeWidth="2" />
              <path d="M131 40 l3 3 l6 -6" stroke="#ea580c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </section>

      {/* Outstanding Period Selection Modal / Dropdown */}
      <OutstandingDropdown
        isOpen={isOutstandingMenuOpen}
        onClose={() => setIsOutstandingMenuOpen(false)}
        onSelectPeriod={handleSelectOutstandingPeriod}
      />

      {/* Bottom Section - Excel Type Overview Table */}
      <section className="excel-table-section">
        <div className="table-panel-header">
          <div
            className="table-header-info clickable-header"
            onClick={() => filteredProjects.length > 0 && onViewProject(filteredProjects[0])}
            title="Click to view Health Report"
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
          >
            <div className="panel-icon-wrap">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="table-panel-title">College Projects Overview</h2>
              <p className="table-panel-subtitle">
                View and manage all college projects, costs and invoice status
              </p>
            </div>
          </div>

          <div className="table-toolbar">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="table-search-input"
                placeholder="Search by college name or project code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                id="dashboard-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchTerm("")}
                >
                  &times;
                </button>
              )}
            </div>

            <div className="filter-dropdown-wrapper">
              <button
                type="button"
                className={`toolbar-btn filter-btn ${filterType !== "all" ? "active" : ""}`}
                onClick={() => setShowFilterMenu(!showFilterMenu)}
              >
                <Filter size={15} />
                <span>
                  {filterType === "all"
                    ? "Filter"
                    : filterType === "pending"
                    ? "Pending Invoice"
                    : "Fully Cleared"}
                </span>
                <ChevronDown size={14} />
              </button>

              {showFilterMenu && (
                <div className="filter-menu">
                  <button
                    type="button"
                    className={`filter-item ${filterType === "all" ? "selected" : ""}`}
                    onClick={() => {
                      setFilterType("all");
                      setShowFilterMenu(false);
                    }}
                  >
                    All Projects
                  </button>
                  <button
                    type="button"
                    className={`filter-item ${filterType === "pending" ? "selected" : ""}`}
                    onClick={() => {
                      setFilterType("pending");
                      setShowFilterMenu(false);
                    }}
                  >
                    Pending Invoices
                  </button>
                  <button
                    type="button"
                    className={`filter-item ${filterType === "cleared" ? "selected" : ""}`}
                    onClick={() => {
                      setFilterType("cleared");
                      setShowFilterMenu(false);
                    }}
                  >
                    Fully Invoiced
                  </button>
                </div>
              )}
            </div>

            {onOpenGoogleSheetSync && (
              <button
                type="button"
                className="toolbar-btn gsheet-toolbar-btn"
                onClick={onOpenGoogleSheetSync}
                title="Connect or Sync Google Spreadsheet"
              >
                <FileSpreadsheet size={15} />
                <span>{googleSheetCount > 0 ? `Sheet (${googleSheetCount})` : "Sync Sheet"}</span>
              </button>
            )}

            <button
              type="button"
              className="toolbar-btn export-btn"
              onClick={exportToCSV}
              title="Export as Excel / CSV"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Excel Styled Table */}
        <div className="table-responsive-wrapper">
          <table className="excel-table">
            <thead>
              <tr>
                <th className="th-num">#</th>
                <th className="th-project">
                  <div className="th-content">Project Code</div>
                </th>
                <th className="th-cost text-right">
                  <div className="th-content text-right">Total Cost Value (₹)</div>
                </th>
                <th className="th-gst text-right">
                  <div className="th-content text-right">Total Cost Value with GST (₹)</div>
                </th>
                <th className="th-raised text-center">
                  <div className="th-content text-center">Invoice Raised (₹)</div>
                </th>
                <th className="th-pending text-center">
                  <div className="th-content text-center">Invoice to be Raised (₹)</div>
                </th>
                <th className="th-actions text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-row">
                    <div className="empty-table-state">
                      <Building2 size={36} className="empty-icon" />
                      <p className="empty-title">No college projects found</p>
                      <p className="empty-desc">
                        {searchTerm
                          ? "Try searching for a different college name or project code."
                          : "Add your first college project using the button above."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project, index) => {
                  const invoiceToBeRaised = Math.max(0, project.gst_cost - project.invoice_raised);
                  return (
                    <tr
                      key={project.id}
                      className="excel-row clickable-row"
                      onClick={() => onViewProject(project)}
                      title={`Click to view Health Report for ${project.college_name}`}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="td-num">{index + 1}</td>
                      <td className="td-project">
                        <div className="project-cell-data">
                          <span className="project-code-highlight">
                            {project.project_code || "N/A"}
                          </span>
                          <span className="college-name-sub">
                            {project.college_name || "Untitled College"}
                          </span>
                        </div>
                      </td>
                      <td className="td-cost text-right">
                        <span className="currency-val">
                          {formatINR(project.total_cost_value)}
                        </span>
                      </td>
                      <td className="td-gst text-right">
                        <span className="currency-val font-semibold">
                          {formatINR(project.gst_cost)}
                        </span>
                      </td>
                      <td className="td-raised text-center">
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                          <span className="badge-pill green-badge">
                            {formatINR(project.invoice_raised)}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                            {getProjectInvoiceStats(project).raisedCount} of {getProjectInvoiceStats(project).totalCount} Raised
                          </span>
                        </div>
                      </td>
                      <td className="td-pending text-center">
                        <span className="badge-pill amber-badge">
                          {formatINR(invoiceToBeRaised)}
                        </span>
                      </td>
                      <td className="td-actions text-center">
                        <div className="action-buttons-group">
                          <button
                            type="button"
                            className="action-icon-btn view-btn"
                            title="View Health Report & Details"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewProject(project);
                            }}
                            aria-label={`View ${project.college_name}`}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn edit-btn"
                            title="Edit College Details"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProject(project);
                            }}
                            aria-label={`Edit ${project.college_name}`}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn delete-btn"
                            title="Delete College"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(
                                  `Are you sure you want to delete "${project.college_name}" (${project.project_code})?`
                                )
                              ) {
                                onDeleteProject(project.id);
                              }
                            }}
                            aria-label={`Delete ${project.college_name}`}
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
    </div>
  );
};
