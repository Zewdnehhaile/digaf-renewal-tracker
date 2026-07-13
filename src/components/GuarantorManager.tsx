// src/components/GuarantorManager.tsx
import React, { useState, useEffect, useRef } from 'react';
import { User, Guarantor, ActiveLoan } from '../types';
import { dbService } from '../services/db';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Users,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  UserCheck,
  UserX,
  Upload,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface GuarantorManagerProps {
  currentUser: User;
}

export default function GuarantorManager({ currentUser }: GuarantorManagerProps) {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loanFilter, setLoanFilter] = useState<'all' | 'has_loan' | 'overdue'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGuarantor, setEditingGuarantor] = useState<Guarantor | null>(null);
  const [formData, setFormData] = useState({
    guarantorName: '',
    phoneNumber: '',
    customerName: '',
    customerId: '',
    assignmentDate: '',
    expiryDate: '',
    status: 'Active' as 'Active' | 'Expired',
    loanPeriod: '3M' as '2M' | '3M' | '6M' | '1Y'
  });
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    show: boolean;
    imported: number;
    skipped: number;
    failed: number;
    errors?: string[];
  }>({ show: false, imported: 0, skipped: 0, failed: 0 });

  // Search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [guarantorSearch, setGuarantorSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<ActiveLoan[]>([]);
  const [guarantorResults, setGuarantorResults] = useState<ActiveLoan[]>([]);
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const [showGuarantorResults, setShowGuarantorResults] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [searchingGuarantor, setSearchingGuarantor] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ActiveLoan | null>(null);
  const [selectedGuarantor, setSelectedGuarantor] = useState<ActiveLoan | null>(null);
  const customerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const guarantorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [loanStatusMap, setLoanStatusMap] = useState<Map<string, { hasLoan: boolean; isOverdue: boolean }>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Calculate expiry date from loan period
  const calculateExpiryFromPeriod = (assignmentDate: string, period: string): string => {
    if (!assignmentDate) return '';
    const months = parseInt(period);
    if (isNaN(months)) return '';
    const date = new Date(assignmentDate);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  // Get today's date
  const getToday = () => new Date().toISOString().split('T')[0];

  // Search customers from Active Loans
  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setCustomerResults([]);
      setShowCustomerResults(false);
      return;
    }

    setSearchingCustomer(true);
    try {
      const allLoans = await dbService.getActiveLoans();
      const results = allLoans.filter((loan: ActiveLoan) =>
        loan.name.toLowerCase().includes(query.toLowerCase()) ||
        loan.phoneNumber.includes(query)
      );
      setCustomerResults(results);
      setShowCustomerResults(results.length > 0);
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomerResults([]);
    } finally {
      setSearchingCustomer(false);
    }
  };

  // Search guarantors from Active Loans
  const searchGuarantors = async (query: string) => {
    if (!query || query.length < 2) {
      setGuarantorResults([]);
      setShowGuarantorResults(false);
      return;
    }

    setSearchingGuarantor(true);
    try {
      const allLoans = await dbService.getActiveLoans();
      const results = allLoans.filter((loan: ActiveLoan) =>
        loan.name.toLowerCase().includes(query.toLowerCase()) ||
        loan.phoneNumber.includes(query)
      );
      setGuarantorResults(results);
      setShowGuarantorResults(results.length > 0);
    } catch (error) {
      console.error('Error searching guarantors:', error);
      setGuarantorResults([]);
    } finally {
      setSearchingGuarantor(false);
    }
  };

  // Handle customer search with debounce
  const handleCustomerSearch = (value: string) => {
    setCustomerSearch(value);
    setSelectedCustomer(null);

    if (customerTimeoutRef.current) {
      clearTimeout(customerTimeoutRef.current);
    }

    customerTimeoutRef.current = setTimeout(() => {
      searchCustomers(value);
    }, 300);
  };

  // Handle guarantor search with debounce
  const handleGuarantorSearch = (value: string) => {
    setGuarantorSearch(value);
    setSelectedGuarantor(null);

    if (guarantorTimeoutRef.current) {
      clearTimeout(guarantorTimeoutRef.current);
    }

    guarantorTimeoutRef.current = setTimeout(() => {
      searchGuarantors(value);
    }, 300);
  };

  // Select customer from search results
  const selectCustomer = (customer: ActiveLoan) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setShowCustomerResults(false);

    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      customerId: customer.id || '',
      assignmentDate: getToday(),
      expiryDate: calculateExpiryFromPeriod(getToday(), prev.loanPeriod || '3M')
    }));
  };

  // Select guarantor from search results
  const selectGuarantor = (guarantor: ActiveLoan) => {
    // Check if this guarantor has overdue loan (check by status OR expiryDate)
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = guarantor.status === 'Overdue' ||
      guarantor.status === 'Expired' ||
      (guarantor.expiryDate && guarantor.expiryDate < today);

    // Check if this person is a customer
    const isCustomer = guarantor.status === 'Active' ||
      guarantor.status === 'Overdue' ||
      guarantor.status === 'Expired';

    // Determine the correct status display
    let displayStatus = guarantor.status;
    if (isOverdue && displayStatus === 'Active') {
      displayStatus = 'Overdue (based on expiry date)';
    }

    if (isOverdue) {
      // Show warning with confirm option
      const confirmAdd = confirm(
        `⚠️ WARNING: This person has an OVERDUE loan!\n\n` +
        `Name: ${guarantor.name}\n` +
        `Status: ${displayStatus}\n\n` +
        `They are also a customer in the system.\n\n` +
        `Are you sure you want to add them as a guarantor?\n\n` +
        `⚠️ This action is not recommended for overdue customers.`
      );

      if (!confirmAdd) {
        return; // User cancelled
      }
    } else if (isCustomer) {
      // Show info that they are a customer but not overdue
      const confirmAdd = confirm(
        `ℹ️ INFO: This person is already a customer.\n\n` +
        `Name: ${guarantor.name}\n` +
        `Status: ${guarantor.status}\n\n` +
        `Are you sure you want to add them as a guarantor?`
      );

      if (!confirmAdd) {
        return; // User cancelled
      }
    }

    // Proceed with selection
    setSelectedGuarantor(guarantor);
    setGuarantorSearch(guarantor.name);
    setShowGuarantorResults(false);

    setFormData(prev => ({
      ...prev,
      guarantorName: guarantor.name,
      phoneNumber: guarantor.phoneNumber
    }));
  };
  // Handle loan period change
  const handleLoanPeriodChange = (period: '2M' | '3M' | '6M' | '1Y') => {
    setFormData(prev => ({
      ...prev,
      loanPeriod: period,
      expiryDate: calculateExpiryFromPeriod(prev.assignmentDate || getToday(), period)
    }));
  };

  // Handle assignment date change
  const handleAssignmentDateChange = (date: string) => {
    setFormData(prev => ({
      ...prev,
      assignmentDate: date,
      expiryDate: calculateExpiryFromPeriod(date, prev.loanPeriod)
    }));
  };

  // Check how many active guarantors a customer has
  const getGuarantorCount = (customerName: string): number => {
    return guarantors.filter(g =>
      g.customerName.toLowerCase() === customerName.toLowerCase() &&
      g.status === 'Active'
    ).length;
  };

  // Check if customer can have more guarantors
  const canAddGuarantor = (customerName: string): boolean => {
    return getGuarantorCount(customerName) < 3;
  };

  // Get remaining guarantor slots
  const getRemainingSlots = (customerName: string): number => {
    return 3 - getGuarantorCount(customerName);
  };

  // Check if guarantor has overdue loan (includes expiry date check)
  const checkGuarantorOverdue = async (name: string, phone: string): Promise<boolean> => {
    try {
      const loans = await dbService.getActiveLoans();
      const found = loans.find((loan: ActiveLoan) =>
        loan.name.toLowerCase() === name.toLowerCase() ||
        loan.phoneNumber === phone
      );
      if (!found) return false;

      const today = new Date().toISOString().split('T')[0];
      return found.status === 'Overdue' ||
        found.status === 'Expired' ||
        (found.expiryDate && found.expiryDate < today);
    } catch (error) {
      console.error('Error checking guarantor overdue:', error);
      return false;
    }
  };

  // Fetch loan status for all guarantors
  useEffect(() => {
    const fetchLoanStatus = async () => {
      if (guarantors.length === 0) return;
      try {
        const loans = await dbService.getActiveLoans();
        const statusMap = new Map();
        const today = new Date().toISOString().split('T')[0];

        guarantors.forEach((g) => {
          // Find if this guarantor is also a customer (by name or phone)
          const customerLoan = loans.find((loan: any) =>
            loan.name.toLowerCase() === g.customerName.toLowerCase() ||
            loan.phoneNumber === g.phoneNumber ||
            loan.name.toLowerCase() === g.guarantorName.toLowerCase()
          );

          if (customerLoan) {
            // Check if loan is overdue (status OR expiryDate)
            const isOverdue = customerLoan.status === 'Overdue' ||
              customerLoan.status === 'Expired' ||
              (customerLoan.expiryDate && customerLoan.expiryDate < today);

            statusMap.set(g.id, {
              hasLoan: true,
              isOverdue: isOverdue
            });
          } else {
            statusMap.set(g.id, {
              hasLoan: false,
              isOverdue: false
            });
          }
        });

        setLoanStatusMap(statusMap);
      } catch (error) {
        console.error('Error fetching loan status:', error);
      }
    };
    fetchLoanStatus();
  }, [guarantors]);

  const fetchGuarantors = async () => {
    try {
      const data = await dbService.getGuarantors();
      const today = new Date().toISOString().split('T')[0];
      const updated = data.map((g: Guarantor) => {
        if (g.status === 'Active' && g.expiryDate < today) {
          return { ...g, status: 'Expired' };
        }
        return g;
      });
      setGuarantors(updated);
    } catch (error) {
      console.error('Error fetching guarantors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuarantors();
  }, []);

  const filteredGuarantors = guarantors.filter(g => {
    const matchesSearch =
      g.guarantorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.phoneNumber.includes(searchQuery) ||
      g.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    const loanStatus = loanStatusMap.get(g.id);
    if (loanFilter === 'has_loan') {
      return loanStatus?.hasLoan === true;
    }
    if (loanFilter === 'overdue') {
      return loanStatus?.isOverdue === true;
    }
    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredGuarantors.length / itemsPerPage);
  const paginatedGuarantors = filteredGuarantors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const calculateExpiryDate = (assignmentDate: string): string => {
    const date = new Date(assignmentDate);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  };

  const checkDuplicate = async (guarantorName: string, phoneNumber: string, excludeId?: string): Promise<boolean> => {
    try {
      const existingGuarantors = await dbService.getGuarantors();
      return existingGuarantors.some(g =>
        g.guarantorName.toLowerCase() === guarantorName.toLowerCase() &&
        g.phoneNumber === phoneNumber &&
        g.status === 'Active' &&
        g.id !== excludeId
      );
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if customer has reached max guarantors
    if (formData.customerName) {
      const count = getGuarantorCount(formData.customerName);
      if (count >= 3) {
        alert(`⚠️ This customer already has ${count} active guarantors.\n\nMaximum limit is 3 guarantors per customer.`);
        return;
      }
    }

    // Check if guarantor has overdue loan (with expiry date check)
    if (formData.guarantorName) {
      const isOverdue = await checkGuarantorOverdue(formData.guarantorName, formData.phoneNumber);
      if (isOverdue) {
        const confirmAdd = confirm(
          `⚠️ WARNING: This person has an OVERDUE loan!\n\n` +
          `Name: ${formData.guarantorName}\n\n` +
          `Are you sure you want to assign them as a guarantor?\n\n` +
          `⚠️ This action is not recommended for overdue customers.`
        );
        if (!confirmAdd) {
          return;
        }
      }
    }

    const isDuplicate = await checkDuplicate(
      formData.guarantorName,
      formData.phoneNumber,
      editingGuarantor?.id
    );
    if (isDuplicate) {
      alert('⚠️ This guarantor (name and phone) is already active and guaranteeing another customer.\n\nPlease wait until the current guarantee expires or change the status to Expired.');
      return;
    }
    try {
      if (editingGuarantor) {
        await dbService.updateGuarantor(editingGuarantor.id, formData);
        alert('✅ Guarantor updated successfully!');
      } else {
        await dbService.addGuarantor({
          ...formData,
          assignedBy: currentUser.fullName
        });
        alert('✅ Guarantor assigned successfully!');
      }
      setShowAddForm(false);
      setEditingGuarantor(null);
      setSelectedCustomer(null);
      setSelectedGuarantor(null);
      setCustomerSearch('');
      setGuarantorSearch('');
      setCustomerResults([]);
      setGuarantorResults([]);
      setFormData({
        guarantorName: '',
        phoneNumber: '',
        customerName: '',
        customerId: '',
        assignmentDate: '',
        expiryDate: '',
        status: 'Active',
        loanPeriod: '3M'
      });
      fetchGuarantors();
    } catch (error) {
      console.error('Error saving guarantor:', error);
      alert('❌ Failed to save guarantor.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete guarantor "${name}"?`)) return;
    try {
      await dbService.deleteGuarantor(id);
      alert('✅ Guarantor deleted successfully!');
      fetchGuarantors();
    } catch (error) {
      console.error('Error deleting guarantor:', error);
      alert('❌ Failed to delete guarantor.');
    }
  };

  const handleEdit = (guarantor: Guarantor) => {
    setEditingGuarantor(guarantor);
    setSelectedCustomer(null);
    setSelectedGuarantor(null);
    setCustomerSearch(guarantor.customerName);
    setGuarantorSearch(guarantor.guarantorName);
    setFormData({
      guarantorName: guarantor.guarantorName,
      phoneNumber: guarantor.phoneNumber,
      customerName: guarantor.customerName,
      customerId: guarantor.customerId || '',
      assignmentDate: guarantor.assignmentDate,
      expiryDate: guarantor.expiryDate,
      status: guarantor.status,
      loanPeriod: '3M'
    });
    setShowAddForm(true);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportSummary({ show: false, imported: 0, skipped: 0, failed: 0 });
    setImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      if (workbook.SheetNames.length === 0) {
        alert('❌ The Excel file appears to be empty or corrupted.');
        setImporting(false);
        e.target.value = '';
        return;
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });

      if (!jsonData || jsonData.length === 0) {
        alert('⚠️ The Excel file is empty. Please add data and try again.');
        setImporting(false);
        e.target.value = '';
        return;
      }

      const headers = Object.keys(jsonData[0] || {});
      const nameColumn = headers.find(h =>
        ['name', 'full name', 'guarantor name', 'customer name'].some(col =>
          h.toLowerCase().trim() === col
        )
      );
      const phoneColumn = headers.find(h =>
        ['phone', 'phone number', 'mobile', 'telephone'].some(col =>
          h.toLowerCase().trim() === col
        )
      );

      if (!nameColumn || !phoneColumn) {
        alert('❌ Could not find required columns in the Excel file.\n\nPlease ensure your file has columns named:\n• Name (or Full Name, Guarantor Name, Customer Name)\n• Phone (or Phone Number, Mobile, Telephone)');
        setImporting(false);
        e.target.value = '';
        return;
      }

      const today = getToday();
      const existingGuarantors = await dbService.getGuarantors();
      const validGuarantors: Array<{
        guarantor: Omit<Guarantor, 'id'>;
        rowIndex: number;
        rowData: any;
      }> = [];
      const skippedDuplicates: string[] = [];
      const failedRows: Array<{ rowIndex: number; error: string }> = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const nameCell = row[nameColumn];
        const phoneCell = row[phoneColumn];
        const name = String(nameCell || '').trim();
        const phone = String(phoneCell || '').trim();

        if (!name && !phone) continue;
        if (!name || !phone) {
          failedRows.push({
            rowIndex: i + 1,
            error: `Missing ${!name ? 'Name' : 'Phone'} column data`
          });
          continue;
        }

        const isDuplicate = existingGuarantors.some(g =>
          g.guarantorName.toLowerCase() === name.toLowerCase() &&
          g.phoneNumber === phone &&
          g.status === 'Active'
        );

        if (isDuplicate) {
          skippedDuplicates.push(`${name} (${phone})`);
          continue;
        }

        const expiryDate = calculateExpiryDate(today);

        validGuarantors.push({
          guarantor: {
            guarantorName: name,
            phoneNumber: phone,
            customerName: '',
            customerId: '',
            assignmentDate: today,
            expiryDate: expiryDate,
            status: 'Active',
            assignedBy: currentUser.fullName,
            createdAt: new Date().toISOString()
          },
          rowIndex: i + 1,
          rowData: row
        });
      }

      let importedCount = 0;
      let failedCount = 0;
      const importErrors: string[] = [];

      // First: Check duplicates for ALL rows
      const loansToImport = [];
      for (const item of validGuarantors) {
        const stillDuplicate = await checkDuplicate(
          item.guarantor.guarantorName,
          item.guarantor.phoneNumber
        );
        if (stillDuplicate) {
          skippedDuplicates.push(`${item.guarantor.guarantorName} (${item.guarantor.phoneNumber})`);
        } else {
          loansToImport.push(item.guarantor);
        }
      }

      // SECOND: BULK IMPORT - ONE API CALL FOR ALL!
      if (loansToImport.length > 0) {
        try {
          const result = await dbService.importGuarantors(loansToImport);
          importedCount = result.count || loansToImport.length;
        } catch (error) {
          console.error('Error bulk importing guarantors:', error);
          for (const loan of loansToImport) {
            try {
              await dbService.addGuarantor(loan);
              importedCount++;
            } catch (err) {
              console.error('Error importing loan:', err);
              failedCount++;
              importErrors.push(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }
        }
      }

      const summary = {
        show: true,
        imported: importedCount,
        skipped: skippedDuplicates.length,
        failed: failedCount + failedRows.length,
        errors: [...importErrors, ...failedRows.map(f => `Row ${f.rowIndex}: ${f.error}`)]
      };
      setImportSummary(summary);

      await fetchGuarantors();

      let message = `📊 Import Summary\n\n`;
      message += `✅ Imported: ${summary.imported}\n`;
      message += `⏭️ Skipped (duplicates): ${summary.skipped}\n`;
      message += `❌ Failed: ${summary.failed}`;

      if (summary.skipped > 0) {
        message += `\n\n⚠️ Skipped duplicates:\n${skippedDuplicates.slice(0, 10).join('\n')}`;
        if (skippedDuplicates.length > 10) {
          message += `\n... and ${skippedDuplicates.length - 10} more`;
        }
      }

      if (summary.failed > 0 && summary.errors && summary.errors.length > 0) {
        message += `\n\n❌ Failed rows:\n${summary.errors.slice(0, 5).join('\n')}`;
        if (summary.errors.length > 5) {
          message += `\n... and ${summary.errors.length - 5} more`;
        }
      }

      alert(message);

    } catch (error) {
      console.error('Fatal error importing Excel:', error);
      alert('❌ Failed to import Excel file.\n\nPlease check:\n• File is a valid .xlsx or .xls format\n• File is not corrupted\n• File has proper column headers');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const activeCount = guarantors.filter(g => g.status === 'Active').length;
  const expiredCount = guarantors.filter(g => g.status === 'Expired').length;

  useEffect(() => {
    if (importSummary.show) {
      const timer = setTimeout(() => {
        setImportSummary(prev => ({ ...prev, show: false }));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [importSummary.show]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Import Summary Toast */}
      {importSummary.show && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white border rounded-2xl shadow-xl p-4 animate-slide-in ${importSummary.failed > 0 ? 'border-amber-200' : 'border-emerald-200'}`}>
          <div className="flex items-start gap-3">
            {importSummary.failed === 0 && importSummary.skipped === 0 ? (
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : importSummary.failed > 0 ? (
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-800">Import Complete</h4>
              <div className="text-xs text-slate-600 space-y-0.5 mt-1">
                <p>✅ Imported: <span className="font-bold text-emerald-600">{importSummary.imported}</span></p>
                {importSummary.skipped > 0 && (
                  <p>⏭️ Skipped duplicates: <span className="font-bold text-amber-600">{importSummary.skipped}</span></p>
                )}
                {importSummary.failed > 0 && (
                  <p>❌ Failed: <span className="font-bold text-rose-600">{importSummary.failed}</span></p>
                )}
              </div>
            </div>
            <button
              onClick={() => setImportSummary(prev => ({ ...prev, show: false }))}
              className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-500" />
            Guarantor Manager
          </h2>
          <p className="text-sm text-slate-500">Manage customer guarantors</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-600">
            Active: {activeCount}
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
            Expired: {expiredCount}
          </div>
          <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-600">
            🟢 With Loan: {guarantors.filter(g => {
              const status = loanStatusMap.get(g.id);
              return status?.hasLoan === true && status?.isOverdue === false;
            }).length}
          </div>
          <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-600">
            🔴 Overdue: {guarantors.filter(g => {
              const status = loanStatusMap.get(g.id);
              return status?.isOverdue === true;
            }).length}
          </div>
          <input
            type="file"
            id="excel-import"
            accept=".xlsx,.xls"
            onChange={handleExcelImport}
            className="hidden"
            disabled={importing}
          />
          <label
            htmlFor="excel-import"
            className={`px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2 ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Importing...' : 'Import Excel'}
          </label>
          <button
            onClick={() => {
              setEditingGuarantor(null);
              setSelectedCustomer(null);
              setSelectedGuarantor(null);
              setCustomerSearch('');
              setGuarantorSearch('');
              setCustomerResults([]);
              setGuarantorResults([]);
              setFormData({
                guarantorName: '',
                phoneNumber: '',
                customerName: '',
                customerId: '',
                assignmentDate: '',
                expiryDate: '',
                status: 'Active',
                loanPeriod: '3M'
              });
              setShowAddForm(true);
            }}
            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Assign Guarantor
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-fade-in">
          <h3 className="text-sm font-black text-slate-800 mb-4">
            {editingGuarantor ? 'Edit Guarantor' : 'Assign New Guarantor'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Search Field */}
              <div className="md:col-span-2 relative">
                <label className="text-xs font-bold text-slate-600 block mb-1">Search Customer (Person taking loan)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    onFocus={() => customerResults.length > 0 && setShowCustomerResults(true)}
                    placeholder="Type customer name or phone to search..."
                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] pl-9"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  {searchingCustomer && (
                    <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                  )}
                </div>
                {showCustomerResults && customerResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {customerResults.map((customer) => {
                      const count = getGuarantorCount(customer.name);
                      const canAdd = count < 3;
                      const today = new Date().toISOString().split('T')[0];
                      const isOverdue = customer.status === 'Overdue' ||
                        customer.status === 'Expired' ||
                        (customer.expiryDate && customer.expiryDate < today);

                      return (
                        <button
                          key={customer.id}
                          onClick={() => selectCustomer(customer)}
                          className={`w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between ${isOverdue ? 'bg-amber-50 border-l-4 border-l-amber-500' :
                            !canAdd ? 'opacity-50' : ''
                            }`}
                          disabled={!canAdd}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{customer.name}</p>
                            <p className="text-xs text-slate-500">{customer.phoneNumber}</p>
                            {isOverdue && (
                              <p className="text-[10px] text-amber-600 font-bold">⚠️ This customer has an OVERDUE loan</p>
                            )}
                          </div>
                          <div className="text-right ml-2 flex flex-col items-end gap-0.5">
                            {isOverdue && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                🔴 OVERDUE
                              </span>
                            )}
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${count >= 3 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {count}/3 Guarantors
                            </span>
                            {!canAdd && (
                              <p className="text-[10px] text-rose-600 font-bold">⚠️ Max reached</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-xs font-bold text-emerald-700">✅ Selected Customer: {selectedCustomer.name}</p>
                    <p className="text-xs text-emerald-600">Phone: {selectedCustomer.phoneNumber}</p>
                    <p className="text-xs text-emerald-600">Guarantors: {getGuarantorCount(selectedCustomer.name)}/3</p>
                    {getRemainingSlots(selectedCustomer.name) > 0 ? (
                      <p className="text-xs text-emerald-600">✅ Can add {getRemainingSlots(selectedCustomer.name)} more</p>
                    ) : (
                      <p className="text-xs text-rose-600 font-bold">⚠️ Max guarantors reached (3/3)</p>
                    )}
                  </div>
                )}
              </div>

              {/* Guarantor Search Field - UPDATED */}
              <div className="md:col-span-2 relative">
                <label className="text-xs font-bold text-slate-600 block mb-1">Search Guarantor (Person guaranteeing the loan)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={guarantorSearch}
                    onChange={(e) => handleGuarantorSearch(e.target.value)}
                    onFocus={() => guarantorResults.length > 0 && setShowGuarantorResults(true)}
                    placeholder="Type guarantor name or phone to search..."
                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] pl-9"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  {searchingGuarantor && (
                    <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                  )}
                </div>
                {showGuarantorResults && guarantorResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {guarantorResults.map((guarantor) => {
                      const today = new Date().toISOString().split('T')[0];
                      const isOverdue = guarantor.status === 'Overdue' ||
                        guarantor.status === 'Expired' ||
                        (guarantor.expiryDate && guarantor.expiryDate < today);
                      const isCustomer = guarantor.status === 'Active' ||
                        guarantor.status === 'Overdue' ||
                        guarantor.status === 'Expired';

                      return (
                        <button
                          key={guarantor.id}
                          onClick={() => selectGuarantor(guarantor)}
                          className={`w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between ${isOverdue ? 'bg-amber-50 border-l-4 border-l-amber-500' :
                            isCustomer ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                            }`}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{guarantor.name}</p>
                            <p className="text-xs text-slate-500">{guarantor.phoneNumber}</p>
                            {isCustomer && (
                              <p className={`text-[10px] font-bold ${isOverdue ? 'text-amber-600' : 'text-blue-600'}`}>
                                {isOverdue ? '⚠️ Already a customer with OVERDUE loan' : '✅ Already a customer with ACTIVE loan'}
                              </p>
                            )}
                            {isOverdue && (
                              <p className="text-[10px] text-amber-600 font-bold">⚠️ Overdue - Add with caution</p>
                            )}
                          </div>
                          <div className="text-right ml-2 flex flex-col items-end gap-0.5">
                            {isOverdue ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                🔴 OVERDUE
                              </span>
                            ) : isCustomer ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                🟢 HAS LOAN
                              </span>
                            ) : (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                ✅ Available
                              </span>
                            )}
                            {isCustomer && (
                              <span className="text-[9px] text-slate-400 font-medium">
                                {isOverdue ? '⚠️ Customer' : 'Customer'}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedGuarantor && (
                  <div className={`mt-2 p-2 rounded-xl ${selectedGuarantor.status === 'Overdue' || selectedGuarantor.status === 'Expired'
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-emerald-50 border border-emerald-200'
                    }`}>
                    <p className={`text-xs font-bold ${selectedGuarantor.status === 'Overdue' || selectedGuarantor.status === 'Expired'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                      }`}>
                      {selectedGuarantor.status === 'Overdue' || selectedGuarantor.status === 'Expired'
                        ? '⚠️ Selected Guarantor has OVERDUE loan'
                        : '✅ Selected Guarantor'}
                    </p>
                    <p className="text-xs text-slate-600">Phone: {selectedGuarantor.phoneNumber}</p>
                    {selectedGuarantor.status === 'Overdue' && (
                      <p className="text-[10px] text-amber-600 font-bold">⚠️ Overdue - Add with caution</p>
                    )}
                  </div>
                )}
                {!selectedGuarantor && guarantorSearch && !searchingGuarantor && guarantorResults.length === 0 && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-700">⚠️ No guarantor found</p>
                    <p className="text-xs text-amber-600">Type manually below</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Guarantor Name *</label>
                <input
                  type="text"
                  required
                  value={formData.guarantorName}
                  onChange={(e) => setFormData({ ...formData, guarantorName: e.target.value })}
                  placeholder="Enter guarantor name"
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="+251 900 000 000"
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="Enter customer name"
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Customer ID</label>
                <input
                  type="text"
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  placeholder="Optional"
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Loan Period</label>
                <select
                  value={formData.loanPeriod}
                  onChange={(e) => handleLoanPeriodChange(e.target.value as '2M' | '3M' | '6M' | '1Y')}
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold"
                >
                  <option value="2M">2 Months</option>
                  <option value="3M">3 Months</option>
                  <option value="6M">6 Months</option>
                  <option value="1Y">1 Year</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Assignment Date *</label>
                <input
                  type="date"
                  required
                  value={formData.assignmentDate}
                  onChange={(e) => handleAssignmentDateChange(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Expired' })}
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold"
                >
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer">
                {editingGuarantor ? 'Update Guarantor' : 'Assign Guarantor'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingGuarantor(null); setSelectedCustomer(null); setSelectedGuarantor(null); setCustomerSearch(''); setGuarantorSearch(''); setCustomerResults([]); setGuarantorResults([]); }}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loan Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setLoanFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${loanFilter === 'all'
            ? 'bg-violet-500 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          All
        </button>
        <button
          onClick={() => setLoanFilter('has_loan')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${loanFilter === 'has_loan'
            ? 'bg-blue-500 text-white'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
        >
          🟢 With Loan
        </button>
        <button
          onClick={() => setLoanFilter('overdue')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${loanFilter === 'overdue'
            ? 'bg-rose-500 text-white'
            : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
            }`}
        >
          🔴 Overdue
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by guarantor name, phone, or customer..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] text-sm"
        />
      </div>

      {/* Pagination Info */}
      {filteredGuarantors.length > 0 && (
        <div className="text-xs text-slate-500">
          Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredGuarantors.length)} of {filteredGuarantors.length} guarantors
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin" />
        </div>
      ) : filteredGuarantors.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No guarantors found</p>
          <p className="text-sm">Assign your first guarantor using the button above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedGuarantors.map((guarantor) => {
            const loanStatus = loanStatusMap.get(guarantor.id);
            return (
              <div
                key={guarantor.id}
                className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow ${loanStatus?.isOverdue
                  ? 'border-rose-400 border-2'
                  : guarantor.status === 'Active'
                    ? 'border-emerald-200'
                    : 'border-slate-200'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-bold text-slate-800">{guarantor.guarantorName}</h4>
                      <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${guarantor.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                        {guarantor.status}
                      </span>
                      {loanStatus?.hasLoan && !loanStatus.isOverdue && (
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-full border bg-blue-50 text-blue-700 border-blue-200 cursor-help">
                          🟢 With Loan
                        </span>
                      )}
                      {loanStatus?.isOverdue && (
                        <span className="px-2 py-0.5 text-[10px] font-black rounded-full border bg-rose-50 text-rose-700 border-rose-200 cursor-help">
                          🔴 Overdue Loan
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                      <p><span className="font-medium">Phone:</span> {guarantor.phoneNumber}</p>
                      <p><span className="font-medium">Customer:</span> {guarantor.customerName}</p>
                      <p><span className="font-medium">Assignment:</span> {new Date(guarantor.assignmentDate).toLocaleDateString()}</p>
                      <p><span className="font-medium">Expiry:</span> {new Date(guarantor.expiryDate).toLocaleDateString()}</p>
                      <p><span className="font-medium">Assigned By:</span> {guarantor.assignedBy || 'System'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(guarantor)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {currentUser?.role === 'admin' || currentUser?.role === 'super_admin' ? (
                      <button
                        onClick={() => handleDelete(guarantor.id, guarantor.guarantorName)}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        disabled
                        className="p-2 bg-slate-50 text-slate-300 rounded-lg cursor-not-allowed"
                        title="Only admins can delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs font-bold text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}