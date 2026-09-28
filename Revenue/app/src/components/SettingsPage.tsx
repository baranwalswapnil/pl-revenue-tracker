import React from "react";
import {
  Settings,
  RotateCcw,
  Download,
  Upload,
  Database,
  ShieldCheck,
  Building2,
  CheckCircle2,
} from "lucide-react";
import type { Project } from "../lib/models";
import { INITIAL_PROJECTS } from "../lib/mockData";

interface SettingsPageProps {
  projects: Project[];
  onResetAllData: () => void;
  onImportData: (projects: Project[]) => void;
  onBackToDashboard: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  projects,
  onResetAllData,
  onImportData,
  onBackToDashboard,
}) => {
  const handleExportJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(projects, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `revenue_projects_backup_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          onImportData(json);
          alert("Data imported successfully!");
        } else {
          alert("Invalid file format. Expected a list of projects.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="settings-page-container">
      <div className="page-hero-banner">
        <div className="banner-left">
          <div className="banner-icon-badge">
            <Settings size={26} />
          </div>
          <div>
            <h1 className="banner-title">Workspace Settings</h1>
            <p className="banner-subtitle">
              Manage your company data, GST rules, and backups.
            </p>
          </div>
        </div>
      </div>

      <div className="settings-cards-grid">
        {/* Workspace Details */}
        <div className="settings-card">
          <div className="settings-card-header">
            <Building2 size={20} className="settings-card-icon blue-text" />
            <h2 className="settings-card-title">Company Profile</h2>
          </div>
          <div className="settings-card-body">
            <div className="setting-field">
              <span className="setting-key">Active Company</span>
              <strong className="setting-val">Company Finance & Estimations</strong>
            </div>
            <div className="setting-field">
              <span className="setting-key">GST Tax Rate</span>
              <strong className="setting-val">18.0% (Auto Calculated)</strong>
            </div>
            <div className="setting-field">
              <span className="setting-key">Active Projects</span>
              <strong className="setting-val">{projects.length} Registered Projects</strong>
            </div>
          </div>
        </div>

        {/* Data Management & Backup */}
        <div className="settings-card">
          <div className="settings-card-header">
            <Database size={20} className="settings-card-icon purple-text" />
            <h2 className="settings-card-title">Data Backup & Restore</h2>
          </div>
          <div className="settings-card-body">
            <p className="setting-desc">
              Export all college contracts, training phases and invoice schedules to JSON.
            </p>
            <div className="settings-buttons-row">
              <button
                type="button"
                className="settings-action-btn primary-outline"
                onClick={handleExportJson}
              >
                <Download size={15} />
                <span>Export JSON Backup</span>
              </button>

              <label className="settings-action-btn secondary-outline file-upload-label">
                <Upload size={15} />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden-file-input"
                  onChange={handleImportJson}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Reset Demo Data */}
        <div className="settings-card danger-card">
          <div className="settings-card-header">
            <RotateCcw size={20} className="settings-card-icon red-text" />
            <h2 className="settings-card-title">Reset Sample Data</h2>
          </div>
          <div className="settings-card-body">
            <p className="setting-desc">
              Reset the register to the default 8 sample colleges shown in the specifications.
            </p>
            <button
              type="button"
              className="settings-action-btn danger-btn"
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to restore the default sample colleges? Any custom modifications will be overwritten."
                  )
                ) {
                  onResetAllData();
                }
              }}
            >
              <RotateCcw size={15} />
              <span>Reset to Sample Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
