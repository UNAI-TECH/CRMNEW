'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { WordFadeIn } from '@/components/ui/WordFadeIn';
import { Modal } from '@/components/ui/Modal';
import { ErrorPopup, triggerErrorPopup } from '@/components/ui/ErrorPopup';
import {
  getEmployees,
  fetchEmployees,
  addEmployee,
  updateEmployee,
  updateEmployeePassword,
  updateEmployeeAccessControl,
  submitEmployeeLeaveRequest,
  reviewEmployeeLeaveRequest,
  normalizeLeaveBalance,
  computeRemainingLeaveDays,
  deleteEmployee,
  resetEmployeePassword,
  initEmployeesRealtime,
  Employee,
  EmployeeAccessControl,
} from '@/lib/client/stores/employee-store';
import { api } from '@/lib/client/api-client';
import { Branch } from '@crm/shared-types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getUserSession } from '@/lib/client/auth-context';
import {
  Users,
  Plus,
  Search,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Calendar,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  ExternalLink,
  Trash2,
  Lock,
  Camera,
  Upload,
  Edit3,
  Pencil,
  MapPin,
  Building2,
  X,
  UserPlus,
  Banknote,
  Briefcase,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});
  const [selectedProfileCardEmp, setSelectedProfileCardEmp] = useState<Employee | null>(null);
  const [isEditingDossier, setIsEditingDossier] = useState(false);
  const [editDossierForm, setEditDossierForm] = useState<Partial<Employee>>({});
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);

  const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  ];

  const openEmployeeDossier = (emp: Employee) => {
    setSelectedProfileCardEmp(emp);
    setEditDossierForm({ ...emp });
    setIsEditingDossier(false);
  };

  const handleSaveDossierChanges = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProfileCardEmp) return;
    if (!editDossierForm.fullName?.trim()) {
      triggerErrorPopup('Employee full name cannot be blank.', 'Validation Error');
      return;
    }
    const cleanUserId = (editDossierForm.userId || editDossierForm.employeeCode || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUserId) {
      triggerErrorPopup('User ID cannot be blank.', 'Validation Error');
      return;
    }
    const duplicate = employees.find(
      (emp) =>
        emp.id !== selectedProfileCardEmp.id &&
        ((emp.userId && emp.userId.toLowerCase().trim() === cleanUserId) ||
          (emp.employeeCode && emp.employeeCode.toLowerCase().trim() === cleanUserId))
    );
    if (duplicate) {
      triggerErrorPopup(
        `User ID '${cleanUserId}' is already assigned to ${duplicate.fullName}. Every staff member must have a unique User ID.`,
        'Duplicate User ID'
      );
      return;
    }
    const updated = updateEmployee(selectedProfileCardEmp.id, {
      ...editDossierForm,
      userId: cleanUserId,
      employeeCode: cleanUserId,
    });
    if (updated) {
      setSelectedProfileCardEmp(updated);
      setEmployees(getEmployees());
      setIsEditingDossier(false);
      showToast(`Employee details for ${updated.fullName} updated successfully!`);
    } else {
      triggerErrorPopup('Failed to update employee details.', 'Update Error');
    }
  };

  const compressImage = (file: File, maxDim: number = 180, quality: number = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawData = e.target?.result as string;
        if (!rawData) return resolve('');
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawData);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          let compressed = canvas.toDataURL('image/webp', quality);
          if (!compressed.startsWith('data:image/webp')) {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(compressed);
        };
        img.onerror = () => resolve(rawData);
        img.src = rawData;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'add' | 'edit') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      triggerErrorPopup('Image size exceeds 5MB. Please select a smaller photo.', 'File Size Exceeded');
      return;
    }
    try {
      const compressed = await compressImage(file, 180, 0.85);
      if (compressed) {
        if (target === 'add') {
          setNewEmpForm((prev) => ({ ...prev, avatarUrl: compressed }));
        } else {
          setEditDossierForm((prev) => ({ ...prev, avatarUrl: compressed }));
        }
        showToast('Photo uploaded and optimized successfully!');
      }
    } catch {
      triggerErrorPopup('Failed to process uploaded image file.', 'Image Processing Error');
    }
  };

  const toggleEmployeeCard = (id: string) => {
    setExpandedCardIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Modals
  const [isMounted, setIsMounted] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedForLeave, setSelectedForLeave] = useState<Employee | null>(null);
  const [selectedForAccess, setSelectedForAccess] = useState<Employee | null>(null);
  const [createdCredentialsModal, setCreatedCredentialsModal] = useState<{
    isOpen: boolean;
    employee: Employee | null;
  }>({ isOpen: false, employee: null });
  const [showAccessRolesExpanded, setShowAccessRolesExpanded] = useState(true);

  // New Employee Form matching user requirements
  const [newEmpForm, setNewEmpForm] = useState({
    userId: '',
    fullName: '',
    designation: '',
    customDesignation: '',
    phone: '',
    email: '',
    salary: '',
    salaryCategory: 'Annual CTC',
    isAdmin: false,
    department: 'Sales' as any,
    branch: '',
    employeeCode: '',
    avatarUrl: '',
    accessControl: {
      pipeline: true,
      customers: true,
      inventory: true,
      procurement: false,
      deals: true,
      finance: false,
      testDrives: true,
      documents: false,
      reports: false,
      settings: false,
    } as EmployeeAccessControl,
  });

  const handleOpenAddModal = () => {
    setNewEmpForm({
      userId: '',
      fullName: '',
      designation: '',
      customDesignation: '',
      phone: '',
      email: '',
      salary: '',
      salaryCategory: 'Annual CTC',
      isAdmin: false,
      department: 'Sales',
      branch: '',
      employeeCode: '',
      avatarUrl: '',
      accessControl: {
        pipeline: true,
        customers: true,
        inventory: true,
        procurement: false,
        deals: true,
        finance: false,
        testDrives: true,
        documents: false,
        reports: false,
        settings: false,
      },
    });
    setShowAccessRolesExpanded(true);
    setIsAddModalOpen(true);
  };

  const handleRolePreset = (preset: 'all' | 'sales' | 'finance' | 'service' | 'clear') => {
    if (preset === 'all') {
      setNewEmpForm((prev) => ({
        ...prev,
        accessControl: {
          pipeline: true,
          customers: true,
          inventory: true,
          procurement: true,
          deals: true,
          finance: true,
          testDrives: true,
          documents: true,
          reports: true,
          settings: true,
        },
      }));
    } else if (preset === 'sales') {
      setNewEmpForm((prev) => ({
        ...prev,
        accessControl: {
          pipeline: true,
          customers: true,
          inventory: true,
          procurement: false,
          deals: true,
          finance: false,
          testDrives: true,
          documents: false,
          reports: false,
          settings: false,
        },
      }));
    } else if (preset === 'finance') {
      setNewEmpForm((prev) => ({
        ...prev,
        accessControl: {
          pipeline: false,
          customers: true,
          inventory: false,
          procurement: true,
          deals: true,
          finance: true,
          testDrives: false,
          documents: true,
          reports: true,
          settings: false,
        },
      }));
    } else if (preset === 'service') {
      setNewEmpForm((prev) => ({
        ...prev,
        accessControl: {
          pipeline: false,
          customers: true,
          inventory: true,
          procurement: false,
          deals: false,
          finance: false,
          testDrives: true,
          documents: true,
          reports: false,
          settings: false,
        },
      }));
    } else {
      setNewEmpForm((prev) => ({
        ...prev,
        accessControl: {
          pipeline: false,
          customers: false,
          inventory: false,
          procurement: false,
          deals: false,
          finance: false,
          testDrives: false,
          documents: false,
          reports: false,
          settings: false,
        },
      }));
    }
  };

  // Automatically assign default role permissions & department when a designation is selected
  const handleRoleChange = (role: string) => {
    let department: 'Sales' | 'Finance' | 'Operations' | 'Service' | 'Management' = 'Sales';
    let isAdmin = false;
    let accessControl: EmployeeAccessControl = {
      pipeline: true,
      customers: true,
      inventory: true,
      procurement: false,
      deals: true,
      finance: false,
      testDrives: true,
      documents: false,
      reports: false,
      settings: false,
    };

    switch (role) {
      case 'Accountant':
        department = 'Finance';
        isAdmin = false;
        accessControl = {
          pipeline: false,
          customers: true,
          inventory: false,
          procurement: true,
          deals: true,
          finance: true,
          testDrives: false,
          documents: true,
          reports: true,
          settings: false,
        };
        break;
      case 'Sales Executive':
        department = 'Sales';
        isAdmin = false;
        accessControl = {
          pipeline: true,
          customers: true,
          inventory: true,
          procurement: false,
          deals: true,
          finance: false,
          testDrives: true,
          documents: false,
          reports: false,
          settings: false,
        };
        break;
      case 'Sales Manager':
        department = 'Sales';
        isAdmin = false;
        accessControl = {
          pipeline: true,
          customers: true,
          inventory: true,
          procurement: true,
          deals: true,
          finance: false,
          testDrives: true,
          documents: true,
          reports: true,
          settings: false,
        };
        break;
      case 'Finance Manager':
        department = 'Finance';
        isAdmin = false;
        accessControl = {
          pipeline: false,
          customers: true,
          inventory: false,
          procurement: true,
          deals: true,
          finance: true,
          testDrives: false,
          documents: true,
          reports: true,
          settings: false,
        };
        break;
      case 'Inventory Manager':
        department = 'Operations';
        isAdmin = false;
        accessControl = {
          pipeline: false,
          customers: false,
          inventory: true,
          procurement: true,
          deals: false,
          finance: false,
          testDrives: true,
          documents: true,
          reports: true,
          settings: false,
        };
        break;
      case 'Service Advisor':
        department = 'Service';
        isAdmin = false;
        accessControl = {
          pipeline: false,
          customers: true,
          inventory: true,
          procurement: false,
          deals: false,
          finance: false,
          testDrives: true,
          documents: true,
          reports: false,
          settings: false,
        };
        break;
      case 'Technician':
        department = 'Service';
        isAdmin = false;
        accessControl = {
          pipeline: false,
          customers: false,
          inventory: true,
          procurement: false,
          deals: false,
          finance: false,
          testDrives: true,
          documents: false,
          reports: false,
          settings: false,
        };
        break;
      case 'Receptionist':
      case 'Telecaller':
        department = 'Sales';
        isAdmin = false;
        accessControl = {
          pipeline: true,
          customers: true,
          inventory: true,
          procurement: false,
          deals: false,
          finance: false,
          testDrives: true,
          documents: false,
          reports: false,
          settings: false,
        };
        break;
      case 'General Manager':
        department = 'Management';
        isAdmin = true;
        accessControl = {
          pipeline: true,
          customers: true,
          inventory: true,
          procurement: true,
          deals: true,
          finance: true,
          testDrives: true,
          documents: true,
          reports: true,
          settings: true,
        };
        break;
      default:
        department = 'Sales';
        isAdmin = false;
        accessControl = {
          pipeline: true,
          customers: true,
          inventory: true,
          procurement: false,
          deals: true,
          finance: false,
          testDrives: true,
          documents: false,
          reports: false,
          settings: false,
        };
        break;
    }

    setNewEmpForm((prev) => ({
      ...prev,
      designation: role,
      department,
      isAdmin,
      accessControl,
    }));
  };

  // Leave Form
  const [newLeaveForm, setNewLeaveForm] = useState({
    leaveType: 'casual' as any,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    days: 2,
    reason: '',
  });

  useEffect(() => {
    const session = getUserSession();
    if (session?.employeeId && !session?.isAdmin) {
      router.replace('/empportal');
      return;
    }
    setIsMounted(true);
    const localInitial = getEmployees();
    setEmployees(localInitial);

    const openRequestedLeaveModal = (list: Employee[]) => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const leaveEmpId = params.get('leaveEmployeeId');
      if (leaveEmpId) {
        const target = list.find((e) => e.id === leaveEmpId);
        if (target) setSelectedForLeave(target);
      }
    };
    openRequestedLeaveModal(localInitial);

    fetchEmployees().then((data) => {
      if (Array.isArray(data)) {
        setEmployees([...data]);
        openRequestedLeaveModal(data);
      }
    });
    // Fetch dealership branches/showrooms created by user
    setAvailableBranches(api.getBranches());
    api.fetchBranches().then((bData) => {
      if (Array.isArray(bData)) setAvailableBranches([...bData]);
    });
    // Listen for Supabase Realtime changes so deletions in Supabase Table Editor delete live on the frontend
    initEmployeesRealtime();
    const handleChanged = () => {
      const latest = getEmployees();
      setEmployees(latest);
      setSelectedForLeave((prev) => (prev ? latest.find((e) => e.id === prev.id) || prev : null));
    };
    const handleBranchesChanged = () => setAvailableBranches(api.getBranches());
    const handleOpenLeaveEvent = (ev: Event) => {
      const empId = (ev as CustomEvent)?.detail?.employeeId;
      if (!empId) return;
      const latest = getEmployees();
      const target = latest.find((e) => e.id === empId);
      if (target) setSelectedForLeave(target);
    };
    const handleRefreshOnFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchEmployees().then((data) => {
        if (Array.isArray(data)) setEmployees([...data]);
      });
    };

    window.addEventListener('crm-employees-changed', handleChanged);
    window.addEventListener('crm-data-changed', handleBranchesChanged);
    window.addEventListener('crm-open-employee-leave', handleOpenLeaveEvent);
    window.addEventListener('focus', handleRefreshOnFocus);
    document.addEventListener('visibilitychange', handleRefreshOnFocus);

    const leavePoll = window.setInterval(() => {
      fetchEmployees().then((data) => {
        if (Array.isArray(data)) setEmployees([...data]);
      });
    }, 20000);

    // Global client and network error listeners to guarantee a pop-up on any error
    const handleWindowError = (event: ErrorEvent) => {
      triggerErrorPopup(
        event.message || 'An unexpected client-side error occurred.',
        'Runtime Error',
        event.error?.stack || `${event.filename}:${event.lineno}`
      );
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = typeof reason === 'string' ? reason : reason?.message || 'Asynchronous request failed.';
      triggerErrorPopup(msg, 'Server / Database Error', reason?.stack);
    };
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('crm-employees-changed', handleChanged);
      window.removeEventListener('crm-data-changed', handleBranchesChanged);
      window.removeEventListener('crm-open-employee-leave', handleOpenLeaveEvent);
      window.removeEventListener('focus', handleRefreshOnFocus);
      document.removeEventListener('visibilitychange', handleRefreshOnFocus);
      window.clearInterval(leavePoll);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (isAddModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isAddModalOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Credentials copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Full Name (Mandatory)
    const cleanFullName = newEmpForm.fullName.trim();
    if (!cleanFullName) {
      triggerErrorPopup('Please enter the employee full name before submitting.', 'Missing Full Name');
      return;
    }
    if (cleanFullName.length < 2) {
      triggerErrorPopup('Full name must be at least 2 characters long.', 'Invalid Full Name');
      return;
    }

    // 2. User ID (Mandatory)
    const cleanUserId = newEmpForm.userId.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanUserId) {
      triggerErrorPopup('Please enter a User ID for the employee. Staff use this User ID to log in at /emplogin.', 'Missing User ID');
      return;
    }
    if (cleanUserId.length < 3) {
      triggerErrorPopup('User ID must be at least 3 characters long (e.g. rohit01, jdoe).', 'Invalid User ID');
      return;
    }

    // Check for duplicate user ID
    const duplicate = employees.find(
      (emp) =>
        (emp.userId && emp.userId.toLowerCase().trim() === cleanUserId) ||
        (emp.employeeCode && emp.employeeCode.toLowerCase().trim() === cleanUserId)
    );
    if (duplicate) {
      triggerErrorPopup(
        `User ID '${cleanUserId}' is already assigned to ${duplicate.fullName} in the database. Every staff member must have a unique User ID.`,
        'Duplicate User ID Error'
      );
      return;
    }

    // 3. Designation / Role (Mandatory)
    if (!newEmpForm.designation) {
      triggerErrorPopup('Please select a Designation / Role for the employee.', 'Missing Designation');
      return;
    }
    if (newEmpForm.designation === 'custom' && !newEmpForm.customDesignation.trim()) {
      triggerErrorPopup('Please enter the custom designation job title.', 'Missing Custom Role');
      return;
    }

    // 4. Phone Number (Mandatory)
    const cleanPhone = newEmpForm.phone.trim();
    if (!cleanPhone) {
      triggerErrorPopup('Please enter the employee phone number before submitting.', 'Missing Phone Number');
      return;
    }
    const phoneDigits = cleanPhone.replace(/[^0-9]/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      triggerErrorPopup('Please enter a valid phone number (between 7 and 15 digits).', 'Invalid Phone Number');
      return;
    }

    // 5. Email Address (Mandatory & Validated)
    const rawEmail = newEmpForm.email.trim().toLowerCase();
    if (!rawEmail) {
      triggerErrorPopup('Please enter an email address for the employee.', 'Missing Email Address');
      return;
    }
    const strictEmailRegex = /^(?:[A-Za-z0-9_'+\-]+(?:\.[A-Za-z0-9_'+\-]+)*)@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
    if (!strictEmailRegex.test(rawEmail)) {
      triggerErrorPopup('Please enter a valid email address (e.g. name@company.com). The domain must include a valid extension like .com, .in, etc.', 'Invalid Email Address');
      return;
    }

    // 6. Annual CTC / Salary (Mandatory)
    const cleanSalary = newEmpForm.salary.trim();
    if (!cleanSalary) {
      triggerErrorPopup('Please enter the employee salary / CTC amount.', 'Missing Salary');
      return;
    }
    const numericSalary = Number(cleanSalary.replace(/[^0-9.]/g, ''));
    if (isNaN(numericSalary) || numericSalary <= 0) {
      triggerErrorPopup('Please enter a valid positive numeric amount for the salary.', 'Invalid Salary Amount');
      return;
    }

    // 7. Salary Category (Mandatory)
    if (!newEmpForm.salaryCategory) {
      triggerErrorPopup('Please select a Salary Category (e.g. Annual CTC or Monthly Fixed).', 'Missing Salary Category');
      return;
    }

    // 8. Branch / Showroom (Optional - only if branches exist and selected)
    const resolvedBranch = newEmpForm.branch.trim();

    try {
      const resolvedRole =
        newEmpForm.designation === 'custom'
          ? (newEmpForm.customDesignation.trim() || 'Staff Member')
          : (newEmpForm.designation || 'Sales Executive');

      let resolvedDept = 'Sales';
      const dLower = resolvedRole.toLowerCase();
      if (dLower.includes('finance') || dLower.includes('account')) resolvedDept = 'Finance';
      else if (dLower.includes('inventory') || dLower.includes('procurement')) resolvedDept = 'Operations';
      else if (dLower.includes('service') || dLower.includes('tech')) resolvedDept = 'Service';
      else if (dLower.includes('manager') || dLower.includes('director')) resolvedDept = 'Management';
      if (newEmpForm.isAdmin) resolvedDept = 'Admin';

      const created = addEmployee({
        userId: cleanUserId,
        employeeCode: cleanUserId,
        fullName: cleanFullName,
        email: rawEmail,
        phone: cleanPhone,
        designation: resolvedRole,
        department: resolvedDept as any,
        branch: resolvedBranch,
        salary: cleanSalary.startsWith('₹') ? cleanSalary : `₹${cleanSalary}`,
        salaryCategory: newEmpForm.salaryCategory || 'Annual CTC',
        isAdmin: newEmpForm.isAdmin,
        isPasswordSet: false,
        avatarUrl: newEmpForm.avatarUrl || '',
        accessControl: newEmpForm.isAdmin ? {
          pipeline: true,
          customers: true,
          inventory: true,
          procurement: true,
          deals: true,
          finance: true,
          testDrives: true,
          documents: true,
          reports: true,
          settings: true,
        } : newEmpForm.accessControl,
      });

      setIsAddModalOpen(false);
      setEmployees(getEmployees());
      setCreatedCredentialsModal({ isOpen: true, employee: created });
      showToast(`Employee ${created.fullName} (User ID: ${created.userId}) created successfully!`);

      // Refetch in background to ensure Supabase state synchronization
      fetchEmployees().then((fresh) => {
        if (Array.isArray(fresh)) setEmployees([...fresh]);
      });
    } catch (err: any) {
      triggerErrorPopup(err?.message || 'An unexpected error occurred while creating employee.', 'Employee Creation Error');
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForLeave) return;

    if (new Date(newLeaveForm.startDate) > new Date(newLeaveForm.endDate)) {
      triggerErrorPopup('Leave start date cannot be later than end date.', 'Invalid Date Range');
      return;
    }

    const res = await submitEmployeeLeaveRequest(selectedForLeave.id, {
      leaveType: newLeaveForm.leaveType,
      startDate: newLeaveForm.startDate,
      endDate: newLeaveForm.endDate,
      days: Number(newLeaveForm.days) || 1,
      reason: newLeaveForm.reason || 'Personal leave',
      status: 'approved',
      approvedBy: 'Tenant Admin',
    });

    if (res.success) {
      const updated = getEmployees().find((e) => e.id === selectedForLeave.id);
      setEmployees(getEmployees());
      setSelectedForLeave(updated || null);
      showToast(`Leave recorded for ${selectedForLeave.fullName}!`);
    } else {
      triggerErrorPopup(res.error || 'Failed to record leave.', 'Leave Error');
    }
  };

  const handleLeaveDecision = async (employeeId: string, employeeName: string, recordId: string, approved: boolean) => {
    const newStatus = approved ? 'approved' : 'rejected';
    const result = await reviewEmployeeLeaveRequest(employeeId, recordId, newStatus, 'Administrator');
    if (result.success) {
      const all = getEmployees();
      setEmployees(all);
      if (selectedForLeave && selectedForLeave.id === employeeId) {
        setSelectedForLeave(all.find((e) => e.id === employeeId) || null);
      }
      if (selectedProfileCardEmp && selectedProfileCardEmp.id === employeeId) {
        setSelectedProfileCardEmp(all.find((e) => e.id === employeeId) || null);
      }
      showToast(
        approved
          ? `Leave request approved for ${employeeName}! Balance updated.`
          : `Leave request rejected for ${employeeName}.`
      );
    } else {
      showToast(result.error || 'Failed to update leave record status.');
    }
  };

  const handleApproveLeave = (recordId: string, approved: boolean) => {
    if (!selectedForLeave) return;
    void handleLeaveDecision(selectedForLeave.id, selectedForLeave.fullName, recordId, approved);
  };

  const handleToggleAccess = (key: keyof EmployeeAccessControl) => {
    if (!selectedForAccess) return;
    const current = { ...selectedForAccess.accessControl };
    current[key] = !current[key];
    updateEmployeeAccessControl(selectedForAccess.id, current);
    const updated = getEmployees().find((e) => e.id === selectedForAccess.id);
    setSelectedForAccess(updated || null);
    showToast(`Updated permissions for ${selectedForAccess.fullName}.`);
  };

  const handleToggleCardAccess = (key: keyof EmployeeAccessControl) => {
    if (!selectedProfileCardEmp) return;
    const current = { ...selectedProfileCardEmp.accessControl };
    current[key] = !current[key];
    updateEmployeeAccessControl(selectedProfileCardEmp.id, current);
    const updated = getEmployees().find((e) => e.id === selectedProfileCardEmp.id);
    setSelectedProfileCardEmp(updated || null);
    showToast(`Updated permissions for ${selectedProfileCardEmp.fullName}.`);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return employees.filter((e) => {
      const matchDept = deptFilter === 'All' || e.department === deptFilter;
      const matchQuery =
        !q ||
        (e.fullName || '').toLowerCase().includes(q) ||
        (e.userId || '').toLowerCase().includes(q) ||
        (e.employeeCode || '').toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q) ||
        (e.designation || '').toLowerCase().includes(q);
      return matchDept && matchQuery;
    });
  }, [employees, deptFilter, search]);

  const pendingLeaveQueue = useMemo(() => {
    const list: Array<{ employee: Employee; record: Employee['leaveHistory'][number] }> = [];
    for (const emp of employees) {
      for (const lh of emp.leaveHistory || []) {
        if (lh && lh.status === 'pending') {
          list.push({ employee: emp, record: lh });
        }
      }
    }
    return list.sort((a, b) => {
      const tA = Date.parse(a.record.appliedOn || '') || 0;
      const tB = Date.parse(b.record.appliedOn || '') || 0;
      return tB - tA;
    });
  }, [employees]);

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            background: '#0F172A',
            color: '#FFFFFF',
            padding: '10px 18px',
            borderRadius: '10px',
            fontSize: '0.84rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            zIndex: 99999,
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#10B981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">
            <WordFadeIn text="Employee Management" />
          </h1>
          <p className="page-desc">
            <WordFadeIn
              text="Dealership employee directory, CRM ID & passwords, individual leave logs, and granular section access control."
              mobileText="Directory, IDs & roles"
              baseDelay={0.18}
              staggerDelay={0.025}
            />
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <button
            type="button"
            className="unique-lead-submit-btn"
            onClick={handleOpenAddModal}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Plus size={15} />
            <span className="btn-text">Add Employee</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ position: 'relative', minWidth: '260px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
          <input
            type="text"
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, designation, or email..."
            style={{ paddingLeft: '32px', fontSize: '0.82rem', height: '34px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {['All', 'Sales', 'Finance', 'Operations', 'Service', 'Management'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDeptFilter(d)}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: deptFilter === d ? '#6253F8' : '#E2E8F0',
                backgroundColor: deptFilter === d ? '#6253F8' : '#FFFFFF',
                color: deptFilter === d ? '#FFFFFF' : '#475569',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Pending Leave Requests Inbox (surfaces immediately when any staff submits time off) */}
      {pendingLeaveQueue.length > 0 && (
        <div className="emp-pending-leaves-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Calendar size={17} style={{ color: '#B45309', flexShrink: 0 }} />
              <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#78350F' }}>
                Pending Leave Requests
              </span>
              <span
                style={{
                  padding: '2px 9px',
                  borderRadius: '999px',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                }}
              >
                {pendingLeaveQueue.length} Awaiting Approval
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400E' }}>
              Review and accept or reject staff time-off requests
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingLeaveQueue.map(({ employee: emp, record: lh }) => (
              <div key={`${emp.id}-${lh.id}`} className="emp-pending-leave-item">
                <div style={{ minWidth: 0, flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>
                      {emp.fullName}
                    </span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#2563EB',
                        background: '#EFF6FF',
                        padding: '1px 7px',
                        borderRadius: '6px',
                        border: '1px solid #DBEAFE',
                      }}
                    >
                      {emp.userId || emp.employeeCode}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: '#EEF2FF',
                        color: '#4F46E5',
                        textTransform: 'capitalize',
                      }}
                    >
                      {lh.leaveType} Leave
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>
                    {lh.startDate} to {lh.endDate} ({lh.days} {lh.days === 1 ? 'day' : 'days'})
                    {lh.reason ? <span style={{ color: '#64748B', fontWeight: 500 }}> • {lh.reason}</span> : null}
                  </div>
                </div>

                <div className="emp-pending-leave-actions">
                  <button
                    type="button"
                    onClick={() => setSelectedForLeave(emp)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      color: '#334155',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLeaveDecision(emp.id, emp.fullName, lh.id, true)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLeaveDecision(emp.id, emp.fullName, lh.id, false)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      color: '#DC2626',
                      border: '1px solid #FECACA',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <XCircle size={13} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employees List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: '60px 24px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1.5px dashed #CBD5E1',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
              No Staff Members Registered Yet
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: '420px', margin: '0 auto 20px' }}>
              Your dealership team roster is empty. Register employees, assign department roles, credentials, and track commissions.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                backgroundColor: '#6253F8',
                color: '#FFFFFF',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span>+</span> Add First Employee
            </button>
          </div>
        ) : (
          filtered.map((emp) => {
          const isPassVisible = revealedPasswords[emp.id];
          const isExpanded = !!expandedCardIds[emp.id];

          return (
            <div
              key={emp.id}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1.5px solid #E2E8F0',
                borderRadius: '16px',
                padding: '16px 20px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Main Row: Clean, Uncluttered, Clickable to open Card in middle of page */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div
                  onClick={() => openEmployeeDossier(emp)}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
                  title="Click to view full employee dossier"
                >
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      backgroundColor: '#6253F8',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      fontWeight: 800,
                      flexShrink: 0,
                      overflow: 'hidden',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    }}
                  >
                    {emp.avatarUrl ? (
                      <img
                        src={emp.avatarUrl}
                        alt={emp.fullName}
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.style.display = 'none';
                          if (img.parentElement) {
                            img.parentElement.textContent = emp.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                          }
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      emp.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div>
                    {/* Clickable Employee Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        className="emp-name-title"
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          cursor: 'pointer',
                        }}
                      >
                        {emp.fullName}
                      </span>

                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          color: '#2563EB',
                          background: '#EFF6FF',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid #DBEAFE',
                        }}
                      >
                        {emp.userId || emp.employeeCode}
                      </span>
                      <span className="badge badge-green">{emp.department}</span>
                      {emp.isAdmin && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#FEF3C7',
                            color: '#92400E',
                            border: '1px solid #FDE68A',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Shield size={11} /> Admin Privileges
                        </span>
                      )}
                      {emp.isPasswordSet ? (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#DCFCE7',
                            color: '#166534',
                            border: '1px solid #BBF7D0',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={11} /> Permanent Password Active
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#FFFBEB',
                            color: '#B45309',
                            border: '1px solid #FDE68A',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <KeyRound size={11} /> Password Pending (1st Login Pending)
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{emp.branch ? `${emp.designation} • ${emp.branch}` : emp.designation}</span>
                      <span>•</span>
                      <span style={{ fontWeight: 600, color: emp.salary ? '#334155' : '#94A3B8' }}>
                        {emp.salary ? `${emp.salary} (${emp.salaryCategory || 'Annual CTC'})` : 'Salary Not Set'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {(() => {
                    const totalAvailLeave = computeRemainingLeaveDays(emp.leaveBalance);
                    const pendingCount = (emp.leaveHistory || []).filter((lh) => lh.status === 'pending').length;

                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedForLeave(emp)}
                        title="View Leave Balance and Pending Leave Requests"
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: pendingCount > 0 ? '1.5px solid #F59E0B' : '1px solid #CBD5E1',
                          background: pendingCount > 0 ? '#FFFBEB' : '#FFFFFF',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: pendingCount > 0 ? '#B45309' : '#1E293B',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        }}
                      >
                        <Calendar size={13} style={{ color: pendingCount > 0 ? '#D97706' : '#2563EB' }} />
                        <span>Leave Balance: {totalAvailLeave} Days</span>
                        {pendingCount > 0 && (
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: '999px',
                              backgroundColor: '#EF4444',
                              color: '#FFFFFF',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                            }}
                          >
                            {pendingCount} Pending
                          </span>
                        )}
                      </button>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => setSelectedForAccess(emp)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid #6253F8',
                      background: '#E6F4EF',
                      color: '#6253F8',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Shield size={13} />
                    <span>Access Roles</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* Add Employee Modal - Portaled to document.body to cover full screen including top bar */}
      {isAddModalOpen && isMounted && createPortal(
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.60)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflowY: 'auto',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              maxWidth: '640px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '22px 28px 18px',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '14px',
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.12)',
                  }}
                >
                  <UserPlus size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Add Employee
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '3px 0 0 0', fontWeight: 500 }}>
                    Configure staff access and login credentials
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreateEmployee} style={{ padding: '24px 28px', maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Profile Photo Upload */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '14px 18px',
                    backgroundColor: '#F8FAFC',
                    border: '1.5px dashed #CBD5E1',
                    borderRadius: '14px',
                  }}
                >
                  {/* Photo Avatar Preview */}
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '16px',
                      backgroundColor: newEmpForm.avatarUrl ? '#FFFFFF' : '#EEF2FF',
                      border: '2px solid #E0E7FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.08)',
                    }}
                  >
                    {newEmpForm.avatarUrl ? (
                      <img
                        src={newEmpForm.avatarUrl}
                        alt="Employee Avatar Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <User size={30} style={{ color: '#6366F1' }} />
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
                        Profile Photo
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>
                        (PNG, JPG or WEBP up to 3MB)
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                      Upload staff portrait for identity badge, customer test-drive assignments and directory.
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 14px',
                          borderRadius: '10px',
                          backgroundColor: '#4F46E5',
                          color: '#FFFFFF',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Camera size={13} />
                        <span>{newEmpForm.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageFileChange(e, 'add')}
                          style={{ display: 'none' }}
                        />
                      </label>

                      {newEmpForm.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setNewEmpForm((prev) => ({ ...prev, avatarUrl: '' }))}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '7px 12px',
                            borderRadius: '10px',
                            border: '1px solid #FCA5A5',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    {/* Quick Avatar Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                      <span style={{ fontSize: '0.73rem', color: '#64748B', fontWeight: 600 }}>Or choose preset:</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {PRESET_AVATARS.slice(0, 5).map((preset, idx) => (
                          <img
                            key={idx}
                            src={preset}
                            alt="Preset avatar"
                            onClick={() => setNewEmpForm((prev) => ({ ...prev, avatarUrl: preset }))}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              cursor: 'pointer',
                              border: newEmpForm.avatarUrl === preset ? '2px solid #4F46E5' : '1.5px solid #CBD5E1',
                              boxShadow: newEmpForm.avatarUrl === preset ? '0 0 0 2px rgba(79, 70, 229, 0.2)' : 'none',
                              transition: 'transform 0.1s ease',
                            }}
                            title="Click to select this photo"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 1: Full Name & User ID */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  {/* Full Name */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                      Full Name <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User
                        size={16}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                      />
                      <input
                        type="text"
                        required
                        value={newEmpForm.fullName}
                        onChange={(e) => setNewEmpForm({ ...newEmpForm, fullName: e.target.value })}
                        placeholder="e.g. John Doe"
                        style={{
                          width: '100%',
                          height: '44px',
                          padding: '0 12px 0 38px',
                          borderRadius: '12px',
                          border: '1.5px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          fontSize: '0.88rem',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* User ID */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                      User ID <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <KeyRound
                        size={16}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                      />
                      <input
                        type="text"
                        required
                        value={newEmpForm.userId}
                        onChange={(e) => setNewEmpForm({ ...newEmpForm, userId: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                        placeholder="e.g. fsafa, rohit01, jdoe"
                        style={{
                          width: '100%',
                          height: '44px',
                          padding: '0 12px 0 38px',
                          borderRadius: '12px',
                          border: '1.5px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          color: '#2563EB',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
                      Assigned username for staff sign in at <code>/emplogin</code>
                    </div>
                  </div>
                </div>

                {/* Row 2: Designation / Role & Branch */}
                <div style={{ display: 'grid', gridTemplateColumns: availableBranches.length > 0 ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr', gap: '16px' }}>
                  {/* Designation / Role */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                      Designation / Role <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Briefcase
                        size={16}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }}
                      />
                      <select
                        required
                        value={newEmpForm.designation}
                        onChange={(e) => handleRoleChange(e.target.value)}
                        style={{
                          width: '100%',
                          height: '44px',
                          padding: '0 32px 0 38px',
                          borderRadius: '12px',
                          border: '1.5px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          fontSize: '0.88rem',
                          color: newEmpForm.designation ? '#0F172A' : '#94A3B8',
                          outline: 'none',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 14px center',
                        }}
                      >
                        <option value="" disabled>Select a Role</option>
                        <option value="Sales Executive">Sales Executive</option>
                        <option value="Sales Manager">Sales Manager</option>
                        <option value="Finance Manager">Finance Manager</option>
                        <option value="Inventory Manager">Inventory Manager</option>
                        <option value="Service Advisor">Service Advisor</option>
                        <option value="Technician">Technician</option>
                        <option value="Receptionist">Receptionist</option>
                        <option value="Telecaller">Telecaller</option>
                        <option value="Accountant">Accountant</option>
                        <option value="General Manager">General Manager</option>
                        <option value="custom">+ Custom Role</option>
                      </select>
                    </div>
                  </div>

                  {/* Branch / Showroom - ONLY VISIBLE IF SHOWROOMS / BRANCHES CREATED */}
                  {availableBranches.length > 0 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                        Branch / Showroom <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>(Optional)</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Building2
                          size={16}
                          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }}
                        />
                        <select
                          value={newEmpForm.branch}
                          onChange={(e) => setNewEmpForm({ ...newEmpForm, branch: e.target.value })}
                          style={{
                            width: '100%',
                            height: '44px',
                            padding: '0 32px 0 38px',
                            borderRadius: '12px',
                            border: '1.5px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            fontSize: '0.88rem',
                            color: newEmpForm.branch ? '#0F172A' : '#94A3B8',
                            outline: 'none',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            appearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 14px center',
                          }}
                        >
                          <option value="">Select Showroom / Branch (Optional)</option>
                          {availableBranches.map((b) => (
                            <option key={b.id} value={b.name}>
                              {b.name} {b.code ? `(${b.code})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* If Custom Role selected */}
                {newEmpForm.designation === 'custom' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                      Enter Custom Designation / Job Title <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newEmpForm.customDesignation}
                      onChange={(e) => setNewEmpForm({ ...newEmpForm, customDesignation: e.target.value })}
                      placeholder="e.g. Lead Valuator & Inspector"
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #C7D2FE',
                        backgroundColor: '#F8FAFC',
                        fontSize: '0.88rem',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                {/* Row 2: Phone Number & Email Address */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  {/* Phone Number */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                      Phone Number <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Phone
                        size={16}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                      />
                      <input
                        type="tel"
                        required
                        value={newEmpForm.phone}
                        onChange={(e) => setNewEmpForm({ ...newEmpForm, phone: e.target.value })}
                        placeholder="e.g. +1 555 0199"
                        style={{
                          width: '100%',
                          height: '44px',
                          padding: '0 12px 0 38px',
                          borderRadius: '12px',
                          border: '1.5px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          fontSize: '0.88rem',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                      Email Address <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail
                        size={16}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                      />
                      <input
                        type="email"
                        required
                        value={newEmpForm.email}
                        onChange={(e) => setNewEmpForm({ ...newEmpForm, email: e.target.value })}
                        placeholder="e.g. john@example.com"
                        style={{
                          width: '100%',
                          height: '44px',
                          padding: '0 12px 0 38px',
                          borderRadius: '12px',
                          border: '1.5px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          fontSize: '0.88rem',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Salary & Salary Category */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  {/* Salary */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1E293B' }}>
                        {newEmpForm.salaryCategory === 'Annual CTC' ? 'Annual CTC (₹)' : 'Salary (₹)'} <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      {newEmpForm.salaryCategory === 'Annual CTC' && newEmpForm.salary && !isNaN(Number(newEmpForm.salary.replace(/[^0-9.]/g, ''))) && Number(newEmpForm.salary.replace(/[^0-9.]/g, '')) > 0 && (
                        <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700 }}>
                          ≈ ₹{Math.round(Number(newEmpForm.salary.replace(/[^0-9.]/g, '')) / 12).toLocaleString('en-IN')}/mo
                        </span>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Banknote
                        size={16}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                      />
                      <input
                        type="text"
                        required
                        value={newEmpForm.salary}
                        onChange={(e) => setNewEmpForm({ ...newEmpForm, salary: e.target.value })}
                        placeholder={newEmpForm.salaryCategory === 'Annual CTC' ? 'e.g. 600000' : 'e.g. 50000'}
                        style={{
                          width: '100%',
                          height: '44px',
                          padding: '0 12px 0 38px',
                          borderRadius: '12px',
                          border: '1.5px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          fontSize: '0.88rem',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Salary Category */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                      Salary Category <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Calendar
                        size={16}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }}
                      />
                      <select
                        required
                        value={newEmpForm.salaryCategory}
                        onChange={(e) => setNewEmpForm({ ...newEmpForm, salaryCategory: e.target.value })}
                        style={{
                          width: '100%',
                          height: '44px',
                          padding: '0 32px 0 38px',
                          borderRadius: '12px',
                          border: '1.5px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          fontSize: '0.88rem',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 14px center',
                        }}
                      >
                        <option value="Annual CTC">Annual CTC</option>
                        <option value="Monthly Fixed">Monthly Fixed</option>
                        <option value="Monthly + Commission">Monthly + Commission</option>
                        <option value="Bi-Weekly">Bi-Weekly</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Daily">Daily</option>
                        <option value="Contract / Retainer">Contract / Retainer</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 4: Admin Privileges Banner Card */}
                <div
                  style={{
                    backgroundColor: '#FEFCE8',
                    border: '1.5px solid #FDE68A',
                    borderRadius: '14px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Shield size={24} style={{ color: '#D97706', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#92400E' }}>
                        Admin Privileges
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#78350F', marginTop: '2px' }}>
                        Grant full system access and allow viewing all company documents/financial data.
                      </div>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={newEmpForm.isAdmin}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setNewEmpForm({
                        ...newEmpForm,
                        isAdmin: val,
                        accessControl: val ? {
                          pipeline: true,
                          customers: true,
                          inventory: true,
                          procurement: true,
                          deals: true,
                          finance: true,
                          testDrives: true,
                          documents: true,
                          reports: true,
                          settings: true,
                        } : newEmpForm.accessControl,
                      });
                    }}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      accentColor: '#4F46E5',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                {/* Row 5: Access Roles for Employee (Always visible & customizable, auto-assigned from role) */}
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Module Access Roles &amp; Permissions
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                        {newEmpForm.designation ? (
                          <span>
                            Auto-configured for <strong>{newEmpForm.designation}</strong> ({newEmpForm.department}) • Customize permissions below
                          </span>
                        ) : (
                          <span>Select a Designation above to auto-assign, or customize permissions directly</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {newEmpForm.designation && (
                        <button
                          type="button"
                          onClick={() => handleRoleChange(newEmpForm.designation)}
                          style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#4338CA', cursor: 'pointer', fontWeight: 700 }}
                          title="Reset to default permissions for selected designation"
                        >
                          Reset Role Default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRolePreset('all')}
                        style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 700 }}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRolePreset('sales')}
                        style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Sales
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRolePreset('finance')}
                        style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Finance
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRolePreset('service')}
                        style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Service
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRolePreset('clear')}
                        style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', fontWeight: 700, color: '#94A3B8' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                    {[
                      { key: 'pipeline', label: 'Pipeline & Leads' },
                      { key: 'customers', label: 'Customers' },
                      { key: 'inventory', label: 'Inventory' },
                      { key: 'deals', label: 'Deals & Quotes' },
                      { key: 'testDrives', label: 'Test Drives' },
                      { key: 'procurement', label: 'Procurement' },
                      { key: 'finance', label: 'Finance & Accounts' },
                      { key: 'documents', label: 'Invoices & Docs' },
                      { key: 'reports', label: 'Reports / BI' },
                      { key: 'settings', label: 'Settings' },
                    ].map((item) => {
                      const isChecked = !!(newEmpForm.accessControl as any)[item.key];
                      return (
                        <label
                          key={item.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: isChecked ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                            backgroundColor: isChecked ? '#EEF2FF' : '#FFFFFF',
                            cursor: 'pointer',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: isChecked ? '#4338CA' : '#475569',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setNewEmpForm({
                                ...newEmpForm,
                                accessControl: {
                                  ...newEmpForm.accessControl,
                                  [item.key]: e.target.checked,
                                },
                              });
                            }}
                            style={{ width: '14px', height: '14px', accentColor: '#4F46E5', cursor: 'pointer' }}
                          />
                          <span>{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Workflow Info: Direct Permanent Password on 1st Login */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    backgroundColor: '#F0FDF4',
                    borderRadius: '12px',
                    border: '1px solid #BBF7D0',
                    fontSize: '0.8rem',
                    color: '#166534',
                    lineHeight: '1.45',
                  }}
                >
                  <KeyRound size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                  <div>
                    <strong>First-Time Login Security Workflow:</strong> Give the assigned <strong>User ID</strong> to the staff member. When they log in at <code>/emplogin</code>, the system will verify their User ID in the database and prompt them to create their secure permanent password. No temporary password needed.
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: '1px solid #F1F5F9',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: '11px 26px',
                    borderRadius: '12px',
                    border: '1.5px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '11px 32px',
                    borderRadius: '12px',
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>Create Login</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Pop-up Credentials Modal when employee is created */}
      {createdCredentialsModal.isOpen && createdCredentialsModal.employee && (
        <Modal
          isOpen={createdCredentialsModal.isOpen}
          onClose={() => setCreatedCredentialsModal({ isOpen: false, employee: null })}
          title="Employee Account Created Successfully!"
          maxWidth="560px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '4px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                backgroundColor: '#F0FDF4',
                borderRadius: '14px',
                border: '1px solid #BBF7D0',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#14532D' }}>
                  {createdCredentialsModal.employee.fullName}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#166534' }}>
                  {createdCredentialsModal.employee.designation} • {createdCredentialsModal.employee.department}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.84rem', color: '#475569', lineHeight: '1.45' }}>
              The employee account has been saved in the dealership database. Share the assigned <strong>User ID</strong> below with the staff member. They will create their permanent secure password directly upon signing in.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* User ID */}
              <div
                className="emp-cred-row"
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                }}
              >
                <div style={{ minWidth: 0, flex: '1 1 160px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Assigned User ID
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E293B', fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
                    {createdCredentialsModal.employee.userId || createdCredentialsModal.employee.employeeCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(createdCredentialsModal.employee!.userId || createdCredentialsModal.employee!.employeeCode, 'cred-id')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    cursor: 'pointer',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copiedId === 'cred-id' ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} />}
                  <span>{copiedId === 'cred-id' ? 'Copied' : 'Copy User ID'}</span>
                </button>
              </div>

              {/* Portal URL */}
              <div
                className="emp-cred-row"
                style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#EEF2FF',
                  border: '1.5px solid #C7D2FE',
                }}
              >
                <div style={{ minWidth: 0, flex: '1 1 160px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#4338CA', fontWeight: 700, textTransform: 'uppercase' }}>
                    Staff Login URL
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#312E81', overflowWrap: 'anywhere' }}>
                    /emplogin
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(`${window.location.origin}/emplogin`, 'cred-url')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #C7D2FE',
                    background: '#FFFFFF',
                    color: '#4F46E5',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copiedId === 'cred-url' ? <Check size={14} style={{ color: '#16A34A' }} /> : <Copy size={14} />}
                  <span>{copiedId === 'cred-url' ? 'Copied' : 'Copy URL'}</span>
                </button>
              </div>

              {/* Security note */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: '#F0FDF4',
                  borderRadius: '10px',
                  border: '1px solid #BBF7D0',
                  fontSize: '0.76rem',
                  color: '#166534',
                }}
              >
                <KeyRound size={15} style={{ flexShrink: 0, color: '#16A34A' }} />
                <span>
                  <strong>First-Time Login Workflow:</strong> No temporary password needed. Staff visits <code>/emplogin</code>, enters this User ID, and creates their own permanent strong password.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setCreatedCredentialsModal({ isOpen: false, employee: null })}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
              <Link
                href={`/emplogin?emp=${encodeURIComponent(createdCredentialsModal.employee.userId || createdCredentialsModal.employee.employeeCode)}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 22px',
                  borderRadius: '10px',
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                }}
              >
                <span>Test Staff Login</span>
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* Leave Balance & Approval Modal */}
      {selectedForLeave && (
        <Modal
          isOpen={!!selectedForLeave}
          onClose={() => setSelectedForLeave(null)}
          title={`Leave Balance & Requests — ${selectedForLeave.fullName}`}
          maxWidth="820px"
        >
          {(() => {
            const lb = normalizeLeaveBalance(selectedForLeave.leaveBalance);
            const casualTotal = lb.casual.total;
            const casualUsed = lb.casual.used;
            const casualRem = Math.max(0, casualTotal - casualUsed);

            const sickTotal = lb.sick.total;
            const sickUsed = lb.sick.used;
            const sickRem = Math.max(0, sickTotal - sickUsed);

            const paidTotal = lb.paid.total;
            const paidUsed = lb.paid.used;
            const paidRem = Math.max(0, paidTotal - paidUsed);

            const totalRem = casualRem + sickRem + paidRem;
            const pendingRequests = (selectedForLeave.leaveHistory || []).filter((lh) => lh.status === 'pending');

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                {/* Leave Balance Overview Cards */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0F172A' }}>
                        Staff Leave Balance
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                        Annual allocated time-off balance for {selectedForLeave.fullName}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '999px',
                        backgroundColor: '#EEF2FF',
                        color: '#4F46E5',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        border: '1px solid #C7D2FE',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      Total Balance: {totalRem} Days Remaining
                    </span>
                  </div>

                  <div className="emp-leave-cards-grid">
                    {/* Casual */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '14px',
                        backgroundColor: '#F8FAFC',
                        border: '1.5px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        Casual Leave
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
                        {casualRem}{' '}
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>
                          / {casualTotal} days
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '3px' }}>
                        Used: {casualUsed} days
                      </div>
                    </div>

                    {/* Sick */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '14px',
                        backgroundColor: '#F8FAFC',
                        border: '1.5px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        Sick Leave
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
                        {sickRem}{' '}
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>
                          / {sickTotal} days
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '3px' }}>
                        Used: {sickUsed} days
                      </div>
                    </div>

                    {/* Paid */}
                    <div
                      style={{
                        padding: '16px 18px',
                        borderRadius: '14px',
                        backgroundColor: '#F8FAFC',
                        border: '1.5px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        Paid Annual Leave
                      </div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', marginTop: '3px' }}>
                        {paidRem}{' '}
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>
                          / {paidTotal} days
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '3px' }}>
                        Used: {paidUsed} days
                      </div>
                    </div>
                  </div>
                </div>

                {/* Leave Requests & Approval Section */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
                        Employee Leave Requests
                      </span>
                      {pendingRequests.length > 0 && (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: '#FEF3C7',
                            color: '#D97706',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            border: '1px solid #FDE68A',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {pendingRequests.length} Pending Approval
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.76rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                      {selectedForLeave.leaveHistory.length} Total Submissions
                    </span>
                  </div>

                  {(!selectedForLeave.leaveHistory || selectedForLeave.leaveHistory.length === 0) ? (
                    <div
                      style={{
                        padding: '32px 20px',
                        borderRadius: '12px',
                        border: '1.5px dashed #CBD5E1',
                        textAlign: 'center',
                        color: '#64748B',
                        fontSize: '0.84rem',
                        backgroundColor: '#F8FAFC',
                      }}
                    >
                      No leave requests submitted by {selectedForLeave.fullName} yet. When this employee requests time off from their Employee Portal, it will appear here with an approval option.
                    </div>
                  ) : (
                    <div className="emp-table-scroll-wrap">
                      <table style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Type</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Dates & Duration</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Reason</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Status</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Approval Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedForLeave.leaveHistory.map((lh) => {
                            const isPending = lh.status === 'pending';
                            const isApproved = lh.status === 'approved';
                            const isRejected = lh.status === 'rejected';

                            return (
                              <tr
                                key={lh.id}
                                style={{
                                  borderBottom: '1px solid #F1F5F9',
                                  backgroundColor: isPending ? 'rgba(245, 158, 11, 0.04)' : undefined,
                                }}
                              >
                                <td style={{ padding: '12px 14px' }}>
                                  <span
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: '#EEF2FF',
                                      color: '#4F46E5',
                                      fontWeight: 800,
                                      fontSize: '0.74rem',
                                      textTransform: 'capitalize',
                                    }}
                                  >
                                    {lh.leaveType}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <div style={{ fontWeight: 700, color: '#0F172A' }}>
                                    {lh.startDate} to {lh.endDate}
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                    {lh.days} {lh.days === 1 ? 'day' : 'days'}
                                  </div>
                                </td>
                                <td style={{ padding: '12px 14px', color: '#334155' }}>
                                  {lh.reason || 'Personal leave'}
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  {isPending && (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '3px 9px',
                                        borderRadius: '999px',
                                        background: '#FEF3C7',
                                        color: '#D97706',
                                        border: '1px solid #FDE68A',
                                      }}
                                    >
                                      PENDING
                                    </span>
                                  )}
                                  {isApproved && (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '3px 9px',
                                        borderRadius: '999px',
                                        background: '#ECFDF5',
                                        color: '#059669',
                                        border: '1px solid #A7F3D0',
                                      }}
                                    >
                                      APPROVED
                                    </span>
                                  )}
                                  {isRejected && (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '3px 9px',
                                        borderRadius: '999px',
                                        background: '#FEF2F2',
                                        color: '#DC2626',
                                        border: '1px solid #FECACA',
                                      }}
                                    >
                                      REJECTED
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                  {isPending ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleApproveLeave(lh.id, true)}
                                        style={{
                                          padding: '6px 12px',
                                          borderRadius: '8px',
                                          backgroundColor: '#10B981',
                                          color: '#FFFFFF',
                                          fontSize: '0.76rem',
                                          fontWeight: 800,
                                          border: 'none',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)',
                                        }}
                                      >
                                        <CheckCircle2 size={13} />
                                        <span>Accept</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleApproveLeave(lh.id, false)}
                                        style={{
                                          padding: '6px 12px',
                                          borderRadius: '8px',
                                          backgroundColor: '#FFFFFF',
                                          color: '#DC2626',
                                          border: '1px solid #FECACA',
                                          fontSize: '0.76rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        <XCircle size={13} />
                                        <span>Reject</span>
                                      </button>
                                    </div>
                                  ) : isApproved ? (
                                    <span style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 600 }}>
                                      ✓ Approved by {lh.approvedBy || 'Admin'}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.76rem', color: '#94A3B8' }}>
                                      ✕ Declined
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Access Control Modal */}
      {selectedForAccess && (
        <Modal
          isOpen={!!selectedForAccess}
          onClose={() => setSelectedForAccess(null)}
          title={`Section Access Control — ${selectedForAccess.fullName}`}
          maxWidth="640px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="emp-modal-grid-2">
              {[
                { key: 'pipeline' as const, label: 'Pipeline & Leads' },
                { key: 'customers' as const, label: 'Customers' },
                { key: 'inventory' as const, label: 'Inventory Stock' },
                { key: 'procurement' as const, label: 'Procurement' },
                { key: 'deals' as const, label: 'Deals & Closing' },
                { key: 'finance' as const, label: 'Finance & Invoices' },
                { key: 'testDrives' as const, label: 'Test Drives' },
                { key: 'documents' as const, label: 'Documents & RTO' },
                { key: 'reports' as const, label: 'Reports' },
                { key: 'settings' as const, label: 'Settings & Administration' },
              ].map((s) => {
                const checked = selectedForAccess.accessControl[s.key];
                return (
                  <div
                    key={s.key}
                    onClick={() => handleToggleAccess(s.key)}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      border: checked ? '1.5px solid #10B981' : '1.5px solid #E2E8F0',
                      backgroundColor: checked ? '#F0FDF4' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: checked ? '#166534' : '#0F172A',
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => {}} style={{ accentColor: '#10B981' }} />
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================
          CENTERED EMPLOYEE PROFILE CARD DOSSIER MODAL
          (Styled identically to Image 2 Customer Lead Dossier, supports edit mode)
          ======================================================== */}
      {selectedProfileCardEmp && (
        <Modal
          isOpen={!!selectedProfileCardEmp}
          onClose={() => {
            setSelectedProfileCardEmp(null);
            setIsEditingDossier(false);
          }}
          maxWidth="680px"
          headerContent={
            <div className="emp-dossier-header">
              <div className="emp-dossier-title">
                Staff &amp; Employee Dossier
              </div>
              <span
                className="badge emp-dossier-dept-badge"
                style={{
                  background: '#EEF2FF',
                  color: '#4338CA',
                  border: '1px solid rgba(79, 70, 229, 0.25)',
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                Dept: {selectedProfileCardEmp.department}
              </span>
            </div>
          }
          headerActions={
            <div className="modal-header-actions">
              <button
                type="button"
                onClick={() => setIsEditingDossier((prev) => !prev)}
                className="modal-header-edit-btn emp-dossier-header-edit-btn"
                style={{
                  border: '1px solid #E2E8F0',
                  background: isEditingDossier ? '#0284C7' : '#FFFFFF',
                  color: isEditingDossier ? '#FFFFFF' : '#0F172A',
                }}
              >
                {isEditingDossier ? (
                  <>
                    <Check size={13} />
                    <span>
                      View<span className="emp-hide-xs"> Mode</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Pencil size={13} />
                    <span>
                      Edit<span className="emp-hide-xs"> Details</span>
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedProfileCardEmp(null);
                  setIsEditingDossier(false);
                }}
                className="modal-header-close-btn"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748B',
                  flexShrink: 0,
                }}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
          }
          footer={
            <div className="unique-modal-footer-bar">
              <button
                type="button"
                onClick={() => {
                  setSelectedProfileCardEmp(null);
                  setIsEditingDossier(false);
                }}
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: '999px', padding: '0.45rem 1.2rem', whiteSpace: 'nowrap' }}
              >
                &lt; Cancel
              </button>
              {isEditingDossier ? (
                <button
                  type="button"
                  onClick={handleSaveDossierChanges}
                  className="unique-lead-submit-btn"
                  style={{
                    borderRadius: '999px',
                    padding: '0.5rem 1.35rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>Save Changes</span>
                  <Check size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDossier(true)}
                  className="unique-lead-submit-btn"
                  style={{
                    borderRadius: '999px',
                    padding: '0.5rem 1.35rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>Edit Details</span>
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 1. Identity & Profile Banner (Styled identically to Image 2) */}
            <div className="emp-dossier-banner">
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: '#0284C7',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  letterSpacing: '0.02em',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                  flexShrink: 0,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {(isEditingDossier ? editDossierForm.avatarUrl : selectedProfileCardEmp.avatarUrl) ? (
                  <img
                    src={(isEditingDossier ? editDossierForm.avatarUrl : selectedProfileCardEmp.avatarUrl)}
                    alt={selectedProfileCardEmp.fullName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  selectedProfileCardEmp.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {isEditingDossier ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="emp-dossier-edit-row">
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Full Name</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ height: '32px', fontSize: '0.82rem' }}
                          value={editDossierForm.fullName || ''}
                          onChange={(e) => setEditDossierForm({ ...editDossierForm, fullName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>Department</label>
                        <select
                          className="form-select"
                          style={{ height: '32px', fontSize: '0.82rem' }}
                          value={editDossierForm.department || 'Sales'}
                          onChange={(e) => setEditDossierForm({ ...editDossierForm, department: e.target.value as any })}
                        >
                          <option value="Sales">Sales</option>
                          <option value="Finance">Finance</option>
                          <option value="Operations">Operations</option>
                          <option value="Service">Service</option>
                          <option value="Management">Management</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#0F172A',
                          cursor: 'pointer',
                        }}
                      >
                        <Camera size={12} style={{ color: '#0284C7' }} />
                        <span>Change Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageFileChange(e, 'edit')}
                          style={{ display: 'none' }}
                        />
                      </label>
                      {editDossierForm.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setEditDossierForm({ ...editDossierForm, avatarUrl: '' })}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #FCA5A5',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={11} /> Remove Photo
                        </button>
                      )}
                    </div>
                    {/* Quick Avatar Presets in Dossier */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600 }}>Presets:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {PRESET_AVATARS.slice(0, 5).map((preset, idx) => (
                          <img
                            key={idx}
                            src={preset}
                            alt="Preset avatar"
                            onClick={() => setEditDossierForm((prev) => ({ ...prev, avatarUrl: preset }))}
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              objectFit: 'cover',
                              cursor: 'pointer',
                              border: editDossierForm.avatarUrl === preset ? '2px solid #0284C7' : '1px solid #CBD5E1',
                              transition: 'transform 0.1s ease',
                            }}
                            title="Click to select this photo"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#0F172A' }}>
                        {selectedProfileCardEmp.fullName}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: '#E0F2FE',
                          color: '#0369A1',
                          border: '1px solid rgba(2, 132, 199, 0.25)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {selectedProfileCardEmp.userId || selectedProfileCardEmp.employeeCode}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: '#EEF2FF',
                          color: '#4338CA',
                          border: '1px solid rgba(79, 70, 229, 0.25)',
                        }}
                      >
                        {selectedProfileCardEmp.department}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: '#DCFCE7',
                          color: '#15803D',
                          border: '1px solid rgba(22, 163, 74, 0.25)',
                        }}
                      >
                        Active Staff ✓
                      </span>
                    </div>

                    <div className="emp-dossier-contact-row">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                        <Phone size={13} style={{ color: '#0284C7', flexShrink: 0 }} />
                        {selectedProfileCardEmp.phone ? (
                          <a href={`tel:${selectedProfileCardEmp.phone}`} style={{ color: '#0F172A', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                            {selectedProfileCardEmp.phone}
                          </a>
                        ) : (
                          <span style={{ color: '#94A3B8', fontWeight: 500 }}>No phone</span>
                        )}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: 0, overflowWrap: 'anywhere' }}>
                        <Mail size={13} style={{ color: '#0284C7', flexShrink: 0 }} />
                        {selectedProfileCardEmp.email ? (
                          <a href={`mailto:${selectedProfileCardEmp.email}`} style={{ color: '#0F172A', fontWeight: 700, textDecoration: 'none', overflowWrap: 'anywhere' }}>
                            {selectedProfileCardEmp.email}
                          </a>
                        ) : (
                          <span style={{ color: '#94A3B8', fontWeight: 500 }}>No email</span>
                        )}
                      </span>
                      {selectedProfileCardEmp.branch && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                          <MapPin size={13} style={{ color: '#0284C7', flexShrink: 0 }} />
                          <span>{selectedProfileCardEmp.branch}</span>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 2. Grid of Information Cards (Styled identically to Image 2) */}
            <div className="emp-dossier-grid">
              {/* Card 1: CRM Login Credentials */}
              <div className="emp-dossier-card">
                <div className="emp-dossier-card-head">
                  <span className="emp-dossier-card-label">
                    CRM Login Credentials
                  </span>
                  {selectedProfileCardEmp.isPasswordSet ? (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Permanent Active ✓
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#D97706', background: '#FEF3C7', padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Password Pending
                    </span>
                  )}
                </div>

                {isEditingDossier ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>User ID</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700, color: '#0284C7' }}
                      value={editDossierForm.userId || editDossierForm.employeeCode || ''}
                      onChange={(e) => setEditDossierForm({ ...editDossierForm, userId: e.target.value.toLowerCase().replace(/\s+/g, ''), employeeCode: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                      placeholder="e.g. fsafa"
                    />
                  </div>
                ) : (
                  <div className="emp-dossier-kv-list">
                    <div className="emp-dossier-kv-row">
                      <span className="emp-dossier-kv-key">User ID:</span>
                      <div className="emp-dossier-kv-val">
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284C7', overflowWrap: 'anywhere' }}>
                          {selectedProfileCardEmp.userId || selectedProfileCardEmp.employeeCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedProfileCardEmp.userId || selectedProfileCardEmp.employeeCode, `id-${selectedProfileCardEmp.id}`)}
                          style={{ background: 'none', border: 'none', color: '#0284C7', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                          title="Copy User ID"
                        >
                          {copiedId === `id-${selectedProfileCardEmp.id}` ? <Check size={13} style={{ color: '#10B981' }} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="emp-dossier-kv-row">
                      <span className="emp-dossier-kv-key">Password:</span>
                      <span
                        className="emp-dossier-kv-val"
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          color: selectedProfileCardEmp.isPasswordSet ? '#16A34A' : '#D97706',
                        }}
                      >
                        {selectedProfileCardEmp.isPasswordSet ? '•••••••• (Encrypted in DB)' : 'Pending 1st Login'}
                      </span>
                    </div>

                    <div className="emp-dossier-card-foot">
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8', lineHeight: 1.3 }}>
                        {selectedProfileCardEmp.isPasswordSet ? 'Set & verified in database' : 'Creates password at /emplogin'}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await resetEmployeePassword(selectedProfileCardEmp.id);
                          if (res.success) {
                            const updated = getEmployees().find((e) => e.id === selectedProfileCardEmp.id);
                            setSelectedProfileCardEmp(updated || null);
                            setEmployees(getEmployees());
                            showToast(`Password reset. Staff can set a fresh permanent password at /emplogin.`);
                          } else {
                            triggerErrorPopup(res.error || 'Failed to reset employee password in database.', 'Reset Failed');
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4F46E5',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                        title="Reset password so employee can set a new permanent password on next login"
                      >
                        <RefreshCw size={11} style={{ flexShrink: 0 }} />
                        <span>Reset Password</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: Designation & Compensation */}
              <div className="emp-dossier-card">
                <span className="emp-dossier-card-label">
                  Designation &amp; Compensation
                </span>

                {isEditingDossier ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#64748B' }}>Designation</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '30px', fontSize: '0.8rem' }}
                        value={editDossierForm.designation || ''}
                        onChange={(e) => setEditDossierForm({ ...editDossierForm, designation: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: '#64748B' }}>Monthly Salary</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '30px', fontSize: '0.8rem' }}
                        value={editDossierForm.salary || ''}
                        onChange={(e) => setEditDossierForm({ ...editDossierForm, salary: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0F172A' }}>
                      {selectedProfileCardEmp.designation}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: selectedProfileCardEmp.salary ? '#16A34A' : '#94A3B8', fontWeight: 800 }}>
                      {selectedProfileCardEmp.salary ? (
                        <>
                          {selectedProfileCardEmp.salary}{' '}
                          <span style={{ color: '#64748B', fontWeight: 500 }}>({selectedProfileCardEmp.salaryCategory || 'Annual CTC'})</span>
                        </>
                      ) : (
                        'Salary Not Set'
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                      Joined: {selectedProfileCardEmp.joiningDate}
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Leave Record Balances */}
              <div className="emp-dossier-card">
                <div className="emp-dossier-card-head">
                  <span className="emp-dossier-card-label">
                    Leave Record Balances
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedForLeave(selectedProfileCardEmp)}
                    style={{ background: 'none', border: 'none', color: '#0284C7', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Leave Logs ({selectedProfileCardEmp.leaveHistory?.length || 0}) &rarr;
                  </button>
                </div>

                {(() => {
                  const lb = normalizeLeaveBalance(selectedProfileCardEmp.leaveBalance);
                  const casualTot = lb.casual.total;
                  const casualUsed = lb.casual.used;
                  const sickTot = lb.sick.total;
                  const sickUsed = lb.sick.used;
                  const paidTot = lb.paid.total;
                  const paidUsed = lb.paid.used;

                  return (
                    <div className="emp-leave-mini-grid">
                      <div className="emp-leave-mini-box">
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>CASUAL</div>
                        <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.25, margin: '2px 0' }}>
                          {Math.max(0, casualTot - casualUsed)}
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>of {casualTot} left</div>
                      </div>

                      <div className="emp-leave-mini-box">
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>SICK</div>
                        <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.25, margin: '2px 0' }}>
                          {Math.max(0, sickTot - sickUsed)}
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>of {sickTot} left</div>
                      </div>

                      <div className="emp-leave-mini-box">
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>PAID</div>
                        <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.25, margin: '2px 0' }}>
                          {Math.max(0, paidTot - paidUsed)}
                        </div>
                        <div style={{ fontSize: '0.64rem', color: '#94A3B8', whiteSpace: 'nowrap' }}>of {paidTot} left</div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Card 4: Authorized CRM Sections */}
              <div className="emp-dossier-card">
                <div className="emp-dossier-card-head">
                  <span className="emp-dossier-card-label">
                    Authorized CRM Sections
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748B', whiteSpace: 'nowrap', flexShrink: 0 }}>Click to toggle</span>
                </div>

                <div className="emp-section-chips">
                  {[
                    { key: 'pipeline' as const, label: 'Pipeline' },
                    { key: 'customers' as const, label: 'Customers' },
                    { key: 'inventory' as const, label: 'Inventory' },
                    { key: 'procurement' as const, label: 'Procurement' },
                    { key: 'deals' as const, label: 'Deals' },
                    { key: 'finance' as const, label: 'Finance' },
                    { key: 'testDrives' as const, label: 'Test Drives' },
                    { key: 'documents' as const, label: 'Documents' },
                    { key: 'reports' as const, label: 'Reports' },
                    { key: 'settings' as const, label: 'Settings' },
                  ].map((s) => {
                    const currentAccess = isEditingDossier && editDossierForm.accessControl
                      ? editDossierForm.accessControl[s.key]
                      : selectedProfileCardEmp.accessControl[s.key];

                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          if (isEditingDossier) {
                            const updatedAccess = {
                              ...(editDossierForm.accessControl || selectedProfileCardEmp.accessControl),
                              [s.key]: !currentAccess,
                            };
                            setEditDossierForm({ ...editDossierForm, accessControl: updatedAccess });
                          } else {
                            handleToggleCardAccess(s.key);
                          }
                        }}
                        title={`Click to ${currentAccess ? 'revoke' : 'grant'} ${s.label}`}
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '4px 9px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: currentAccess ? '#ECFDF5' : '#F8FAFC',
                          color: currentAccess ? '#065F46' : '#94A3B8',
                          border: currentAccess ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontSize: '0.76rem' }}>{currentAccess ? '✓' : '✕'}</span>
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Global Error Pop-up Modal */}
      <ErrorPopup listenGlobal={true} />
    </div>
  );
}
