import React, { useState, useEffect } from "react";
import type { Project, ProjectDraft } from "./lib/models";
import { INITIAL_PROJECTS, createEmptyDraft, computeAttpDetails } from "./lib/mockData";
import {
  loadCachedSheetItems,
  loadCachedMOUItems,
  loadSavedSheetConfig,
  fetchGoogleSheetData,
  fetchInvoiceTrackerData,
  fetchMOUData,
  buildProjectsFromInvoiceTracker,
  convertSheetItemToDraft,
  convertSheetItemToProject,
  saveCachedSheetItems,
  saveCachedMOUItems,
  saveSheetConfig,
  syncProjectToGoogleSheet,
  type GoogleSheetCollegeItem,
  type GoogleSheetInvoiceTrackerItem,
  type GoogleSheetMOUItem,
} from "./lib/googleSheetsService";
import { Header } from "./components/Header";
import { Step1_Dashboard } from "./components/Step1_Dashboard";
import { Step2_NewEntry } from "./components/Step2_NewEntry";
import { Step3_TrainingPhase } from "./components/Step3_TrainingPhase";
import { Step4_HealthReport } from "./components/Step4_HealthReport";
import { Step5_UpdateModal } from "./components/Step5_UpdateModal";
import { Step5_UpdatePage } from "./components/Step5_UpdatePage";
import { Step6_OutstandingPage } from "./components/Step6_OutstandingPage";
import { Step7_TCVPage } from "./components/Step7_TCVPage";
import { GoogleSheetSyncModal } from "./components/GoogleSheetSyncModal";
import { Toast, type ToastType } from "./components/Toast";
import { type OutstandingPeriod, getDefaultPeriod } from "./lib/outstandingService";
import "./style.css";

const LOCAL_STORAGE_KEY = "company_finance_projects_v3";

type AppView = "dashboard" | "new-entry" | "training-phase" | "health-report" | "update-page" | "outstanding" | "tcv";

export function App() {
  // Load initial projects from localStorage (filtering out legacy sample mock items)
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (p: any) =>
              p &&
              typeof p === "object" &&
              (!p.id || !String(p.id).startsWith("proj-"))
          );
          return filtered;
        }
      }
    } catch (e) {
      console.error("Error reading localStorage", e);
    }
    return [];
  });

  // Save to localStorage whenever projects change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error("Error writing to localStorage", e);
    }
  }, [projects]);

  // Ensure dark-mode class is cleared
  useEffect(() => {
    try {
      localStorage.removeItem("theme_mode");
    } catch (e) {}
    document.documentElement.classList.remove("dark-mode");
    document.body.classList.remove("dark-mode");
  }, []);

  // Google Sheets integration state
  const [googleSheetColleges, setGoogleSheetColleges] = useState<GoogleSheetCollegeItem[]>(() =>
    loadCachedSheetItems()
  );
  const [mouItems, setMouItems] = useState<GoogleSheetMOUItem[]>(() =>
    loadCachedMOUItems()
  );
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState(false);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);
  const [lastLiveSyncTime, setLastLiveSyncTime] = useState<string | null>(null);

  // Automatic Background Live Sync on Mount, Tab Focus, and Interval (every 60s)
  useEffect(() => {
    let isCancelled = false;

    const performBackgroundSync = async (silent = true) => {
      const config = loadSavedSheetConfig();
      if (!config.sheetUrl || !config.sheetUrl.trim() || config.autoSync === false) return;

      if (!silent) setIsLiveSyncing(true);
      try {
        // 1. Fetch primary colleges sheet
        const items = await fetchGoogleSheetData(config.sheetUrl, config.sheetName);
        if (isCancelled || !items || items.length === 0) return;

        setGoogleSheetColleges(items);
        saveCachedSheetItems(items);
        setLastLiveSyncTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

        // 2. Try fetching 'Invoice Tracker' tab data
        let invoiceTrackerItems: GoogleSheetInvoiceTrackerItem[] = [];
        try {
          invoiceTrackerItems = await fetchInvoiceTrackerData(config.sheetUrl, "Invoice Tracker");
        } catch (invErr) {
          // Tab might not exist or have different name, ignore gracefully
        }

        // 3. Try fetching 'MOUs 26-27' tab data for TCV page
        try {
          const mouData = await fetchMOUData(config.sheetUrl, "MOUs 26-27");
          if (!isCancelled && mouData && mouData.length > 0) {
            setMouItems(mouData);
            saveCachedMOUItems(mouData);
          }
        } catch (mouErr) {
          // Tab might not exist or network error, ignore gracefully
        }

        // Auto-merge latest sheet figures & Invoice Tracker milestones into registered projects
        setProjects((prev) => {
          let updatedProjects = prev.map((p) => {
            const match = items.find(
              (item) =>
                (item.project_code && item.project_code.toLowerCase() === p.project_code.toLowerCase()) ||
                (item.college_name && item.college_name.toLowerCase() === p.college_name.toLowerCase())
            );
            if (!match) return p;

            return {
              ...p,
              student_count: match.student_count || p.student_count,
              cost_per_student: match.cost_per_student || p.cost_per_student,
              total_cost_value: match.total_cost_value || p.total_cost_value,
              gst_cost: match.gst_cost || p.gst_cost,
              training_cost: match.training_cost !== undefined ? match.training_cost : p.training_cost,
              hours_planned: match.hours_planned || p.hours_planned,
              payment_type: match.payment_type || p.payment_type,
              academic_year: match.academic_year || p.academic_year,
              passing_year: match.passing_year || p.passing_year,
              invoice_count: match.invoice_count || p.invoice_count,
              installment_count: match.invoice_count || p.installment_count,
              updated_at: new Date().toISOString(),
            };
          });

          // If Invoice Tracker items were retrieved, build & merge rich project milestones
          if (invoiceTrackerItems.length > 0) {
            updatedProjects = buildProjectsFromInvoiceTracker(invoiceTrackerItems, updatedProjects);
          }

          return updatedProjects;
        });
      } catch (err) {
        if (!silent) console.warn("Background sheet sync notice:", err);
      } finally {
        if (!isCancelled) setIsLiveSyncing(false);
      }
    };

    // 1. Initial fetch on mount
    performBackgroundSync(false);

    // 2. Window focus listener (syncs automatically when user returns to this tab from spreadsheet)
    const handleWindowFocus = () => {
      performBackgroundSync(true);
    };
    window.addEventListener("focus", handleWindowFocus);

    // 3. Periodic background refresh interval every 60 seconds
    const intervalId = setInterval(() => {
      performBackgroundSync(true);
    }, 60000);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
      clearInterval(intervalId);
    };
  }, []);

  // Current active view in the sequential flow
  const [currentView, setCurrentView] = useState<AppView>("dashboard");

  // Selected project for viewing Health Report or Updating
  const [activeProject, setActiveProject] = useState<Project | null>(projects[0] || null);

  // Selected period for Outstanding Tracker
  const [outstandingPeriod, setOutstandingPeriod] = useState<OutstandingPeriod>(() => getDefaultPeriod());

  // Draft state for Step 2 and Step 3
  const [draft, setDraft] = useState<ProjectDraft>(() => createEmptyDraft());

  // Modal open state for Step 5 Update search
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Notification Toast state
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3500);
  };

  // Centralized Navigation with Browser History pushState / popstate support
  const navigateTo = (view: AppView, project: Project | null = activeProject, replace = false) => {
    setCurrentView(view);
    if (project) setActiveProject(project);

    const statePayload = { view, projectId: project?.id || null };
    const hash = view === "dashboard" ? "" : `#${view}`;
    const newUrl = window.location.pathname + hash;

    try {
      if (replace) {
        window.history.replaceState(statePayload, "", newUrl);
      } else {
        window.history.pushState(statePayload, "", newUrl);
      }
    } catch (e) {
      console.warn("History pushState error:", e);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Synchronize with Browser Back / Forward buttons
  useEffect(() => {
    const validViews: AppView[] = ["dashboard", "new-entry", "training-phase", "health-report", "update-page", "outstanding", "tcv"];
    const currentHash = window.location.hash.replace("#", "") as AppView;

    if (validViews.includes(currentHash)) {
      setCurrentView(currentHash);
      window.history.replaceState({ view: currentHash }, "", window.location.pathname + window.location.hash);
    } else {
      window.history.replaceState({ view: "dashboard" }, "", window.location.pathname);
    }

    const handlePopState = (event: PopStateEvent) => {
      const targetView = event.state?.view || (window.location.hash.replace("#", "") as AppView) || "dashboard";
      if (validViews.includes(targetView)) {
        setCurrentView(targetView);
        if (event.state?.projectId) {
          const found = projects.find((p) => p.id === event.state.projectId);
          if (found) setActiveProject(found);
        }
      } else {
        setCurrentView("dashboard");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [projects]);

  const handleOpenOutstanding = (period?: OutstandingPeriod) => {
    if (period) {
      setOutstandingPeriod(period);
    }
    navigateTo("outstanding");
  };

  const handleOpenTCV = () => {
    navigateTo("tcv");
  };

  const handleRefreshTCVData = async () => {
    const config = loadSavedSheetConfig();
    if (!config.sheetUrl || !config.sheetUrl.trim()) {
      showToast("Please configure Google Sheet URL in sync settings first.", "warning");
      return;
    }
    setIsLiveSyncing(true);
    try {
      const fetched = await fetchMOUData(config.sheetUrl, "MOUs 26-27");
      if (fetched && fetched.length > 0) {
        setMouItems(fetched);
        saveCachedMOUItems(fetched);
        showToast(`Successfully synced ${fetched.length} MOU records from MOUs 26-27!`, "success");
      } else {
        showToast("No MOU records found in MOUs 26-27 sheet.", "warning");
      }
    } catch (err: any) {
      showToast(`Error refreshing MOU data: ${err.message || err}`, "error");
    } finally {
      setIsLiveSyncing(false);
    }
  };

  // ==========================================
  // GOOGLE SPREADSHEET HANDLERS
  // ==========================================

  const handleOpenGoogleSheetSync = () => {
    setIsGoogleSheetModalOpen(true);
  };

  const handleImportCollegesFromSheet = (items: GoogleSheetCollegeItem[]) => {
    setGoogleSheetColleges(items);
    saveCachedSheetItems(items);

    // Convert items into Projects and merge with existing list
    const newProjects = items.map(convertSheetItemToProject);
    setProjects((prev) => {
      const existingMap = new Map(prev.map((p) => [p.project_code.toLowerCase(), p]));
      newProjects.forEach((np) => {
        existingMap.set(np.project_code.toLowerCase(), np);
      });
      return Array.from(existingMap.values());
    });

    showToast(`Successfully imported ${items.length} colleges from Google Spreadsheet!`, "success");
  };

  const handleSelectGoogleSheetCollegeForDraft = (item: GoogleSheetCollegeItem) => {
    const populatedDraft = convertSheetItemToDraft(item);
    setDraft(populatedDraft);
    showToast(`Pre-filled details for "${item.college_name}" from Google Sheet!`, "success");
  };

  // ==========================================
  // FLOW 1: ADD COLLEGE FLOW
  // Dashboard -> Step 2 (New Entry) -> Step 3 (Training Phase) -> Step 4 (Health Report) -> Saved to backend
  // ==========================================

  const handleOpenAddCollege = () => {
    const newEmpty = createEmptyDraft();
    setDraft(newEmpty);
    navigateTo("new-entry");
  };

  // Step 2: New Entry handlers
  const handleUpdateDraft = (fields: Partial<ProjectDraft>) => {
    setDraft((prev) => ({ ...prev, ...fields }));
  };

  const handleResetDraft = () => {
    setDraft(createEmptyDraft());
    showToast("Form has been reset.", "info");
  };

  const handleProceedToTrainingPhase = (proceedToTraining: boolean) => {
    if (proceedToTraining) {
      // Move to Step 3 (Training Phase)
      navigateTo("training-phase");
      showToast("College details saved! Now configure the training phase.", "success");
    } else {
      // Save directly to projects state & localStorage
      saveDraftToProjects(false);
    }
  };

  // Step 3: Training Phase Submit handler -> Saves everything to backend and opens Health Report
  const handleSaveAndSubmitTrainingPhase = () => {
    saveDraftToProjects(true);
  };

  const saveDraftToProjects = (openHealthReport: boolean) => {
    const students = Math.max(0, Number(draft.studentCount) || 0);
    const costPerStudent = Math.max(0, Number(draft.costPerStudent) || 0);
    const totalCost = Number(draft.totalCostValue) || students * costPerStudent;
    const gstCost = Number(draft.gstCost) || totalCost * 1.18;
    const trainingCost = Math.max(0, Number(draft.trainingCost) || 0);
    const hoursPlanned = Math.max(0, Number(draft.hoursPlanned) || 0);
    const hoursGiven = Math.max(0, Number(draft.hoursGiven) || 0);

    let invoiceCount = 1;
    if (draft.paymentType === "FNF") {
      invoiceCount = 1;
    } else if (draft.paymentType === "ATP") {
      invoiceCount = 2;
    } else if (draft.paymentType === "ATTP") {
      const details = computeAttpDetails(draft.attpPercentage || "50%");
      invoiceCount = details.invoiceCount;
    } else if (draft.paymentType === "EMI") {
      invoiceCount = Number(draft.installmentCount) || 5;
    }

    // Build or update phases array
    const updatedPhases = draft.phases?.length ? [...draft.phases] : [];
    const currentPhaseIndex = updatedPhases.findIndex((p) => p.phase === draft.selectedPhase);
    const phasePayload = {
      phase: draft.selectedPhase,
      startDate: draft.phaseStartDate || "",
      endDate: draft.phaseEndDate || "",
      hoursPlanned,
      hoursGiven,
      trainingCost,
      paymentType: draft.paymentType,
      attpPercentage: draft.paymentType === "ATTP" ? draft.attpPercentage : undefined,
      invoiceCount,
    };

    if (currentPhaseIndex >= 0) {
      updatedPhases[currentPhaseIndex] = phasePayload;
    } else {
      updatedPhases.push(phasePayload);
    }

    const newProj: Project = {
      id: draft.id || `proj-${Date.now()}`,
      college_name: draft.collegeName.trim() || "Untitled College",
      project_code: draft.projectCode.trim() || `PRJ-${Date.now().toString().slice(-4)}`,
      academic_year: draft.academicYear,
      passing_year: draft.passingYear,
      student_count: students,
      cost_per_student: costPerStudent,
      total_cost_value: totalCost,
      gst_cost: gstCost,
      manual_total_cost: draft.manualTotal,
      manual_gst_cost: draft.manualGst,
      phases: updatedPhases,
      hours_planned: hoursPlanned,
      hours_given: hoursGiven,
      training_cost: trainingCost,
      payment_type: draft.paymentType,
      attp_percentage: draft.paymentType === "ATTP" ? draft.attpPercentage : undefined,
      installment_count: Number(draft.installmentCount) || 1,
      invoice_count: invoiceCount,
      invoice_raised: Number(draft.invoiceRaised) || 0,
      additional_notes: draft.additionalNotes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Check if project already exists
    const isExisting = projects.some((p) => p.id === newProj.id || p.project_code === newProj.project_code);

    // Save to projects state & localStorage
    setProjects((prev) => {
      const index = prev.findIndex((p) => p.id === newProj.id || p.project_code === newProj.project_code);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = newProj;
        return updated;
      }
      return [newProj, ...prev];
    });

    setActiveProject(newProj);

    // Two-way sync with Google Spreadsheet
    syncProjectToGoogleSheet(isExisting ? "update" : "add", newProj).then((syncRes) => {
      if (syncRes.success) {
        showToast(
          openHealthReport
            ? `Training Phase submitted & synced to Google Sheet!`
            : `College "${newProj.college_name}" added to register & Google Sheet!`,
          "success"
        );
      }
    });

    if (openHealthReport) {
      navigateTo("health-report", newProj);
      showToast("Training Phase submitted! Showing Health Report.", "success");
    } else {
      navigateTo("dashboard", newProj);
      showToast(`College "${newProj.college_name}" added to register!`, "success");
    }
  };

  // ==========================================
  // FLOW 2: UPDATE COLLEGE FLOW
  // Dashboard -> Click Update College -> Search Modal -> Select College -> Step 5 Update Page -> Save -> Dashboard
  // ==========================================

  const handleOpenUpdateModal = () => {
    setIsUpdateModalOpen(true);
  };

  const handleSelectProjectToUpdate = (project: Project) => {
    setActiveProject(project);
    setDraft(createEmptyDraft(project));
    navigateTo("update-page", project);
  };

  const handleEditProjectFromDashboard = (project: Project) => {
    setActiveProject(project);
    setDraft(createEmptyDraft(project));
    navigateTo("update-page", project);
  };

  const handleSaveUpdatedProject = (updated: Project) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...updated, updated_at: new Date().toISOString() } : p))
    );
    setActiveProject(updated);
    setDraft(createEmptyDraft(updated));

    // Two-way sync update to Google Spreadsheet
    syncProjectToGoogleSheet("update", updated).then((syncRes) => {
      if (syncRes.success) {
        showToast(`Project "${updated.college_name}" updated & saved in Google Sheet!`, "success");
      }
    });

    showToast(`Project "${updated.college_name}" updated! Showing Health Report.`, "success");
    navigateTo("health-report", updated);
  };

  // Table direct actions
  const handleViewProjectHealth = (project: Project) => {
    setActiveProject(project);
    setDraft(createEmptyDraft(project));
    navigateTo("health-report", project);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    showToast("Project deleted successfully.", "info");
    if (activeProject?.id === projectId) {
      setActiveProject(projects.find((p) => p.id !== projectId) || null);
    }
  };

  return (
    <div className="finance-app-standalone-container">
      {/* Top Header Bar */}
      <Header
        currentView={currentView}
        onBackToDashboard={() => navigateTo("dashboard")}
        selectedCollegeName={
          currentView === "outstanding"
            ? undefined
            : currentView === "new-entry"
            ? draft.collegeName || "New College"
            : currentView === "training-phase"
            ? draft.collegeName || "Training Phase"
            : activeProject?.college_name
        }
        onOpenGoogleSheetSync={handleOpenGoogleSheetSync}
        googleSheetCount={googleSheetColleges.length}
        isLiveSyncing={isLiveSyncing}
        lastLiveSyncTime={lastLiveSyncTime}
      />

      {/* Main Container Body */}
      <main className="app-main-content-wrap">
        {/* Step 1: Main Dashboard Screen (Add College card, Update College card, Outstanding card, TCV card, Excel Table) */}
        {currentView === "dashboard" && (
          <Step1_Dashboard
            projects={projects}
            onOpenAddCollege={handleOpenAddCollege}
            onOpenUpdateModal={handleOpenUpdateModal}
            onOpenOutstanding={handleOpenOutstanding}
            onOpenTCV={handleOpenTCV}
            onViewProject={handleViewProjectHealth}
            onEditProject={handleEditProjectFromDashboard}
            onDeleteProject={handleDeleteProject}
            onOpenGoogleSheetSync={handleOpenGoogleSheetSync}
            googleSheetCount={googleSheetColleges.length}
          />
        )}

        {/* Step 2: New Entry Page (College & Project details, auto-calc boxes) */}
        {currentView === "new-entry" && (
          <Step2_NewEntry
            draft={draft}
            onUpdateDraft={handleUpdateDraft}
            onReset={handleResetDraft}
            onSaveEntry={handleProceedToTrainingPhase}
            onBackToDashboard={() => navigateTo("dashboard")}
            googleSheetColleges={googleSheetColleges}
            onOpenGoogleSheetSync={handleOpenGoogleSheetSync}
            onSelectGoogleSheetCollege={handleSelectGoogleSheetCollegeForDraft}
          />
        )}

        {/* Step 3: Training Phase Entry Page (Phase & Timeline, Details, Payment Plan) */}
        {currentView === "training-phase" && (
          <Step3_TrainingPhase
            draft={draft}
            onUpdateDraft={handleUpdateDraft}
            onReset={() => setDraft(createEmptyDraft(activeProject || undefined))}
            onSubmit={handleSaveAndSubmitTrainingPhase}
            onBackToDashboard={() => navigateTo("new-entry")}
            allColleges={projects.map((p) => ({
              name: p.college_name,
              code: p.project_code,
              students: p.student_count,
            }))}
          />
        )}

        {/* Step 4: Health Report & Project Overview (Circular Donut Gauge & Financials) */}
        {currentView === "health-report" && (activeProject || projects[0]) && (
          <Step4_HealthReport
            project={(activeProject || projects[0])!}
            onEditDetails={(proj) => {
              setActiveProject(proj);
              setDraft(createEmptyDraft(proj));
              navigateTo("update-page", proj);
            }}
            onSaveToRegister={() => {
              showToast("Project saved to register!", "success");
              navigateTo("dashboard");
            }}
            onBackToDashboard={() => navigateTo("dashboard")}
          />
        )}

        {/* Step 5: Update College Project Details Screen */}
        {currentView === "update-page" && activeProject && (
          <Step5_UpdatePage
            project={activeProject}
            onSaveProject={handleSaveUpdatedProject}
            onBackToDashboard={() => navigateTo("dashboard")}
            onResetToOriginal={() => {
              showToast("Reset to saved values.", "info");
            }}
            googleSheetColleges={googleSheetColleges}
            onOpenGoogleSheetSync={handleOpenGoogleSheetSync}
          />
        )}

        {/* Step 6: Outstanding Invoices & Collection Tracking Screen */}
        {currentView === "outstanding" && (
          <Step6_OutstandingPage
            projects={projects}
            initialPeriod={outstandingPeriod}
            onBackToDashboard={() => navigateTo("dashboard")}
            onViewProject={handleViewProjectHealth}
            onEditProject={handleEditProjectFromDashboard}
            onOpenGoogleSheetSync={handleOpenGoogleSheetSync}
          />
        )}

        {/* Step 7: TCV (Total Contract Value) Explorer & MOUs 26-27 Analytics Screen */}
        {currentView === "tcv" && (
          <Step7_TCVPage
            mouItems={mouItems}
            onBackToDashboard={() => navigateTo("dashboard")}
            onRefreshData={handleRefreshTCVData}
            isSyncing={isLiveSyncing}
          />
        )}
      </main>

      {/* Step 5: Update Search Modal & Live Search Dropdown */}
      <Step5_UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        projects={projects}
        onSelectProject={handleSelectProjectToUpdate}
        onOpenGoogleSheetSync={handleOpenGoogleSheetSync}
        googleSheetColleges={googleSheetColleges}
      />

      {/* Google Spreadsheet Live Sync Modal */}
      <GoogleSheetSyncModal
        isOpen={isGoogleSheetModalOpen}
        onClose={() => setIsGoogleSheetModalOpen(false)}
        onImportColleges={handleImportCollegesFromSheet}
        cachedColleges={googleSheetColleges}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;