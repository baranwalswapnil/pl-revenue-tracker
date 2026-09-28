import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Building2,
  X,
  FileEdit,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { Project } from "../lib/models";
import { type GoogleSheetCollegeItem } from "../lib/googleSheetsService";
import { FileSpreadsheet, RefreshCw } from "lucide-react";

interface Step5UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onOpenGoogleSheetSync?: () => void;
  googleSheetColleges?: GoogleSheetCollegeItem[];
}

export const Step5_UpdateModal: React.FC<Step5UpdateModalProps> = ({
  isOpen,
  onClose,
  projects,
  onSelectProject,
  onOpenGoogleSheetSync,
  googleSheetColleges = [],
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.college_name.toLowerCase().includes(q) ||
        p.project_code.toLowerCase().includes(q) ||
        (p.academic_year && p.academic_year.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="update-search-modal">
        {/* Modal Header */}
        <div className="modal-hero-header">
          <div className="modal-hero-left">
            <div className="modal-icon-badge">
              <FileEdit size={22} />
            </div>
            <div>
              <h2 className="modal-title">Update College / Project</h2>
              <p className="modal-subtitle">
                Search and select a college or project to update the details.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar Input */}
        <div className="modal-search-box-wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label className="modal-search-label" htmlFor="modalCollegeSearch" style={{ margin: 0 }}>
              <Search size={16} className="modal-search-icon" />
              <span>Search College or Project <span className="req-star">*</span></span>
            </label>
            {onOpenGoogleSheetSync && (
              <button
                type="button"
                className="gsheet-sync-trigger-btn"
                style={{ padding: "4px 10px", fontSize: "12px" }}
                onClick={() => {
                  onClose();
                  onOpenGoogleSheetSync();
                }}
              >
                <RefreshCw size={12} />
                <span>{googleSheetColleges.length > 0 ? `Sync Sheet (${googleSheetColleges.length})` : "Sync Google Sheet"}</span>
              </button>
            )}
          </div>
          <div className="search-input-field-wrap">
            <Search size={18} className="inner-search-icon" />
            <input
              ref={inputRef}
              id="modalCollegeSearch"
              type="text"
              className="modal-search-input"
              placeholder="e.g. DYP, PCCOE, College of Engineering..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-query-btn"
                onClick={() => setSearchQuery("")}
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Filtered Results Dropdown List */}
        <div className="modal-results-container">
          {filteredProjects.length === 0 ? (
            <div className="empty-search-state">
              <Building2 size={32} className="empty-icon-muted" />
              <p className="empty-text-title">No college or project matched "{searchQuery}"</p>
              <p className="empty-text-subtitle">Try searching with a college name or project code.</p>
            </div>
          ) : (
            <div className="results-cards-list">
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className="project-result-card"
                  onClick={() => {
                    onSelectProject(project);
                    onClose();
                  }}
                >
                  <div className="result-card-left">
                    <div className="college-avatar-icon">
                      <Building2 size={20} />
                    </div>
                    <div className="result-text-group">
                      <div className="result-project-code">{project.project_code}</div>
                      <div className="result-college-name">{project.college_name}</div>
                    </div>
                  </div>

                  <div className="result-card-right">
                    <span className="code-pill">Project Code: {project.project_code}</span>
                    <ArrowRight size={16} className="arrow-select" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
