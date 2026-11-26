'use client';

import React, { useState } from 'react';
import { api } from '@/lib/client/api-client';
import { getTestDrives, fetchTestDrives } from '@/lib/client/stores/test-drive-store';
import { filterAssignableEmployees } from '@/lib/client/stores/employee-store';
import { buildInventoryBrands, buildInventoryModelsForBrand } from '@/lib/data/car-catalog';
import {
  getPipelineStages,
  savePipelineStages,
  fetchPipelineStages,
  resetPipelineStagesToDefault,
  canTransitionCustomPipeline,
  slugifyStageKey,
  STAGE_COLOR_PRESETS,
  PipelineStageConfig,
  PipelineStageField,
  StageFieldType,
} from '@/lib/client/stores/pipeline-store';
import { Lead, LeadStatus, Customer } from '@crm/shared-types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import {
  Plus,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Filter,
  Car,
  GripVertical,
  CheckCircle2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Edit3,
  X,
  MessageSquare,
  AlertCircle,
  User,
  SlidersHorizontal,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { WordFadeIn } from '@/components/ui/WordFadeIn';

export default function LeadsPage() {
  const [mounted, setMounted] = useState(false);
  const [stages, setStages] = useState<PipelineStageConfig[]>(() => getPipelineStages());
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Pipeline Builder / Customization states
  const [newStageName, setNewStageName] = useState('');
  const [newStageInsertIndex, setNewStageInsertIndex] = useState<number>(5);
  const [newStageColorIdx, setNewStageColorIdx] = useState<number>(7);
  const [expandedConfigStageKey, setExpandedConfigStageKey] = useState<string | null>(null);
  const [builderFieldDraft, setBuilderFieldDraft] = useState<{
    label: string;
    type: StageFieldType;
    optionsText: string;
    required: boolean;
  }>({ label: '', type: 'text', optionsText: '', required: false });
  const [pipelineConfigNotice, setPipelineConfigNotice] = useState<string | null>(null);

  // Inline custom field adder inside New/Edit Lead modal
  const [showInlineFieldAdder, setShowInlineFieldAdder] = useState(false);
  const [inlineFieldDraft, setInlineFieldDraft] = useState<{
    label: string;
    type: StageFieldType;
    optionsText: string;
    required: boolean;
  }>({ label: '', type: 'text', optionsText: '', required: false });

  const formatAptDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const formatAptType = (typeStr: string) => {
    if (!typeStr) return 'Showroom Appointment';
    const map: Record<string, string> = {
      showroom_visit: 'Showroom Consultation',
      test_drive: 'Test Drive Demo',
      document_pickup: 'Document Signing',
      delivery: 'Vehicle Delivery',
      service: 'Service Booking',
      other: 'Showroom Visit',
    };
    return map[typeStr] || typeStr.replace(/_/g, ' ');
  };

  // Drag and drop states
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{
    lead: Lead;
    fromStatus: string;
    toStatus: string;
    note: string;
  } | null>(null);

  React.useEffect(() => {
    setMounted(true);

    const syncFromActivities = (drivesList = getTestDrives()) => {
      api.reconcilePipelineFromActivities(drivesList);
      api.ensureCustomerLeads();
      setLeads([...api.getLeads()]);
      setCustomers([...api.getCustomers()]);
      setBranches([...api.getBranches()]);
      setVehicles([...api.getVehicles()]);
      setEmployees([...api.getEmployees()]);
      setAppointments([...api.getAppointments()]);
    };

    syncFromActivities();

    Promise.all([
      api.fetchCustomers(),
      api.fetchLeads(),
      api.fetchAppointments(),
      api.fetchBranches(),
      api.fetchVehicles(),
      api.fetchEmployees(),
      fetchTestDrives(),
      fetchPipelineStages(),
    ]).then(([remoteCusts, , remoteApts, remoteBranches, remoteVehicles, remoteEmployees, remoteDrives, remoteStages]) => {
      if (Array.isArray(remoteStages) && remoteStages.length > 0) setStages(remoteStages);
      if (Array.isArray(remoteEmployees)) setEmployees(remoteEmployees);
      if (Array.isArray(remoteVehicles)) setVehicles(remoteVehicles);
      if (Array.isArray(remoteApts)) setAppointments(remoteApts);
      if (Array.isArray(remoteBranches)) setBranches(remoteBranches);
      if (Array.isArray(remoteCusts) && remoteCusts.length > 0) setCustomers(remoteCusts);
      api.ensureCustomerLeads();
      syncFromActivities(Array.isArray(remoteDrives) ? remoteDrives : getTestDrives());
      setLeads([...api.getLeads()]);
      setCustomers([...api.getCustomers()]);
    });

    const handleDataChanged = () => {
      setLeads([...api.getLeads()]);
      setCustomers([...api.getCustomers()]);
      setBranches([...api.getBranches()]);
      setVehicles([...api.getVehicles()]);
      setEmployees([...api.getEmployees()]);
      setAppointments([...api.getAppointments()]);
    };
    const handleTestDrivesChanged = () => {
      syncFromActivities(getTestDrives());
    };
    const handlePipelineChanged = () => {
      setStages([...getPipelineStages()]);
    };
    window.addEventListener('crm-data-changed', handleDataChanged);
    window.addEventListener('crm-testdrives-changed', handleTestDrivesChanged);
    window.addEventListener('crm-pipeline-stages-changed', handlePipelineChanged);
    return () => {
      window.removeEventListener('crm-data-changed', handleDataChanged);
      window.removeEventListener('crm-testdrives-changed', handleTestDrivesChanged);
      window.removeEventListener('crm-pipeline-stages-changed', handlePipelineChanged);
    };
  }, []);

  const emptyLeadForm = {
    customerId: '',
    branchId: '',
    source: '',
    preferredMake: '',
    preferredModel: '',
    preferredFuelType: '',
    budgetMin: '',
    budgetMax: '',
    notes: '',
    assignedTo: '',
    assignedToName: '',
  };

  // Form state & stage questionnaire
  const [formStage, setFormStage] = useState<string>('new');
  const [stageQuestions, setStageQuestions] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState(emptyLeadForm);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  const inventoryBrands = React.useMemo(() => buildInventoryBrands(vehicles), [vehicles]);
  const inventoryModelsForMake = React.useMemo(
    () => buildInventoryModelsForBrand(vehicles, formData.preferredMake),
    [vehicles, formData.preferredMake]
  );
  const assignableEmployees = React.useMemo(
    () => filterAssignableEmployees(employees),
    [employees]
  );

  const openStageModal = (stageKey: string) => {
    setEditingLeadId(null);
    setFormStage(stageKey);
    setStageQuestions({});
    setShowInlineFieldAdder(false);
    setInlineFieldDraft({ label: '', type: 'text', optionsText: '', required: false });
    setFormData(emptyLeadForm);
    setIsNewLeadModalOpen(true);
  };

  const handleStartEditLead = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setFormStage(lead.status);
    setFormData({
      customerId: lead.customerId || '',
      branchId: lead.branchId || '',
      source: lead.source || 'Walk-in Showroom',
      preferredMake: lead.preferredMake || '',
      preferredModel: lead.preferredModel || '',
      preferredFuelType: lead.preferredFuelType || '',
      budgetMin: lead.budgetMin ? String(lead.budgetMin) : '',
      budgetMax: lead.budgetMax ? String(lead.budgetMax) : '',
      notes: lead.notes || '',
      assignedTo: lead.assignedTo || '',
      assignedToName: lead.assigneeName || '',
    });
    const stageConfig = stages.find((s) => s.key === lead.status);
    const existingCustomFields: Record<string, string> =
      (lead as any).customFields && typeof (lead as any).customFields === 'object'
        ? (lead as any).customFields
        : {};
    const prefilled: Record<string, string> = {};
    if (stageConfig) {
      stageConfig.fields.forEach((f) => {
        const val = existingCustomFields[f.label] ?? existingCustomFields[f.id];
        if (val !== undefined && val !== null) {
          prefilled[f.id] = String(val);
        }
      });
    }
    setStageQuestions(prefilled);
    setShowInlineFieldAdder(false);
    setInlineFieldDraft({ label: '', type: 'text', optionsText: '', required: false });
    setSelectedLead(null);
    setIsNewLeadModalOpen(true);
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    const targetStageConfig = stages.find((s) => s.key === formStage) || stages[0];
    const targetFields = targetStageConfig?.fields || [];

    const customFieldValues: Record<string, string> = {};
    const qLines: string[] = [];
    targetFields.forEach((f) => {
      const val = stageQuestions[f.id];
      if (val && String(val).trim()) {
        const trimmed = String(val).trim();
        customFieldValues[f.label] = trimmed;
        qLines.push(`• ${f.label}: ${trimmed}`);
      }
    });
    const qSummary = qLines.join('\n');

    const rawNotes = formData.notes?.trim() || '';
    const existingLead = editingLeadId ? leads.find((l) => l.id === editingLeadId) : undefined;
    const prevCustomFields: Record<string, string> =
      existingLead && (existingLead as any).customFields && typeof (existingLead as any).customFields === 'object'
        ? (existingLead as any).customFields
        : {};
    const mergedCustomFields = { ...prevCustomFields, ...customFieldValues };

    const combinedNotes = editingLeadId
      ? (rawNotes || (qSummary ? `[${targetStageConfig.label} Stage Intake]:\n${qSummary}` : ''))
      : [
          rawNotes ? `Initial Requirements: ${rawNotes}` : null,
          qSummary ? `[${targetStageConfig.label} Stage Intake]:\n${qSummary}` : null,
        ]
          .filter(Boolean)
          .join('\n\n');

    if (editingLeadId) {
      api.updateLead(editingLeadId, {
        ...formData,
        budgetMin: formData.budgetMin ? Number(formData.budgetMin) : undefined,
        budgetMax: formData.budgetMax ? Number(formData.budgetMax) : undefined,
        status: formStage as LeadStatus,
        notes: combinedNotes || formData.notes,
        assignedTo: formData.assignedTo || undefined,
        assigneeName: formData.assignedToName || undefined,
        ...(Object.keys(mergedCustomFields).length > 0 ? { customFields: mergedCustomFields } : {}),
      } as any);
      setEditingLeadId(null);
    } else {
      const created = api.addLead({
        ...formData,
        status: formStage as LeadStatus,
        notes: combinedNotes,
        assignedTo: formData.assignedTo,
        assigneeName: formData.assignedToName,
        ...(Object.keys(mergedCustomFields).length > 0 ? { customFields: mergedCustomFields } : {}),
      } as any);
      setRecentlyMovedId(created.id);
      setTimeout(() => setRecentlyMovedId(null), 1500);
    }

    setLeads([...api.getLeads()]);
    setFormData(emptyLeadForm);
    setStageQuestions({});
    setShowInlineFieldAdder(false);
    setIsNewLeadModalOpen(false);
  };

  const commitStageTransition = (leadId: string, newStatus: string, remark?: string) => {
    setTransitionError(null);
    if (remark && remark.trim()) {
      const target = api.getLeads().find((l) => l.id === leadId);
      if (target) {
        const stageLabel = stages.find((s) => s.key === newStatus)?.label || newStatus;
        const appended = `[Moved to ${stageLabel}]: ${remark.trim()}`;
        api.updateLead(leadId, {
          notes: target.notes ? `${target.notes}\n${appended}` : appended,
        });
      }
    }
    api.updateLeadStatus(leadId, newStatus as LeadStatus);
    setLeads([...api.getLeads()]);
    setRecentlyMovedId(leadId);
    setTimeout(() => setRecentlyMovedId(null), 1400);
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, status: newStatus as LeadStatus });
    }
  };

  const handleStageTransition = (leadId: string, newStatus: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    if (lead.status === newStatus) return;

    const isAllowed = canTransitionCustomPipeline(stages, lead.status, newStatus);
    if (!isAllowed) {
      const fromLabel = stages.find((s) => s.key === lead.status)?.label || lead.status;
      const toLabel = stages.find((s) => s.key === newStatus)?.label || newStatus;
      setTransitionError(`Transition from '${fromLabel}' to '${toLabel}' is not allowed in sales pipeline.`);
      setTimeout(() => setTransitionError(null), 4500);
      return;
    }

    // Require explicit confirmation dialog when moving customer enquiry out of Contacted stage
    if (lead.status === 'contacted') {
      setPendingTransition({
        lead,
        fromStatus: lead.status,
        toStatus: newStatus,
        note: '',
      });
      return;
    }

    commitStageTransition(leadId, newStatus);
  };

  // Pipeline Customization Handlers
  const showPipelineNotice = (msg: string) => {
    setPipelineConfigNotice(msg);
    setTimeout(() => setPipelineConfigNotice(null), 3500);
  };

  const handleAddCustomStage = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newStageName.trim();
    if (!label) return;
    const key = slugifyStageKey(label, stages.map((s) => s.key));
    const preset = STAGE_COLOR_PRESETS[newStageColorIdx % STAGE_COLOR_PRESETS.length];
    const insertAt = Math.max(0, Math.min(stages.length, newStageInsertIndex));
    const newStage: PipelineStageConfig = {
      key,
      label,
      accent: preset.accent,
      lightBg: preset.lightBg,
      border: preset.border,
      badgeBg: preset.badgeBg,
      badgeText: preset.badgeText,
      glow: preset.glow,
      isCore: false,
      isCustom: true,
      stageTitle: `${label} Stage Intake`,
      stageSubtitle: `Custom pipeline step checkpoints & requirements for ${label}.`,
      fields: [],
    };
    const next = [...stages];
    next.splice(insertAt, 0, newStage);
    const saved = savePipelineStages(next);
    setStages(saved);
    setNewStageName('');
    setNewStageInsertIndex(Math.min(saved.length, insertAt + 1));
    setExpandedConfigStageKey(newStage.key);
    showPipelineNotice(`Added "${newStage.label}" at position #${insertAt + 1}. You can add custom fields below.`);
  };

  const handleMoveStage = (stageKey: string, direction: -1 | 1) => {
    const idx = stages.findIndex((s) => s.key === stageKey);
    if (idx < 0) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= stages.length) return;
    const next = [...stages];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    setStages(savePipelineStages(next));
  };

  const handleRenameStage = (stageKey: string, label: string, syncRemote = false) => {
    const next = stages.map((s) =>
      s.key === stageKey ? { ...s, label: syncRemote ? label.trim() || s.label : label } : s
    );
    setStages(savePipelineStages(next, { syncRemote }));
  };

  const handleChangeStageColor = (stageKey: string, presetIdx: number) => {
    const preset = STAGE_COLOR_PRESETS[presetIdx % STAGE_COLOR_PRESETS.length];
    const next = stages.map((s) =>
      s.key === stageKey
        ? {
            ...s,
            accent: preset.accent,
            lightBg: preset.lightBg,
            border: preset.border,
            badgeBg: preset.badgeBg,
            badgeText: preset.badgeText,
            glow: preset.glow,
          }
        : s
    );
    setStages(savePipelineStages(next));
  };

  const handleDeleteCustomStage = (stageKey: string) => {
    const stage = stages.find((s) => s.key === stageKey);
    if (!stage || stage.isCore) return;
    const activeCount = leads.filter((l) => l.status === stageKey).length;
    if (activeCount > 0) {
      showPipelineNotice(`Cannot delete "${stage.label}": move its ${activeCount} active lead(s) to another stage first.`);
      return;
    }
    const next = stages.filter((s) => s.key !== stageKey);
    setStages(savePipelineStages(next));
    if (expandedConfigStageKey === stageKey) setExpandedConfigStageKey(null);
    showPipelineNotice(`Removed custom stage "${stage.label}".`);
  };

  const handleAddFieldToStage = (
    stageKey: string,
    draft: { label: string; type: StageFieldType; optionsText: string; required: boolean },
    onSuccess?: () => void
  ) => {
    const cleanLabel = draft.label.trim();
    if (!cleanLabel) return;
    const idBase = cleanLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
    const fieldId = `cf_${idBase}_${Date.now().toString(36)}`;
    const parsedOptions =
      draft.type === 'select'
        ? draft.optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;
    const newField: PipelineStageField = {
      id: fieldId,
      label: cleanLabel,
      type: draft.type,
      placeholder: `Enter ${cleanLabel.toLowerCase()}...`,
      ...(draft.type === 'select'
        ? { options: parsedOptions && parsedOptions.length > 0 ? parsedOptions : ['Yes', 'No'] }
        : {}),
      required: draft.required,
      isCustom: true,
    };
    const next = stages.map((s) =>
      s.key === stageKey ? { ...s, fields: [...s.fields, newField] } : s
    );
    setStages(savePipelineStages(next));
    if (onSuccess) onSuccess();
    showPipelineNotice(`Added custom field "${cleanLabel}" to ${stages.find((s) => s.key === stageKey)?.label || stageKey}.`);
  };

  const handleRemoveFieldFromStage = (stageKey: string, fieldId: string) => {
    const next = stages.map((s) =>
      s.key === stageKey ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) } : s
    );
    setStages(savePipelineStages(next));
  };

  const handleResetPipeline = () => {
    const defaultKeys = new Set(['new', 'contacted', 'qualified', 'appointment_set', 'test_drive', 'negotiation', 'converted']);
    const hasCustomLeads = leads.some((l) => !defaultKeys.has(l.status));
    if (hasCustomLeads) {
      showPipelineNotice('Move leads out of custom stages before resetting to default pipeline.');
      return;
    }
    const defaults = resetPipelineStagesToDefault();
    setStages(defaults);
    setExpandedConfigStageKey(null);
    showPipelineNotice('Pipeline reset to default 7 dealership stages.');
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLeadId(leadId);
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stageKey) {
      setDragOverStage(stageKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stageKey: string) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverStage === stageKey) {
        setDragOverStage(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || draggedLeadId;
    if (leadId) {
      handleStageTransition(leadId, targetStage);
    }
    setDraggedLeadId(null);
    setDragOverStage(null);
  };


  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <WordFadeIn text="Lead Management & Pipeline" />
          </h1>
          <p className="page-desc">
            <WordFadeIn
              text="End-to-end sales pipeline tracking, AI scoring, branch allocations, and stage progression."
              baseDelay={0.22}
              staggerDelay={0.035}
            />
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setPipelineConfigNotice(null);
              const negIdx = stages.findIndex((s) => s.key === 'negotiation');
              setNewStageInsertIndex(negIdx >= 0 ? negIdx : stages.length);
              setIsCustomizeModalOpen(true);
            }}
            className="btn btn-secondary btn-sm"
            style={{
              borderRadius: '999px',
              padding: '0.45rem 1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontWeight: 600,
            }}
            title="Add custom stages between steps and configure custom stage fields"
          >
            <SlidersHorizontal size={15} /> Customize Pipeline
          </button>
          <button
            onClick={() => {
              setEditingLeadId(null);
              setFormData(emptyLeadForm);
              setStageQuestions({});
              setShowInlineFieldAdder(false);
              setFormStage(stages[0]?.key || 'new');
              setIsNewLeadModalOpen(true);
            }}
            className="btn btn-primary btn-sm"
            style={{
              borderRadius: '999px',
              padding: '0.45rem 1.15rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Plus size={16} /> New Lead
          </button>
        </div>
      </div>

      {/* Kanban Board View */}
      <div className="kanban-board-container">
          {stages.map((stage, stageIdx) => {
            const stageLeads = leads.filter((l) => l.status === stage.key);
            const isOver = dragOverStage === stage.key;
            const nextStage = stages[stageIdx + 1] || null;

            return (
              <div
                key={stage.key}
                className={`kanban-column ${isOver ? 'is-drag-over' : ''}`}
                style={{
                  ['--col-accent' as any]: stage.accent,
                  ['--col-light-bg' as any]: stage.lightBg,
                  ['--col-glow' as any]: stage.glow,
                }}
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDragLeave={(e) => handleDragLeave(e, stage.key)}
                onDrop={(e) => handleDrop(e, stage.key)}
              >
                {/* Column Header */}
                <div className="kanban-col-header">
                  <div className="kanban-col-title-wrap">
                    <span className="kanban-col-dot" style={{ backgroundColor: stage.accent }} />
                    <span className="kanban-col-title">{stage.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      className="kanban-col-badge"
                      suppressHydrationWarning
                      style={{
                        backgroundColor: stage.badgeBg,
                        color: stage.badgeText,
                      }}
                    >
                      {stageLeads.length}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openStageModal(stage.key);
                      }}
                      className="kanban-col-add-btn"
                      title={`Add lead in ${stage.label}`}
                      aria-label={`Add lead to ${stage.label}`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* Cards Body */}
                <div className="kanban-cards-body">
                  {stageLeads.map((lead) => {
                    const isDragging = draggedLeadId === lead.id;
                    const wasRecentlyMoved = recentlyMovedId === lead.id;
                    const leadApt = (lead as any).appointment || appointments.find(
                      (a) => (a.leadId && a.leadId === lead.id) || (lead.customerId && a.customerId === lead.customerId)
                    );

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={() => {
                          setDraggedLeadId(null);
                          setDragOverStage(null);
                        }}
                        onClick={() => setSelectedLead(lead)}
                        className={`kanban-lead-card ${isDragging ? 'is-dragging' : ''} ${wasRecentlyMoved ? 'just-dropped' : ''}`}
                        style={{
                          ['--card-accent' as any]: stage.accent,
                          ['--card-light-bg' as any]: stage.lightBg,
                          ['--card-border' as any]: stage.border,
                          ['--card-badge-bg' as any]: stage.badgeBg,
                        }}
                        title="Drag to advance stage, or click to open full details"
                      >
                        {/* Top: Customer name & Grip + Score */}
                        <div className="kanban-card-top">
                          <div className="kanban-card-title-group">
                            <GripVertical size={14} className="kanban-grip-icon" />
                            <span className="kanban-customer-name">{lead.customerName}</span>
                          </div>
                          <span
                            className="kanban-score-pill"
                            style={{
                              color: (lead.score || 0) >= 80 ? '#15803D' : stage.accent,
                              borderColor: (lead.score || 0) >= 80 ? 'rgba(22, 163, 74, 0.3)' : stage.border,
                            }}
                          >
                            <Sparkles size={11} style={{ color: (lead.score || 0) >= 80 ? '#16A34A' : stage.accent }} />
                            {lead.score}
                          </span>
                        </div>

                        {/* Vehicle Interest Pill */}
                        <div className="kanban-vehicle-tag">
                          <Car size={13} style={{ color: stage.accent, flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lead.preferredMake} {lead.preferredModel}
                          </span>
                          {lead.preferredFuelType && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                              · {lead.preferredFuelType}
                            </span>
                          )}
                        </div>

                        {/* Footer: Budget & Sales Exec */}
                        <div className="kanban-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span className="kanban-budget-label">
                            Budget: ₹{((lead.budgetMin || 0) / 100000).toFixed(0)}-{((lead.budgetMax || 0) / 100000).toFixed(0)}L
                          </span>
                          <span
                            className="kanban-assignee-pill"
                            title={`Assigned Consultant: ${lead.assigneeName || 'Unassigned'}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: lead.assigneeName && lead.assigneeName !== 'Unassigned Consultant' ? '#3730A3' : '#64748B',
                              backgroundColor: lead.assigneeName && lead.assigneeName !== 'Unassigned Consultant' ? '#EEF2FF' : '#F1F5F9',
                              border: lead.assigneeName && lead.assigneeName !== 'Unassigned Consultant' ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              maxWidth: '145px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            👤 {lead.assigneeName || 'Unassigned'}
                          </span>
                        </div>

                        {/* Saved Custom / Stage Intake Fields Preview */}
                        {(() => {
                          const cf = (lead as any).customFields;
                          if (!cf || typeof cf !== 'object') return null;
                          const entries = Object.entries(cf).filter(
                            ([, v]) => v !== undefined && v !== null && String(v).trim() !== ''
                          );
                          if (entries.length === 0) return null;
                          return (
                            <div
                              style={{
                                marginTop: '7px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px',
                              }}
                            >
                              {entries.slice(0, 3).map(([k, v]) => (
                                <span
                                  key={k}
                                  title={`${k}: ${String(v)}`}
                                  style={{
                                    fontSize: '0.66rem',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: '#F8FAFC',
                                    border: `1px solid ${stage.border}`,
                                    color: '#334155',
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <strong style={{ color: stage.badgeText }}>{k}:</strong> {String(v)}
                                </span>
                              ))}
                              {entries.length > 3 && (
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: stage.lightBg,
                                    color: stage.badgeText,
                                    fontWeight: 600,
                                  }}
                                >
                                  +{entries.length - 3} more
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Workflow Progression & Quick Action Options */}
                        <div
                          className="kanban-card-actions"
                          style={{
                            marginTop: '9px',
                            paddingTop: '8px',
                            borderTop: '1px dashed rgba(15, 23, 42, 0.09)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.status === 'new' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              {nextStage && nextStage.isCustom ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStageTransition(lead.id, nextStage.key)}
                                    style={{
                                      flex: 1,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                      padding: '5px 8px',
                                      borderRadius: '8px',
                                      backgroundColor: nextStage.lightBg,
                                      color: nextStage.badgeText,
                                      border: `1px solid ${nextStage.border}`,
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span>{nextStage.label} →</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStageTransition(lead.id, 'contacted')}
                                    style={{
                                      padding: '5px 7px',
                                      borderRadius: '8px',
                                      backgroundColor: '#EEF2FF',
                                      color: '#4338CA',
                                      border: '1px solid rgba(79, 70, 229, 0.3)',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Contacted
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, 'contacted')}
                                  style={{
                                    flex: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    backgroundColor: '#EEF2FF',
                                    color: '#4338CA',
                                    border: '1px solid rgba(79, 70, 229, 0.3)',
                                    fontSize: '0.73rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#4F46E5';
                                    e.currentTarget.style.color = '#FFFFFF';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#EEF2FF';
                                    e.currentTarget.style.color = '#4338CA';
                                  }}
                                  title="Customer has been contacted - advance to Contacted"
                                >
                                  <Phone size={11} />
                                  <span>Mark Contacted →</span>
                                </button>
                              )}
                              {((lead as any).customerPhone || lead.customer?.phone) && (
                                <a
                                  href={`tel:${(lead as any).customerPhone || lead.customer?.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title={`Call ${(lead as any).customerPhone || lead.customer?.phone}`}
                                  style={{
                                    padding: '5px 7px',
                                    borderRadius: '8px',
                                    backgroundColor: '#F8FAFC',
                                    color: '#475569',
                                    border: '1px solid #CBD5E1',
                                    fontSize: '0.72rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    textDecoration: 'none',
                                  }}
                                >
                                  <Phone size={11} />
                                </a>
                              )}
                            </div>
                          )}

                          {lead.status === 'contacted' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.67rem', color: '#64748B', fontWeight: 600 }}>
                                <span>Contacted Options:</span>
                                {((lead as any).customerPhone || lead.customer?.phone) && (
                                  <a
                                    href={`https://wa.me/${String((lead as any).customerPhone || lead.customer?.phone).replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ color: '#16A34A', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.67rem' }}
                                    title="Open WhatsApp chat"
                                  >
                                    <MessageSquare size={10} /> WhatsApp
                                  </a>
                                )}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, 'qualified')}
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: '#F5F3FF',
                                    color: '#6D28D9',
                                    border: '1px solid rgba(124, 58, 237, 0.25)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title="Requirement & budget qualified"
                                >
                                  <CheckCircle2 size={10} />
                                  <span>Qualify</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, 'appointment_set')}
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: '#FFFBEB',
                                    color: '#B45309',
                                    border: '1px solid rgba(217, 119, 6, 0.25)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title="Schedule showroom appointment"
                                >
                                  <Calendar size={10} />
                                  <span>Appt</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, 'test_drive')}
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: '#F0FDFA',
                                    color: '#0F766E',
                                    border: '1px solid rgba(13, 148, 136, 0.25)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title="Book test drive demo"
                                >
                                  <Car size={10} />
                                  <span>Drive</span>
                                </button>
                              </div>
                              {nextStage && nextStage.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, nextStage.key)}
                                  style={{
                                    padding: '4px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: nextStage.lightBg,
                                    color: nextStage.badgeText,
                                    border: `1px solid ${nextStage.border}`,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                  }}
                                >
                                  <span>Move to {nextStage.label} →</span>
                                </button>
                              )}
                            </div>
                          )}

                          {lead.status === 'qualified' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {nextStage && nextStage.isCustom ? (
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, nextStage.key)}
                                  style={{
                                    flex: 1,
                                    padding: '4px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: nextStage.lightBg,
                                    color: nextStage.badgeText,
                                    border: `1px solid ${nextStage.border}`,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {nextStage.label} →
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, 'appointment_set')}
                                  style={{
                                    flex: 1,
                                    padding: '4px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: '#FFFBEB',
                                    color: '#B45309',
                                    border: '1px solid rgba(217, 119, 6, 0.25)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <Calendar size={10} />
                                  <span>Set Appointment →</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStageTransition(lead.id, 'test_drive')}
                                style={{
                                  padding: '4px 7px',
                                  borderRadius: '6px',
                                  backgroundColor: '#F0FDFA',
                                  color: '#0F766E',
                                  border: '1px solid rgba(13, 148, 136, 0.25)',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Test Drive
                              </button>
                            </div>
                          )}

                          {lead.status === 'appointment_set' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {nextStage && nextStage.isCustom ? (
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, nextStage.key)}
                                  style={{
                                    flex: 1,
                                    padding: '4px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: nextStage.lightBg,
                                    color: nextStage.badgeText,
                                    border: `1px solid ${nextStage.border}`,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {nextStage.label} →
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, 'test_drive')}
                                  style={{
                                    flex: 1,
                                    padding: '4px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: '#F0FDFA',
                                    color: '#0F766E',
                                    border: '1px solid rgba(13, 148, 136, 0.25)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <Car size={10} />
                                  <span>Start Test Drive →</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStageTransition(lead.id, 'negotiation')}
                                style={{
                                  padding: '4px 7px',
                                  borderRadius: '6px',
                                  backgroundColor: '#FFF1F2',
                                  color: '#BE123C',
                                  border: '1px solid rgba(225, 29, 72, 0.25)',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Negotiate
                              </button>
                            </div>
                          )}

                          {lead.status === 'test_drive' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleStageTransition(lead.id, nextStage ? nextStage.key : 'negotiation')}
                                style={{
                                  flex: 1,
                                  padding: '4px 7px',
                                  borderRadius: '6px',
                                  backgroundColor: nextStage && nextStage.isCustom ? nextStage.lightBg : '#FFF1F2',
                                  color: nextStage && nextStage.isCustom ? nextStage.badgeText : '#BE123C',
                                  border: `1px solid ${nextStage && nextStage.isCustom ? nextStage.border : 'rgba(225, 29, 72, 0.25)'}`,
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '3px',
                                }}
                              >
                                <span>
                                  {nextStage && nextStage.key !== 'negotiation'
                                    ? `${nextStage.label} →`
                                    : 'Commercial Negotiation →'}
                                </span>
                              </button>
                              {nextStage && nextStage.key !== 'negotiation' && (
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, 'negotiation')}
                                  style={{
                                    padding: '4px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: '#FFF1F2',
                                    color: '#BE123C',
                                    border: '1px solid rgba(225, 29, 72, 0.25)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Negotiate
                                </button>
                              )}
                            </div>
                          )}

                          {lead.status === 'negotiation' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {nextStage && nextStage.key !== 'converted' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleStageTransition(lead.id, nextStage.key)}
                                    style={{
                                      flex: 1,
                                      padding: '4px 7px',
                                      borderRadius: '6px',
                                      backgroundColor: nextStage.lightBg,
                                      color: nextStage.badgeText,
                                      border: `1px solid ${nextStage.border}`,
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <span>{nextStage.label} →</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStageTransition(lead.id, 'converted')}
                                    style={{
                                      padding: '4px 7px',
                                      borderRadius: '6px',
                                      backgroundColor: '#F0FDF4',
                                      color: '#15803D',
                                      border: '1px solid rgba(22, 163, 74, 0.25)',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Win 🎉
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, 'converted')}
                                  style={{
                                    flex: 1,
                                    padding: '4px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: '#F0FDF4',
                                    color: '#15803D',
                                    border: '1px solid rgba(22, 163, 74, 0.25)',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <Sparkles size={10} />
                                  <span>Win & Convert Deal 🎉</span>
                                </button>
                              )}
                            </div>
                          )}

                          {lead.status === 'converted' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803D', fontSize: '0.7rem', fontWeight: 700, padding: '2px 0' }}>
                              <CheckCircle2 size={12} />
                              <span>Deal Converted / Won</span>
                            </div>
                          )}

                          {!['new', 'contacted', 'qualified', 'appointment_set', 'test_drive', 'negotiation', 'converted'].includes(lead.status) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {nextStage ? (
                                <button
                                  type="button"
                                  onClick={() => handleStageTransition(lead.id, nextStage.key)}
                                  style={{
                                    flex: 1,
                                    padding: '4px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: nextStage.lightBg,
                                    color: nextStage.badgeText,
                                    border: `1px solid ${nextStage.border}`,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <span>Advance to {nextStage.label} →</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.68rem', color: stage.badgeText, fontWeight: 600 }}>
                                  Custom Stage Checkpoint
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Active Drop Slot Indicator when Dragging Over */}
                  {isOver && draggedLeadId && (
                    <div className="kanban-drop-placeholder">
                      <ArrowRight size={14} />
                      <span>Drop to move to {stage.label}</span>
                    </div>
                  )}

                  {stageLeads.length === 0 && !isOver && (
                    <div className="kanban-empty-col">
                      <span>No leads in stage</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Drag leads here</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      {/* New Lead Modal with Pipeline Questionnaire */}
      {(() => {
        const currentStageConfig = stages.find((s) => s.key === formStage) || stages[0];
        const stageIndex = Math.max(0, stages.findIndex((s) => s.key === formStage));

        return (
          <Modal
            isOpen={isNewLeadModalOpen}
            onClose={() => {
              setIsNewLeadModalOpen(false);
              setEditingLeadId(null);
              setShowInlineFieldAdder(false);
            }}
            maxWidth="840px"
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.02em' }}>
                  {editingLeadId ? 'Edit Lead Details' : (currentStageConfig?.stageTitle || `${currentStageConfig.label} Lead`)}
                </span>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '3px 11px',
                    borderRadius: '999px',
                    backgroundColor: currentStageConfig.badgeBg,
                    color: currentStageConfig.badgeText,
                    border: `1.5px solid ${currentStageConfig.border}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: currentStageConfig.accent }} />
                  Stage: {currentStageConfig.label}
                </span>
              </div>
            }
            footer={
              <div className="unique-modal-footer-bar">
                <button
                  type="button"
                  className="unique-btn-cancel"
                  onClick={() => {
                    setIsNewLeadModalOpen(false);
                    setEditingLeadId(null);
                    setShowInlineFieldAdder(false);
                  }}
                >
                  <ChevronLeft size={16} />
                  <span>Cancel</span>
                </button>

                <div className="unique-stage-counter-pill">
                  <span className="step-num">{stageIndex + 1} / {stages.length}</span>
                  <span className="step-dot" style={{ backgroundColor: currentStageConfig.accent }} />
                  <span className="step-label" style={{ color: currentStageConfig.accent }}>
                    {currentStageConfig.label}
                  </span>
                </div>

                <button
                  type="submit"
                  form="new-lead-form"
                  className="unique-lead-submit-btn"
                  style={{
                    ['--btn-accent' as any]: currentStageConfig.accent,
                    ['--btn-glow' as any]: currentStageConfig.glow,
                  }}
                >
                  <span className="btn-text">
                    {editingLeadId ? 'Save Lead Changes' : `Create Lead in ${currentStageConfig.label}`}
                  </span>
                  <ArrowRight size={15} className="btn-arrow-icon" />
                </button>
              </div>
            }
          >
            <form id="new-lead-form" onSubmit={handleCreateLead} className="inspo-form-wrapper">
              {/* Target Pipeline Stage Gate Selector */}
              <div className="target-stage-selector-wrap">
                <div className="target-stage-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span>Target Pipeline Stage</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'none', fontWeight: 500 }}>
                      Select stage to load intake & custom fields
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewLeadModalOpen(false);
                        setShowInlineFieldAdder(false);
                        setPipelineConfigNotice(null);
                        const negIdx = stages.findIndex((st) => st.key === 'negotiation');
                        setNewStageInsertIndex(negIdx >= 0 ? negIdx : stages.length);
                        setIsCustomizeModalOpen(true);
                      }}
                      style={{
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#334155',
                        borderRadius: '999px',
                        padding: '2px 9px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textTransform: 'none',
                      }}
                    >
                      <SlidersHorizontal size={11} /> Customize Stages
                    </button>
                  </div>
                </div>
                <div className="target-stage-pills">
                  {stages.map((s) => {
                    const isActive = formStage === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          setFormStage(s.key);
                          setShowInlineFieldAdder(false);
                          if (editingLeadId) {
                            const editingLead = leads.find((l) => l.id === editingLeadId);
                            const savedCf = editingLead && (editingLead as any).customFields;
                            if (savedCf && typeof savedCf === 'object') {
                              const nextVals: Record<string, string> = { ...stageQuestions };
                              s.fields.forEach((f) => {
                                const val = savedCf[f.label] ?? savedCf[f.id];
                                if (val !== undefined && val !== null && nextVals[f.id] === undefined) {
                                  nextVals[f.id] = String(val);
                                }
                              });
                              setStageQuestions(nextVals);
                            }
                          }
                        }}
                        className={`target-stage-pill ${isActive ? 'is-active' : ''}`}
                        style={{
                          ['--pill-accent' as any]: s.accent,
                          ['--pill-glow' as any]: s.glow,
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Profile & Branch Destination */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">
                    Customer Profile <span className="req-star">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Customer Profile --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Branch Destination</label>
                  <select
                    className="form-select"
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  >
                    <option value="">-- Select Branch Destination --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preferred Make, Model, Fuel Type */}
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">
                    Preferred Make <span className="req-star">*</span>
                  </label>
                  {inventoryBrands.length > 0 ? (
                    <select
                      className="form-select"
                      value={formData.preferredMake}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          preferredMake: e.target.value,
                          preferredModel: '',
                        })
                      }
                      required
                    >
                      <option value="">-- Select Inventory Brand --</option>
                      {inventoryBrands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                      {formData.preferredMake && !inventoryBrands.includes(formData.preferredMake) && (
                        <option value={formData.preferredMake}>{formData.preferredMake}</option>
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      value={formData.preferredMake}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          preferredMake: e.target.value,
                          preferredModel: '',
                        })
                      }
                      placeholder="Enter make (no vehicles in inventory)"
                      required
                    />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Preferred Model <span className="req-star">*</span>
                  </label>
                  {inventoryModelsForMake.length > 0 ? (
                    <select
                      className="form-select"
                      value={formData.preferredModel}
                      onChange={(e) => setFormData({ ...formData, preferredModel: e.target.value })}
                      required
                    >
                      <option value="">-- Select Inventory Model --</option>
                      {inventoryModelsForMake.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                      {formData.preferredModel &&
                        !inventoryModelsForMake.includes(formData.preferredModel) && (
                          <option value={formData.preferredModel}>{formData.preferredModel}</option>
                        )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      value={formData.preferredModel}
                      onChange={(e) => setFormData({ ...formData, preferredModel: e.target.value })}
                      placeholder={formData.preferredMake ? 'Enter preferred model' : 'Select brand first'}
                      required
                    />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Fuel Type</label>
                  <select
                    className="form-select"
                    value={formData.preferredFuelType}
                    onChange={(e) => setFormData({ ...formData, preferredFuelType: e.target.value })}
                  >
                    <option value="">-- Select Fuel Type --</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Electric">Electric</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              {/* Budget Range */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Budget Min (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.budgetMin}
                    onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                    placeholder="Enter minimum budget (₹)"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Budget Max (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.budgetMax}
                    onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                    placeholder="Enter maximum budget (₹)"
                  />
                </div>
              </div>

              {/* Assigned Consultant & Source */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} style={{ color: '#4F46E5' }} />
                    Assigned Showroom Consultant
                  </label>
                  <select
                    className="form-select"
                    value={formData.assignedTo}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const emp = assignableEmployees.find((em) => em.id === empId);
                      setFormData({
                        ...formData,
                        assignedTo: empId,
                        assignedToName: emp ? `${emp.full_name} (${(emp.role || 'Staff').replace(/_/g, ' ')})` : '',
                      });
                    }}
                  >
                    <option value="">Unassigned (Select Consultant)</option>
                    {assignableEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        👤 {emp.full_name} — {(emp.role || 'Sales').replace(/_/g, ' ')} ({emp.department || 'Sales Desk'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Inbound Source Channel</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    placeholder="e.g. Showroom Walk-in, Direct Inbound"
                  />
                </div>
              </div>

              {/* Pipeline Stage Intake & Custom Fields Container */}
              <div
                className="stage-intake-box"
                style={{
                  ['--box-accent' as any]: currentStageConfig.accent,
                  ['--box-bg' as any]: currentStageConfig.lightBg,
                  ['--box-border' as any]: currentStageConfig.border,
                }}
              >
                <div
                  className="stage-intake-header"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={17} style={{ color: currentStageConfig.accent }} />
                    <span>{currentStageConfig.stageTitle || `${currentStageConfig.label} Stage Intake & Custom Fields`}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInlineFieldAdder((v) => !v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      border: `1px solid ${currentStageConfig.border}`,
                      backgroundColor: '#FFFFFF',
                      color: currentStageConfig.badgeText,
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={12} />
                    <span>{showInlineFieldAdder ? 'Cancel' : 'Add Custom Field'}</span>
                  </button>
                </div>
                <div className="stage-intake-desc">
                  {currentStageConfig.stageSubtitle || `Capture stage-specific requirements and custom fields for ${currentStageConfig.label}.`}
                </div>

                {showInlineFieldAdder && (
                  <div
                    style={{
                      marginBottom: '12px',
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: '#FFFFFF',
                      border: `1.5px dashed ${currentStageConfig.accent}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0F172A' }}>
                      Add New Custom Field to &ldquo;{currentStageConfig.label}&rdquo;
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={inlineFieldDraft.label}
                        onChange={(e) => setInlineFieldDraft({ ...inlineFieldDraft, label: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddFieldToStage(currentStageConfig.key, inlineFieldDraft, () => {
                              setInlineFieldDraft({ label: '', type: 'text', optionsText: '', required: false });
                              setShowInlineFieldAdder(false);
                            });
                          }
                        }}
                        placeholder="Field label (e.g. Discount Approved, Bank Name, CIBIL Score)"
                      />
                      <select
                        className="form-select"
                        value={inlineFieldDraft.type}
                        onChange={(e) =>
                          setInlineFieldDraft({ ...inlineFieldDraft, type: e.target.value as StageFieldType })
                        }
                      >
                        <option value="text">Text Input</option>
                        <option value="number">Number</option>
                        <option value="select">Dropdown Options</option>
                        <option value="textarea">Long Notes</option>
                      </select>
                    </div>
                    {inlineFieldDraft.type === 'select' && (
                      <input
                        type="text"
                        className="form-input"
                        value={inlineFieldDraft.optionsText}
                        onChange={(e) =>
                          setInlineFieldDraft({ ...inlineFieldDraft, optionsText: e.target.value })
                        }
                        placeholder="Comma-separated dropdown options (e.g. Yes, No, Pending)"
                      />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#475569', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={inlineFieldDraft.required}
                          onChange={(e) =>
                            setInlineFieldDraft({ ...inlineFieldDraft, required: e.target.checked })
                          }
                        />
                        <span>Required field</span>
                      </label>
                      <button
                        type="button"
                        disabled={!inlineFieldDraft.label.trim()}
                        onClick={() =>
                          handleAddFieldToStage(currentStageConfig.key, inlineFieldDraft, () => {
                            setInlineFieldDraft({ label: '', type: 'text', optionsText: '', required: false });
                            setShowInlineFieldAdder(false);
                          })
                        }
                        className="btn btn-primary btn-sm"
                        style={{ borderRadius: '8px', padding: '5px 12px', fontSize: '0.76rem' }}
                      >
                        Save Field
                      </button>
                    </div>
                  </div>
                )}

                {(!currentStageConfig.fields || currentStageConfig.fields.length === 0) ? (
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px dashed ${currentStageConfig.border}`,
                      backgroundColor: 'rgba(255,255,255,0.7)',
                      fontSize: '0.78rem',
                      color: '#64748B',
                      textAlign: 'center',
                    }}
                  >
                    No custom fields configured for &ldquo;{currentStageConfig.label}&rdquo; yet. Click &ldquo;Add Custom Field&rdquo; above to add one.
                  </div>
                ) : (
                  <div className="stage-intake-grid">
                    {currentStageConfig.fields.map((q) => (
                      <div
                        key={q.id}
                        className={`form-group ${q.type === 'textarea' ? 'full-span' : ''}`}
                      >
                        <label
                          className="form-label"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}
                        >
                          <span>
                            {q.label} {q.required && <span className="req-star">*</span>}
                          </span>
                          {q.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFieldFromStage(currentStageConfig.key, q.id)}
                              title={`Remove "${q.label}" field from ${currentStageConfig.label}`}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94A3B8',
                                padding: '0 2px',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </label>
                        {q.type === 'select' ? (
                          <select
                            className="form-select"
                            value={stageQuestions[q.id] || ''}
                            onChange={(e) => setStageQuestions({ ...stageQuestions, [q.id]: e.target.value })}
                            required={q.required}
                          >
                            <option value="">-- Select {q.label} --</option>
                            {q.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : q.type === 'textarea' ? (
                          <textarea
                            className="form-textarea"
                            rows={2}
                            value={stageQuestions[q.id] || ''}
                            onChange={(e) => setStageQuestions({ ...stageQuestions, [q.id]: e.target.value })}
                            placeholder={q.placeholder}
                            required={q.required}
                          />
                        ) : (
                          <input
                            type={q.type}
                            className="form-input"
                            value={stageQuestions[q.id] || ''}
                            onChange={(e) => setStageQuestions({ ...stageQuestions, [q.id]: e.target.value })}
                            placeholder={q.placeholder}
                            required={q.required}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Initial Notes & Requirements */}
              <div className="form-group">
                <label className="form-label">Initial Notes & Requirements</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Customer is considering top variant, requires auto transmission..."
                />
                <div className="form-helper">
                  Optional notes captured during initial consultation or intake.
                </div>
              </div>

              {/* Privacy & Compliance Notice */}
              <div className="inspo-footer-compliance" style={{ margin: '8px 0 0 0' }}>
                <ShieldCheck size={14} style={{ color: '#16A34A' }} />
                <span>© 2026 Dealership CRM · All data is encrypted per our Enterprise Security Policy</span>
              </div>
            </form>
          </Modal>
        );
      })()}

      {/* Lead Detail & Stage Transition Drawer/Modal */}
      {selectedLead && (
        <Modal
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          title={`Lead: ${selectedLead.customerName}`}
          headerActions={
            <div className="modal-header-actions">
              <button
                type="button"
                className="modal-header-btn-edit"
                onClick={() => handleStartEditLead(selectedLead)}
                title="Edit lead details"
              >
                <Edit3 size={14} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                className="modal-header-btn-close"
                onClick={() => setSelectedLead(null)}
                title="Close lead details"
              >
                <X size={14} />
                <span>Close</span>
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Quick Contact & Communication Bar */}
            {((selectedLead as any).customerPhone || selectedLead.customer?.phone) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0F172A' }}>
                    Phone: {(selectedLead as any).customerPhone || selectedLead.customer?.phone}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a
                    href={`tel:${(selectedLead as any).customerPhone || selectedLead.customer?.phone}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <Phone size={12} /> Call Customer
                  </a>
                  <a
                    href={`https://wa.me/${String((selectedLead as any).customerPhone || selectedLead.customer?.phone).replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#F0FDF4',
                      color: '#15803D',
                      border: '1px solid #BBF7D0',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <MessageSquare size={12} /> WhatsApp
                  </a>
                </div>
              </div>
            )}

            {/* Stage Progress Bar */}
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>
                Current Stage Transition
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {stages.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => handleStageTransition(selectedLead.id, s.key)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: selectedLead.status === s.key ? s.accent : s.lightBg,
                      color: selectedLead.status === s.key ? '#FFFFFF' : s.badgeText,
                      border: '1px solid',
                      borderColor: selectedLead.status === s.key ? s.accent : s.border,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Requirement:</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.preferredMake} {selectedLead.preferredModel} ({selectedLead.preferredFuelType})</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Budget:</span>
                <div style={{ fontWeight: 600 }}>₹{(selectedLead.budgetMin! / 100000).toFixed(1)}L - ₹{(selectedLead.budgetMax! / 100000).toFixed(1)}L</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Assigned Sales Exec:</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.assigneeName || 'Unassigned Consultant'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Lead Source:</span>
                <div style={{ fontWeight: 600 }}>{selectedLead.source}</div>
              </div>
            </div>

            {/* Saved Stage & Custom Fields */}
            {(() => {
              const cf = (selectedLead as any).customFields;
              if (!cf || typeof cf !== 'object') return null;
              const entries = Object.entries(cf).filter(
                ([, v]) => v !== undefined && v !== null && String(v).trim() !== ''
              );
              if (entries.length === 0) return null;
              const activeStageCfg = stages.find((s) => s.key === selectedLead.status);
              return (
                <div
                  style={{
                    backgroundColor: activeStageCfg?.lightBg || '#F8FAFC',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${activeStageCfg?.border || 'var(--color-border)'}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: activeStageCfg?.badgeText || '#334155',
                      marginBottom: '0.55rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Sparkles size={13} style={{ color: activeStageCfg?.accent || '#4F46E5' }} />
                    <span>Stage &amp; Custom Fields</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1rem' }}>
                    {entries.map(([key, val]) => (
                      <div key={key}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block' }}>
                          {key}
                        </span>
                        <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#0F172A', whiteSpace: 'pre-wrap' }}>
                          {String(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Notes */}
            {selectedLead.notes && (
              <div style={{ backgroundColor: '#F8FAFC', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Sales Notes:</span>
                <div style={{ fontSize: '0.8125rem', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>{selectedLead.notes}</div>
              </div>
            )}

            {/* Scheduled Showroom Appointment Full Details */}
            {(() => {
              const activeAppointment = (selectedLead as any).appointment || appointments.find(
                (a) => (a.leadId && a.leadId === selectedLead.id) || (selectedLead.customerId && a.customerId === selectedLead.customerId)
              );
              if (!activeAppointment) return null;

              return (
                <div
                  style={{
                    backgroundColor: '#FFFBEB',
                    borderRadius: '10px',
                    border: '1.5px solid #FDE047',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={16} style={{ color: '#D97706' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#92400E' }}>
                        Scheduled Showroom Appointment Details
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: (activeAppointment.status === 'confirmed' || activeAppointment.status === 'completed') ? '#DCFCE7' : '#FEF3C7',
                        color: (activeAppointment.status === 'confirmed' || activeAppointment.status === 'completed') ? '#15803D' : '#B45309',
                      }}
                    >
                      {activeAppointment.status || 'Confirmed'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', marginTop: '2px' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#78350F', display: 'block' }}>Date & Time:</span>
                      <strong style={{ color: '#1E293B' }}>{formatAptDate(activeAppointment.scheduled_at || activeAppointment.scheduledAt)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#78350F', display: 'block' }}>Duration:</span>
                      <strong style={{ color: '#1E293B' }}>{activeAppointment.duration_minutes || activeAppointment.durationMinutes || 45} Minutes</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#78350F', display: 'block' }}>Format / Type:</span>
                      <strong style={{ color: '#1E293B' }}>{formatAptType(activeAppointment.appointment_type || activeAppointment.appointmentType)}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#78350F', display: 'block' }}>Demo Vehicle:</span>
                      <strong style={{ color: '#1E293B' }}>{activeAppointment.vehicle_name || activeAppointment.vehicleName || `${selectedLead.preferredMake} ${selectedLead.preferredModel}`}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.72rem', color: '#78350F', display: 'block' }}>Assigned Host / Showroom Consultant:</span>
                      <strong style={{ color: '#4338CA' }}>👤 {activeAppointment.assignee_name || activeAppointment.assignedToName || selectedLead.assigneeName || 'Assigned Consultant'}</strong>
                    </div>
                  </div>

                  {activeAppointment.notes && (
                    <div
                      style={{
                        marginTop: '4px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#FFFFFF',
                        border: '1px dashed #FCD34D',
                        fontSize: '0.78rem',
                        color: '#78350F',
                        lineHeight: 1.45,
                      }}
                    >
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px' }}>Appointment Notes & Instructions:</span>
                      {activeAppointment.notes}
                    </div>
                  )}
                </div>
              );
            })()}


          </div>
        </Modal>
      )}

      {/* State Transition Error Toast */}
      {transitionError && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: '#FEF2F2',
            border: '1.5px solid #FECACA',
            color: '#991B1B',
            borderRadius: '12px',
            padding: '12px 18px',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.86rem',
            fontWeight: 600,
          }}
        >
          <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0 }} />
          <span>{transitionError}</span>
          <button
            type="button"
            onClick={() => setTransitionError(null)}
            style={{
              marginLeft: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#991B1B',
              padding: '2px',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}
      {/* Stage Transition Confirmation Dialog (Contacted -> Next Stage) */}
      <Modal
        isOpen={!!pendingTransition}
        onClose={() => setPendingTransition(null)}
        title="Confirm Stage Progression"
        maxWidth="460px"
      >
        {pendingTransition && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                Customer Enquiry
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                {pendingTransition.lead.customerName || 'Customer'}
              </div>
              {(pendingTransition.lead.preferredMake || pendingTransition.lead.preferredModel) && (
                <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '2px' }}>
                  {pendingTransition.lead.preferredMake} {pendingTransition.lead.preferredModel}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#EEF2FF',
                border: '1px solid #C7D2FE',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.86rem', color: '#4338CA' }}>
                {stages.find((s) => s.key === pendingTransition.fromStatus)?.label || pendingTransition.fromStatus}
              </span>
              <ArrowRight size={16} style={{ color: '#6366F1' }} />
              <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0F172A' }}>
                {stages.find((s) => s.key === pendingTransition.toStatus)?.label || pendingTransition.toStatus}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to move this customer enquiry from{' '}
              <strong>
                {stages.find((s) => s.key === pendingTransition.fromStatus)?.label || pendingTransition.fromStatus}
              </strong>{' '}
              to{' '}
              <strong>
                {stages.find((s) => s.key === pendingTransition.toStatus)?.label || pendingTransition.toStatus}
              </strong>
              ?
            </p>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>
                Call / Follow-up Remark (Optional)
              </label>
              <textarea
                className="form-textarea"
                rows={2}
                value={pendingTransition.note}
                onChange={(e) =>
                  setPendingTransition((prev) => (prev ? { ...prev, note: e.target.value } : null))
                }
                placeholder="e.g. Customer confirmed interest, moving forward..."
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '12px',
                borderTop: '1px solid #E2E8F0',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPendingTransition(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const { lead, toStatus, note } = pendingTransition;
                  setPendingTransition(null);
                  commitStageTransition(lead.id, toStatus, note);
                }}
              >
                <CheckCircle2 size={15} style={{ marginRight: '6px' }} />
                Confirm Move
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Customize Pipeline Stages & Custom Fields Modal */}
      <Modal
        isOpen={isCustomizeModalOpen}
        onClose={() => {
          setIsCustomizeModalOpen(false);
          setExpandedConfigStageKey(null);
        }}
        maxWidth="820px"
        title={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>
              Customize Sales Pipeline &amp; Custom Fields
            </span>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
              Insert custom stages anywhere (e.g. before or after Negotiation), reorder steps, and add custom fields to any stage.
            </span>
          </div>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <button
              type="button"
              onClick={handleResetPipeline}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
            >
              <RotateCcw size={13} /> Reset to Default
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCustomizeModalOpen(false);
                setExpandedConfigStageKey(null);
              }}
              className="btn btn-primary btn-sm"
              style={{ borderRadius: '8px', padding: '0.45rem 1.2rem' }}
            >
              Done
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {pipelineConfigNotice && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1E40AF',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span>{pipelineConfigNotice}</span>
              <button
                type="button"
                onClick={() => setPipelineConfigNotice(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E40AF' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Insert New Custom Stage Builder */}
          <form
            onSubmit={handleAddCustomStage}
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={15} style={{ color: '#4F46E5' }} />
              <span>Insert New Pipeline Stage</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr', gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.76rem' }}>
                  Stage Name <span className="req-star">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="e.g. Loan Approval, Insurance & RTO, PDI Check"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.76rem' }}>
                  Insert Position in Pipeline
                </label>
                <select
                  className="form-select"
                  value={newStageInsertIndex}
                  onChange={(e) => setNewStageInsertIndex(Number(e.target.value))}
                >
                  <option value={0}>At Beginning (Before &ldquo;{stages[0]?.label || 'First'}&rdquo;)</option>
                  {stages.map((st, idx) => (
                    <option key={st.key} value={idx + 1}>
                      After &ldquo;{st.label}&rdquo;
                      {stages[idx + 1] ? ` (Between ${st.label} & ${stages[idx + 1].label})` : ' (At End)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Badge Color:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {STAGE_COLOR_PRESETS.map((preset, idx) => {
                    const active = newStageColorIdx === idx;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setNewStageColorIdx(idx)}
                        title={preset.name}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: preset.accent,
                          border: active ? '2.5px solid #0F172A' : '2px solid #FFFFFF',
                          boxShadow: active ? '0 0 0 2px rgba(79, 70, 229, 0.35)' : '0 0 0 1px #CBD5E1',
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={!newStageName.trim()}
                className="btn btn-primary btn-sm"
                style={{
                  borderRadius: '8px',
                  padding: '0.45rem 1rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Plus size={14} /> Insert Stage
              </button>
            </div>
          </form>

          {/* Existing & Custom Stages List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                Active Pipeline Sequence ({stages.length} Stages)
              </span>
              <span style={{ fontSize: '0.73rem', color: '#64748B' }}>
                Click &ldquo;Fields&rdquo; on any stage to add or edit custom fields
              </span>
            </div>

            {stages.map((stage, idx) => {
              const isExpanded = expandedConfigStageKey === stage.key;
              const stageLeadCount = leads.filter((l) => l.status === stage.key).length;

              return (
                <div
                  key={stage.key}
                  style={{
                    borderRadius: '10px',
                    border: `1.5px solid ${isExpanded ? stage.accent : '#E2E8F0'}`,
                    backgroundColor: '#FFFFFF',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: stage.badgeText,
                        backgroundColor: stage.badgeBg,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        minWidth: '28px',
                        textAlign: 'center',
                      }}
                    >
                      #{idx + 1}
                    </span>

                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: stage.accent,
                        flexShrink: 0,
                      }}
                    />

                    <input
                      type="text"
                      className="form-input"
                      value={stage.label}
                      onChange={(e) => handleRenameStage(stage.key, e.target.value, false)}
                      onBlur={(e) => handleRenameStage(stage.key, e.target.value, true)}
                      style={{
                        flex: 1,
                        minWidth: '160px',
                        padding: '5px 10px',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                      }}
                      aria-label={`Stage ${idx + 1} name`}
                    />

                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '999px',
                        backgroundColor: stage.isCore ? '#F1F5F9' : '#ECFDF5',
                        color: stage.isCore ? '#475569' : '#047857',
                      }}
                    >
                      {stage.isCore ? 'Core' : 'Custom'} · {stageLeadCount}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleMoveStage(stage.key, -1)}
                        disabled={idx === 0}
                        title="Move left / earlier"
                        style={{
                          padding: '5px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#F8FAFC',
                          color: idx === 0 ? '#CBD5E1' : '#334155',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStage(stage.key, 1)}
                        disabled={idx === stages.length - 1}
                        title="Move right / later"
                        style={{
                          padding: '5px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#F8FAFC',
                          color: idx === stages.length - 1 ? '#CBD5E1' : '#334155',
                          cursor: idx === stages.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewStageInsertIndex(idx + 1);
                          showPipelineNotice(`Insert position set to immediately after "${stage.label}". Enter a stage name above.`);
                        }}
                        title={`Insert a custom stage right after "${stage.label}"`}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          color: '#4F46E5',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        + Below
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedConfigStageKey(isExpanded ? null : stage.key);
                          setBuilderFieldDraft({ label: '', type: 'text', optionsText: '', required: false });
                        }}
                        style={{
                          padding: '4px 9px',
                          borderRadius: '6px',
                          border: `1px solid ${isExpanded ? stage.accent : '#CBD5E1'}`,
                          backgroundColor: isExpanded ? stage.lightBg : '#FFFFFF',
                          color: isExpanded ? stage.badgeText : '#334155',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Fields ({stage.fields.length})
                      </button>
                      {!stage.isCore && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomStage(stage.key)}
                          title={`Delete custom stage "${stage.label}"`}
                          style={{
                            padding: '5px',
                            borderRadius: '6px',
                            border: '1px solid #FECACA',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Stage Color & Custom Fields Drawer */}
                  {isExpanded && (
                    <div
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        backgroundColor: stage.lightBg,
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                          Stage Color Theme
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {STAGE_COLOR_PRESETS.map((preset, pIdx) => {
                            const selected = stage.accent.toLowerCase() === preset.accent.toLowerCase();
                            return (
                              <button
                                key={preset.name}
                                type="button"
                                onClick={() => handleChangeStageColor(stage.key, pIdx)}
                                title={preset.name}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  backgroundColor: preset.accent,
                                  border: selected ? '2px solid #0F172A' : '1.5px solid #FFFFFF',
                                  boxShadow: '0 0 0 1px rgba(15,23,42,0.18)',
                                  cursor: 'pointer',
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                          Custom &amp; Intake Fields in &ldquo;{stage.label}&rdquo; ({stage.fields.length})
                        </span>
                        {stage.fields.length === 0 ? (
                          <div style={{ fontSize: '0.76rem', color: '#64748B', fontStyle: 'italic' }}>
                            No fields on this stage yet. Add custom fields below.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {stage.fields.map((f) => (
                              <div
                                key={f.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E2E8F0',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0F172A' }}>
                                    {f.label}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '999px', backgroundColor: '#F1F5F9', color: '#475569' }}>
                                    {f.type}
                                  </span>
                                  {f.required && (
                                    <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '999px', backgroundColor: '#FEF2F2', color: '#B91C1C', fontWeight: 600 }}>
                                      Required
                                    </span>
                                  )}
                                  {f.type === 'select' && f.options && f.options.length > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                      [{f.options.join(', ')}]
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFieldFromStage(stage.key, f.id)}
                                  title={`Remove field "${f.label}"`}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#DC2626',
                                    padding: '2px',
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add Custom Field Form inside Stage */}
                      <div
                        style={{
                          padding: '10px',
                          borderRadius: '8px',
                          backgroundColor: '#FFFFFF',
                          border: `1px dashed ${stage.accent}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0F172A' }}>
                          Add Custom Field to &ldquo;{stage.label}&rdquo;
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={builderFieldDraft.label}
                            onChange={(e) => setBuilderFieldDraft({ ...builderFieldDraft, label: e.target.value })}
                            placeholder="Field name (e.g. Trade-In Valuation, Loan Bank)"
                          />
                          <select
                            className="form-select"
                            value={builderFieldDraft.type}
                            onChange={(e) =>
                              setBuilderFieldDraft({ ...builderFieldDraft, type: e.target.value as StageFieldType })
                            }
                          >
                            <option value="text">Text Input</option>
                            <option value="number">Number</option>
                            <option value="select">Dropdown Select</option>
                            <option value="textarea">Long Notes</option>
                          </select>
                        </div>
                        {builderFieldDraft.type === 'select' && (
                          <input
                            type="text"
                            className="form-input"
                            value={builderFieldDraft.optionsText}
                            onChange={(e) =>
                              setBuilderFieldDraft({ ...builderFieldDraft, optionsText: e.target.value })
                            }
                            placeholder="Comma-separated options (e.g. Approved, Pending, Rejected)"
                          />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={builderFieldDraft.required}
                              onChange={(e) =>
                                setBuilderFieldDraft({ ...builderFieldDraft, required: e.target.checked })
                              }
                            />
                            <span>Required field</span>
                          </label>
                          <button
                            type="button"
                            disabled={!builderFieldDraft.label.trim()}
                            onClick={() =>
                              handleAddFieldToStage(stage.key, builderFieldDraft, () =>
                                setBuilderFieldDraft({ label: '', type: 'text', optionsText: '', required: false })
                              )
                            }
                            className="btn btn-primary btn-sm"
                            style={{ borderRadius: '7px', padding: '4px 10px', fontSize: '0.74rem' }}
                          >
                            <Plus size={12} /> Add Field
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
