'use client';

import { validateLeadTransition } from '@crm/business-rules';
import type { LeadStatus } from '@crm/shared-types';
import { getActiveTenantId, getScopedKey } from '@/lib/client/tenant-context';

export type StageFieldType = 'text' | 'textarea' | 'select' | 'number';

export interface PipelineStageField {
  id: string;
  label: string;
  type: StageFieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  isCustom?: boolean;
}

export interface PipelineStageConfig {
  key: string;
  label: string;
  accent: string;
  lightBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  glow: string;
  isCore?: boolean;
  isCustom?: boolean;
  stageTitle?: string;
  stageSubtitle?: string;
  fields: PipelineStageField[];
}

export interface StageColorPreset {
  name: string;
  accent: string;
  lightBg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  glow: string;
}

export const STAGE_COLOR_PRESETS: StageColorPreset[] = [
  {
    name: 'Sky Blue',
    accent: '#0284C7',
    lightBg: '#F0F9FF',
    border: 'rgba(2, 132, 199, 0.25)',
    badgeBg: '#E0F2FE',
    badgeText: '#0369A1',
    glow: 'rgba(2, 132, 199, 0.16)',
  },
  {
    name: 'Indigo',
    accent: '#4F46E5',
    lightBg: '#EEF2FF',
    border: 'rgba(79, 70, 229, 0.25)',
    badgeBg: '#EEF2FF',
    badgeText: '#4338CA',
    glow: 'rgba(79, 70, 229, 0.16)',
  },
  {
    name: 'Violet',
    accent: '#7C3AED',
    lightBg: '#F5F3FF',
    border: 'rgba(124, 58, 237, 0.25)',
    badgeBg: '#F5F3FF',
    badgeText: '#6D28D9',
    glow: 'rgba(124, 58, 237, 0.16)',
  },
  {
    name: 'Amber',
    accent: '#D97706',
    lightBg: '#FFFBEB',
    border: 'rgba(217, 119, 6, 0.25)',
    badgeBg: '#FEF3C7',
    badgeText: '#B45309',
    glow: 'rgba(217, 119, 6, 0.16)',
  },
  {
    name: 'Teal',
    accent: '#0D9488',
    lightBg: '#F0FDFA',
    border: 'rgba(13, 148, 136, 0.25)',
    badgeBg: '#CCFBF1',
    badgeText: '#0F766E',
    glow: 'rgba(13, 148, 136, 0.16)',
  },
  {
    name: 'Rose',
    accent: '#E11D48',
    lightBg: '#FFF1F2',
    border: 'rgba(225, 29, 72, 0.25)',
    badgeBg: '#FFE4E6',
    badgeText: '#BE123C',
    glow: 'rgba(225, 29, 72, 0.16)',
  },
  {
    name: 'Emerald',
    accent: '#16A34A',
    lightBg: '#F0FDF4',
    border: 'rgba(22, 163, 74, 0.25)',
    badgeBg: '#DCFCE7',
    badgeText: '#15803D',
    glow: 'rgba(22, 163, 74, 0.16)',
  },
  {
    name: 'Cyan',
    accent: '#0891B2',
    lightBg: '#ECFEFF',
    border: 'rgba(8, 145, 178, 0.25)',
    badgeBg: '#CFFAFE',
    badgeText: '#0E7490',
    glow: 'rgba(8, 145, 178, 0.16)',
  },
  {
    name: 'Fuchsia',
    accent: '#C026D3',
    lightBg: '#FDF4FF',
    border: 'rgba(192, 38, 211, 0.25)',
    badgeBg: '#FAE8FF',
    badgeText: '#A21CAF',
    glow: 'rgba(192, 38, 211, 0.16)',
  },
  {
    name: 'Slate',
    accent: '#475569',
    lightBg: '#F8FAFC',
    border: 'rgba(71, 85, 105, 0.25)',
    badgeBg: '#E2E8F0',
    badgeText: '#334155',
    glow: 'rgba(71, 85, 105, 0.16)',
  },
];

export const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] = [
  {
    key: 'new',
    label: 'New Enquiries',
    ...STAGE_COLOR_PRESETS[0],
    isCore: true,
    stageTitle: 'New Enquiries Intake Checklist',
    stageSubtitle: 'Capture inbound enquiry details, purchase timeline, and customer question.',
    fields: [
      {
        id: 'timeline',
        label: 'Purchase Timeline & Urgency',
        type: 'select',
        options: [
          'Immediate (Within 7 days)',
          'Within 15-30 days',
          'Exploring / Next 2-3 months',
          'Future purchase planning',
        ],
      },
      {
        id: 'sourceChannel',
        label: 'Primary Inbound Source',
        type: 'select',
        options: [
          'Google Search Ads',
          'Walk-in Showroom',
          'Website Direct',
          'Cardekho / CarWale',
          'Referral',
          'Meta / Instagram',
        ],
      },
      {
        id: 'inquiryQuestion',
        label: 'Customer Initial Enquiry & Vehicle Requirement',
        type: 'textarea',
        placeholder: 'e.g. Enquiring about AX7L diesel AWD ready stock, delivery timeline, and warranty...',
        required: true,
      },
    ],
  },
  {
    key: 'contacted',
    label: 'Contacted',
    ...STAGE_COLOR_PRESETS[1],
    isCore: true,
    stageTitle: 'Contacted Stage Intake & Call Checklist',
    stageSubtitle: 'Log first contact outcome, customer disposition, and follow-up plan.',
    fields: [
      {
        id: 'contactMode',
        label: 'Communication Channel',
        type: 'select',
        options: [
          'Phone Call (Showroom Desk)',
          'WhatsApp Official Chat',
          'In-Person Showroom Visit',
          'Email Consultation',
        ],
      },
      {
        id: 'disposition',
        label: 'Customer Engagement Level',
        type: 'select',
        options: [
          'Highly Interested & Engaged',
          'Requested Detailed Quotation',
          'Wants Showroom Visit Demo',
          'Requested Callback Later',
          'Price Comparison Shopping',
        ],
      },
      {
        id: 'customerQuestion',
        label: 'Specific Questions Customer Raised on Call',
        type: 'textarea',
        placeholder: 'e.g. Customer asked about fuel efficiency in city traffic, exchange value for old car, and waiting period...',
        required: true,
      },
      {
        id: 'followupSlot',
        label: 'Next Scheduled Follow-up',
        type: 'text',
        placeholder: 'e.g. Tomorrow at 3:00 PM',
      },
    ],
  },
  {
    key: 'qualified',
    label: 'Qualified',
    ...STAGE_COLOR_PRESETS[2],
    isCore: true,
    stageTitle: 'Lead Qualification & Gate Check',
    stageSubtitle: 'Validate budget authority, trade-in exchange, and financing readiness.',
    fields: [
      {
        id: 'budgetReadiness',
        label: 'Budget & Financing Readiness',
        type: 'select',
        options: [
          'Pre-approved Bank Loan Sanctioned',
          'Self-Funded / Full Cash Payment',
          'Requires Dealership Loan Assistance',
          'Corporate Fleet Lease Eligibility',
        ],
      },
      {
        id: 'tradeIn',
        label: 'Used Car Exchange / Trade-in',
        type: 'select',
        options: [
          'No Exchange Required (Fresh Purchase)',
          'Has Old Car for Evaluation & Trade-in',
          'Exchange Value Critical for Deal',
        ],
      },
      {
        id: 'decisionMaker',
        label: 'Decision-Making Authority',
        type: 'select',
        options: [
          'Self / Sole Decision Maker',
          'Family Joint Decision (Spouse / Parents)',
          'Corporate Fleet Board Approval',
        ],
      },
      {
        id: 'qualificationNotes',
        label: 'Core Qualification Notes & Must-Have Features',
        type: 'textarea',
        placeholder: 'e.g. Customer budget confirmed up to ₹24 Lakhs. Requires 7-seater with ADAS safety features...',
        required: true,
      },
    ],
  },
  {
    key: 'appointment_set',
    label: 'Appointment Set',
    ...STAGE_COLOR_PRESETS[3],
    isCore: true,
    stageTitle: 'Showroom Appointment & Demo Booking',
    stageSubtitle: 'Reserve consultation slot, test vehicle, and assign host.',
    fields: [
      {
        id: 'appointmentSlot',
        label: 'Appointment Date & Slot',
        type: 'text',
        placeholder: 'e.g. Saturday 24th Oct, 11:30 AM',
        required: true,
      },
      {
        id: 'visitType',
        label: 'Appointment Format',
        type: 'select',
        options: [
          'Showroom Demo & Test Drive',
          'Family Walkaround & Feature Demo',
          'VIP Private Viewing Lounge',
          'Doorstep Home Consultation',
        ],
      },
      {
        id: 'assignedHost',
        label: 'Assigned Showroom Consultant',
        type: 'select',
        options: [
          'Assigned Sales Consultant',
          'Showroom Host',
          'Senior Relationship Manager',
        ],
      },
      {
        id: 'demoRequirements',
        label: 'Special Preparation & Features to Showcase',
        type: 'textarea',
        placeholder: 'e.g. Keep Midnight Black demo car clean and charged. Focus demonstration on rear seat comfort and ADAS...',
      },
    ],
  },
  {
    key: 'test_drive',
    label: 'Test Drive',
    ...STAGE_COLOR_PRESETS[4],
    isCore: true,
    stageTitle: 'Test Drive Scheduling & Route',
    stageSubtitle: 'Route assignment, driver license verification, and evaluation goals.',
    fields: [
      {
        id: 'testRoute',
        label: 'Test Drive Route Preference',
        type: 'select',
        options: [
          'Dealership Expressway Loop (12 km)',
          'City Traffic & Bumper-to-Bumper Route (5 km)',
          'Off-Road & Rough Road Suspension Test',
          'Home Doorstep Test Drive',
        ],
      },
      {
        id: 'licenseStatus',
        label: 'Driving License Status',
        type: 'select',
        options: [
          'Valid Driving License Verified',
          'Digital DL Verified via DigiLocker',
          'Will Present Physical License at Desk',
        ],
      },
      {
        id: 'drivingFocus',
        label: 'Vehicle Dynamics Customer Wants to Test',
        type: 'textarea',
        placeholder: 'e.g. Customer wants to evaluate automatic gearbox smoothness, cabin quietness (NVH), and high-speed braking...',
        required: true,
      },
    ],
  },
  {
    key: 'negotiation',
    label: 'Negotiation',
    ...STAGE_COLOR_PRESETS[5],
    isCore: true,
    stageTitle: 'Price & Offer Negotiation Intake',
    stageSubtitle: 'Record customer counter-offers, accessory bundles, and closing terms.',
    fields: [
      {
        id: 'targetPrice',
        label: 'Customer Expected On-Road Price (₹)',
        type: 'number',
        placeholder: 'e.g. 2420000',
        required: true,
      },
      {
        id: 'incentivesDiscussed',
        label: 'Deal Scheme / Incentive Proposed',
        type: 'select',
        options: [
          'Corporate Discount + Insurance Price Match',
          'Accessories Pack (₹35,000 value)',
          'Extended 5-Year Warranty Free',
          'Zero Depreciation Insurance Waiver',
          'Exchange Bonus Match',
        ],
      },
      {
        id: 'competitorModel',
        label: 'Alternative Vehicle Being Considered',
        type: 'text',
        placeholder: 'e.g. Tata Safari Adventure+, Hyundai Creta SX(O)',
      },
      {
        id: 'closingCondition',
        label: 'Deal Closing Condition / Action Needed',
        type: 'textarea',
        placeholder: 'e.g. Ready to book if ready delivery can be guaranteed before Diwali festival...',
      },
    ],
  },
  {
    key: 'converted',
    label: 'Converted',
    ...STAGE_COLOR_PRESETS[6],
    isCore: true,
    stageTitle: 'Converted Won Deal & Booking Receipt',
    stageSubtitle: 'Record token advance payment, allotted VIN, and delivery target.',
    fields: [
      {
        id: 'tokenAmount',
        label: 'Booking Token Advance Received (₹)',
        type: 'number',
        placeholder: 'e.g. 50000',
        required: true,
      },
      {
        id: 'paymentMode',
        label: 'Payment Method',
        type: 'select',
        options: [
          'UPI / QR Code Transfer',
          'Credit / Debit Card POS Swipe',
          'Direct Bank IMPS / RTGS',
          'Showroom Account Cheque',
        ],
      },
      {
        id: 'targetDeliveryDate',
        label: 'Target Handover / Delivery Date',
        type: 'text',
        placeholder: 'e.g. 2026-10-27',
      },
      {
        id: 'conversionChecklist',
        label: 'KYC & Booking Compliance Notes',
        type: 'textarea',
        placeholder: 'e.g. Form 20 signed. Token receipt #RCP-9042 issued. Loan sanction letter attached...',
      },
    ],
  },
];

const CORE_STAGE_KEYS = new Set(['new', 'assigned', 'contacted', 'qualified', 'appointment_set', 'test_drive', 'negotiation', 'converted', 'lost', 'nurture']);
const BASE_PIPELINE_KEY = 'crm_pipeline_stages_v1';

function cloneDefaultStages(): PipelineStageConfig[] {
  return DEFAULT_PIPELINE_STAGES.map((s) => ({
    ...s,
    fields: s.fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })),
  }));
}

export function slugifyStageKey(label: string, existingKeys: ReadonlyArray<string>): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'custom_stage';
  const rawKey = CORE_STAGE_KEYS.has(base) ? `custom_${base}` : base;
  const existingSet = new Set(existingKeys);
  if (!existingSet.has(rawKey)) return rawKey;
  let counter = 2;
  while (existingSet.has(`${rawKey}_${counter}`)) {
    counter++;
  }
  return `${rawKey}_${counter}`;
}

export function getPipelineStages(): PipelineStageConfig[] {
  if (typeof window === 'undefined') return cloneDefaultStages();
  try {
    const key = getScopedKey(BASE_PIPELINE_KEY);
    const raw = localStorage.getItem(key);
    if (!raw) return cloneDefaultStages();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return cloneDefaultStages();
    return parsed.map((stage: any) => ({
      ...STAGE_COLOR_PRESETS[0],
      ...stage,
      fields: Array.isArray(stage.fields) ? stage.fields : [],
    }));
  } catch {
    return cloneDefaultStages();
  }
}

export function savePipelineStages(
  stages: PipelineStageConfig[],
  options: { syncRemote?: boolean } = { syncRemote: true }
): PipelineStageConfig[] {
  if (typeof window === 'undefined') return stages;
  try {
    const key = getScopedKey(BASE_PIPELINE_KEY);
    localStorage.setItem(key, JSON.stringify(stages));
    window.dispatchEvent(new CustomEvent('crm-pipeline-stages-changed', { detail: stages }));
    if (options.syncRemote !== false) {
      fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'pipeline_config',
          data: { tenantId: getActiveTenantId(), stages },
        }),
      }).catch((err) => console.warn('[PipelineStore] Remote config sync note:', err?.message));
    }
  } catch (err) {
    console.error('[PipelineStore] Failed to save pipeline stages:', err);
  }
  return stages;
}

export async function fetchPipelineStages(): Promise<PipelineStageConfig[]> {
  if (typeof window === 'undefined') return cloneDefaultStages();
  try {
    const res = await fetch('/api/crm');
    if (res.status === 401 || res.status === 403) {
      return getPipelineStages();
    }
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.pipeline_stages) && json.pipeline_stages.length > 0) {
        savePipelineStages(json.pipeline_stages, { syncRemote: false });
        return getPipelineStages();
      }
    }
  } catch (err) {
    console.warn('[PipelineStore] Fetch remote pipeline stages note:', err);
  }
  return getPipelineStages();
}

export function resetPipelineStagesToDefault(): PipelineStageConfig[] {
  const defaults = cloneDefaultStages();
  return savePipelineStages(defaults, { syncRemote: true });
}

/**
 * Evaluates whether moving a lead between two stages is allowed in the customized pipeline.
 * Supports custom stages inserted anywhere (including before/after Negotiation) while
 * keeping terminal 'converted' protection and standard domain rules for default paths.
 */
export function canTransitionCustomPipeline(
  stages: ReadonlyArray<PipelineStageConfig>,
  fromKey: string,
  toKey: string
): boolean {
  if (!fromKey || !toKey || fromKey === toKey) return false;
  if (fromKey === 'converted') return false;

  // Custom stages (or moving into/out of custom stages) allow moving along customized workflow
  const fromIsCore = CORE_STAGE_KEYS.has(fromKey);
  const toIsCore = CORE_STAGE_KEYS.has(toKey);
  if (!fromIsCore || !toIsCore) {
    // Allow moving into or out of custom stages anywhere in the pipeline, except direct jump from 'new' straight to 'converted'
    return !(fromKey === 'new' && toKey === 'converted');
  }

  // If the admin reordered stages or inserted custom stages in between, allow adjacent progression
  // in their configured board order as well as standard LEAD_TRANSITIONS
  const fromIdx = stages.findIndex((s) => s.key === fromKey);
  const toIdx = stages.findIndex((s) => s.key === toKey);
  if (fromIdx !== -1 && toIdx === fromIdx + 1 && !(fromKey === 'new' && toKey === 'converted')) {
    return true;
  }

  const hasCustomBetween =
    fromIdx !== -1 &&
    toIdx !== -1 &&
    stages.slice(Math.min(fromIdx, toIdx) + 1, Math.max(fromIdx, toIdx)).some((s) => !CORE_STAGE_KEYS.has(s.key));
  if (hasCustomBetween && !(fromKey === 'new' && toKey === 'converted')) {
    return true;
  }

  return validateLeadTransition(fromKey as LeadStatus, toKey as LeadStatus);
}

