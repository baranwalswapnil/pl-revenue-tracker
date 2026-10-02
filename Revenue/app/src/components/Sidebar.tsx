import React from "react";
import {
  LayoutDashboard,
  FilePlus2,
  GraduationCap,
  PieChart,
  Settings,
  Sparkles,
} from "lucide-react";
import gryphonLogo from "../assets/gryphon_logo.png";

export type NavTab = "dashboard" | "new-entry" | "training-phase" | "health-report" | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  projectCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, projectCount }) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={18} />,
      badge: projectCount,
    },
    {
      id: "new-entry",
      label: "New Entry",
      icon: <FilePlus2 size={18} />,
    },
    {
      id: "training-phase",
      label: "Training Phases",
      icon: <GraduationCap size={18} />,
    },
    {
      id: "health-report",
      label: "Health Report",
      icon: <PieChart size={18} />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings size={18} />,
    },
  ];

  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      <div className="sidebar-brand">
        <div className="brand-logo-wrap">
          <img src={gryphonLogo} alt="Gryphon Academy" className="brand-logo-img" />
        </div>
        <div className="brand-text">
          <div className="brand-title">Company Finance</div>
          <div className="brand-subtitle">Estimation & Tracking</div>
        </div>
      </div>

      <div className="sidebar-section-heading">MAIN MENU</div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-link ${isActive ? "active" : ""}`}
              onClick={() => onSelectTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge !== undefined && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-pro-card">
          <div className="pro-header">
            <Sparkles size={15} className="sparkle-icon" />
            <span>P&L Health Engine</span>
          </div>
          <p className="pro-desc">Auto-GST calculation & training variance analytics enabled.</p>
        </div>
      </div>
    </aside>
  );
};
