// src/components/ActiveLoanManager.tsx
import React, { useState, useEffect } from 'react';
import { User, ActiveLoan } from '../types';
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
    DollarSign,
    Phone,
    User as UserIcon,
    Briefcase,
    Upload,
    FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ActiveLoanManagerProps {
    currentUser: User;
}

export default function ActiveLoanManager({ currentUser }: ActiveLoanManagerProps) {
    const [loans, setLoans] = useState<ActiveLoan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingLoan, setEditingLoan] = useState<ActiveLoan | null>(null);
    const [importing, setImporting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phoneNumber: '',
        loanType: '',
        amountRequested: '',
        disbursementDate: '',
        loanOfficer: '',
        loanPeriod: '',
        status: 'Active' as 'Active' | 'Expired' | 'Overdue'
    });
    const [importSummary, setImportSummary] = useState<{
        show: boolean;
        imported: number;
        skipped: number;
        failed: number;
        errors?: string[];
    }>({ show: false, imported: 0, skipped: 0, failed: 0 });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    // Check if user is admin or super admin
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
    const itemsPerPage = 20;

    // Fetch loans
    const fetchLoans = async () => {
        try {
            const data = await dbService.getActiveLoans();

            // Auto-expire/overdue loans based on expiry date
            const today = new Date().toISOString().split('T')[0];
            const updated = data.map((loan: ActiveLoan) => {
                if (loan.status === 'Active' && loan.expiryDate && loan.expiryDate < today) {
                    return { ...loan, status: 'Overdue' as const };
                }
                return loan;
            });
            setLoans(updated);
        } catch (error) {
            console.error('Error fetching active loans:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLoans();
    }, []);

    // Filter loans by search
    const filteredLoans = loans.filter(loan =>
        loan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.phoneNumber.includes(searchQuery)
    );

    // Pagination
    const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);
    const paginatedLoans = filteredLoans.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Calculate expiry date
    const calculateExpiryDate = (disbursementDate: string, loanPeriod: string): string => {
        if (!disbursementDate || !loanPeriod) return '';
        const months = parseInt(loanPeriod);
        if (isNaN(months)) return '';
        const date = new Date(disbursementDate);
        date.setMonth(date.getMonth() + months);
        return date.toISOString().split('T')[0];
    };

    // Check duplicate
    const checkDuplicate = async (name: string, phoneNumber: string, excludeId?: string): Promise<boolean> => {
        try {
            const existingLoans = await dbService.getActiveLoans();
            return existingLoans.some((loan: ActiveLoan) =>
                loan.name.toLowerCase() === name.toLowerCase() &&
                loan.phoneNumber === phoneNumber &&
                loan.status === 'Active' &&
                loan.id !== excludeId
            );
        } catch (error) {
            console.error('Error checking duplicate:', error);
            return false;
        }
    };

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const isDuplicate = await checkDuplicate(
            formData.name,
            formData.phoneNumber,
            editingLoan?.id
        );

        if (isDuplicate) {
            alert('⚠️ This customer already has an active loan with the same name and phone.');
            return;
        }

        try {
            const loanData = {
                ...formData,
                amountRequested: parseFloat(formData.amountRequested) || 0,
                addedBy: currentUser.fullName,
                createdAt: new Date().toISOString()
            };

            if (editingLoan) {
                await dbService.updateActiveLoan(editingLoan.id, loanData);
                alert('✅ Loan updated successfully!');
            } else {
                await dbService.addActiveLoan(loanData);
                alert('✅ Loan added successfully!');
            }

            setShowAddForm(false);
            setEditingLoan(null);
            setFormData({
                name: '',
                phoneNumber: '',
                loanType: '',
                amountRequested: '',
                disbursementDate: '',
                loanOfficer: '',
                loanPeriod: '',
                status: 'Active'
            });
            fetchLoans();
        } catch (error) {
            console.error('Error saving loan:', error);
            alert('❌ Failed to save loan.');
        }
    };

    // Handle delete
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete loan for "${name}"?`)) return;
        try {
            await dbService.deleteActiveLoan(id);
            alert('✅ Loan deleted successfully!');
            fetchLoans();
        } catch (error) {
            console.error('Error deleting loan:', error);
            alert('❌ Failed to delete loan.');
        }
    };

    // Handle edit
    const handleEdit = (loan: ActiveLoan) => {
        setEditingLoan(loan);
        setFormData({
            name: loan.name,
            phoneNumber: loan.phoneNumber,
            loanType: loan.loanType,
            amountRequested: String(loan.amountRequested),
            disbursementDate: loan.disbursementDate,
            loanOfficer: loan.loanOfficer,
            loanPeriod: loan.loanPeriod,
            status: loan.status
        });
        setShowAddForm(true);
    };

    // Handle Excel import - INSTANT BULK IMPORT
    const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportSummary({ show: false, imported: 0, skipped: 0, failed: 0 });
        setImporting(true);
        setCurrentPage(1); // Reset to first page when importing

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });

            if (workbook.SheetNames.length === 0) {
                alert('❌ The Excel file appears to be empty.');
                setImporting(false);
                e.target.value = '';
                return;
            }

            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });

            if (!jsonData || jsonData.length === 0) {
                alert('⚠️ The Excel file is empty.');
                setImporting(false);
                e.target.value = '';
                return;
            }

            // Detect columns
            const headers = Object.keys(jsonData[0] || {});
            const nameColumn = headers.find(h =>
                ['name', 'customer name', 'full name', 'borrower name'].some(col =>
                    h.toLowerCase().trim() === col
                )
            );
            const phoneColumn = headers.find(h =>
                ['phone', 'phone number', 'mobile', 'telephone', 'phone no'].some(col =>
                    h.toLowerCase().trim() === col
                )
            );
            const loanTypeColumn = headers.find(h =>
                ['loan type', 'loan type', 'type'].some(col =>
                    h.toLowerCase().trim() === col
                )
            );
            const amountColumn = headers.find(h =>
                ['amount requested', 'requested amount', 'loan amount', 'amount'].some(col =>
                    h.toLowerCase().trim() === col
                )
            );
            const disbursementColumn = headers.find(h =>
                ['disbursement date', 'disbursed date', 'date disbursed'].some(col =>
                    h.toLowerCase().trim() === col
                )
            );
            const officerColumn = headers.find(h =>
                ['loan officer', 'officer', 'assigned officer'].some(col =>
                    h.toLowerCase().trim() === col
                )
            );
            const periodColumn = headers.find(h =>
                ['loan period', 'period', 'term'].some(col =>
                    h.toLowerCase().trim() === col
                )
            );

            if (!nameColumn || !phoneColumn) {
                alert('❌ Could not find required columns.\n\nPlease ensure your file has:\n• Name (or Customer Name)\n• Phone (or Phone Number)');
                setImporting(false);
                e.target.value = '';
                return;
            }

            // Get existing loans for duplicate checking
            const existingLoans = await dbService.getActiveLoans();
            const validLoans: any[] = [];
            const skippedDuplicates: string[] = [];
            const failedRows: Array<{ rowIndex: number; error: string }> = [];

            // Process all rows - NO duplicate checking per row, just collect valid data
            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                const name = String(row[nameColumn] || '').trim();
                const phone = String(row[phoneColumn] || '').trim();

                if (!name || !phone) {
                    failedRows.push({ rowIndex: i + 1, error: 'Missing Name or Phone' });
                    continue;
                }

                // Quick duplicate check - but don't stop the import
                const isDuplicate = existingLoans.some((loan: ActiveLoan) =>
                    loan.name.toLowerCase() === name.toLowerCase() &&
                    loan.phoneNumber === phone &&
                    loan.status === 'Active'
                );

                if (isDuplicate) {
                    skippedDuplicates.push(`${name} (${phone})`);
                    continue;
                }

                const loanType = String(row[loanTypeColumn] || 'MINDA 90').trim();
                const amountRequested = parseFloat(String(row[amountColumn] || '0').replace(/,/g, '')) || 0;
                let disbursementDate = String(row[disbursementColumn] || '').trim();
                const loanOfficer = String(row[officerColumn] || currentUser.fullName).trim();
                let loanPeriod = String(row[periodColumn] || '3M').trim();

                // Parse date
                if (disbursementDate) {
                    const dateParts = disbursementDate.split(/[\/\-]/);
                    if (dateParts.length === 3) {
                        let year = parseInt(dateParts[2]);
                        let month = parseInt(dateParts[0]);
                        let day = parseInt(dateParts[1]);
                        if (year < 100) year += 2000;
                        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                            disbursementDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        }
                    }
                }

                // Ensure loanPeriod has M suffix
                if (loanPeriod && !loanPeriod.toUpperCase().includes('M')) {
                    loanPeriod = loanPeriod + 'M';
                }

                // Calculate expiry date
                const calculatedExpiry = calculateExpiryDate(
                    disbursementDate || new Date().toISOString().split('T')[0],
                    loanPeriod || '3M'
                );

                validLoans.push({
                    name,
                    phoneNumber: phone,
                    loanType: loanType || 'MINDA 90',
                    amountRequested: amountRequested || 0,
                    disbursementDate: disbursementDate || new Date().toISOString().split('T')[0],
                    loanOfficer: loanOfficer || currentUser.fullName,
                    loanPeriod: loanPeriod || '3M',
                    expiryDate: calculatedExpiry, // <-- ADD THIS LINE
                    status: 'Active',
                    addedBy: currentUser.fullName,
                    createdAt: new Date().toISOString()
                });
            }

            // INSTANT BULK IMPORT - ONE API CALL FOR ALL LOANS
            let importedCount = 0;
            let failedCount = 0;
            const importErrors: string[] = [];

            if (validLoans.length > 0) {
                try {
                    // ONE API CALL for ALL valid loans - INSTANT!
                    const result = await dbService.importActiveLoans(validLoans);
                    importedCount = result.count || validLoans.length;
                    console.log(`✅ Bulk imported ${importedCount} loans instantly!`);
                } catch (error) {
                    console.error('Error bulk importing loans:', error);
                    // Fallback: if bulk fails, try individual imports (slower but works)
                    for (const loan of validLoans) {
                        try {
                            await dbService.addActiveLoan(loan);
                            importedCount++;
                        } catch (err) {
                            console.error('Error importing loan:', err);
                            failedCount++;
                            importErrors.push(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
                        }
                    }
                }
            }

            // Update summary
            const summary = {
                show: true,
                imported: importedCount,
                skipped: skippedDuplicates.length,
                failed: failedCount + failedRows.length,
                errors: [...importErrors, ...failedRows.map(f => `Row ${f.rowIndex}: ${f.error}`)]
            };
            setImportSummary(summary);

            // Refresh loans list - wait for it to complete
            await fetchLoans();

            // Force immediate update by setting loading to false and updating state directly
            if (importedCount > 0) {
                // Fetch again immediately to ensure data is fresh
                const freshData = await dbService.getActiveLoans();
                const today = new Date().toISOString().split('T')[0];
                const updated = freshData.map((loan: ActiveLoan) => {
                    if (loan.status === 'Active' && loan.expiryDate && loan.expiryDate < today) {
                        return { ...loan, status: 'Overdue' as const };
                    }
                    return loan;
                });
                setLoans(updated);
                setLoading(false);
            }
            // REMOVE the duplicate fetchLoans() call if there is one after this

            // Show summary message
            let message = `📊 Import Summary\n\n✅ Imported: ${summary.imported}\n⏭️ Skipped: ${summary.skipped}\n❌ Failed: ${summary.failed}`;
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
            console.error('Error importing Excel:', error);
            alert('❌ Failed to import Excel file.');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    // Auto-dismiss import summary
    useEffect(() => {
        if (importSummary.show) {
            const timer = setTimeout(() => {
                setImportSummary(prev => ({ ...prev, show: false }));
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [importSummary.show]);

    const activeCount = loans.filter(l => l.status === 'Active').length;
    const expiredCount = loans.filter(l => l.status === 'Expired' || l.status === 'Overdue').length;

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
                        <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                        Active Loans (MINDA)
                    </h2>
                    <p className="text-sm text-slate-500">Manage active customer loans</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-600">
                        Active: {activeCount}
                    </div>
                    <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-600">
                        Overdue: {expiredCount}
                    </div>
                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                        Total: {loans.length}
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
                        className={`px-4 py-2 text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2 ${importing
                            ? 'bg-amber-500 cursor-wait opacity-80'
                            : 'bg-emerald-500 hover:bg-emerald-600'
                            }`}
                    >
                        {importing ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                Import Excel
                            </>
                        )}
                    </label>
                    <button
                        onClick={() => {
                            setEditingLoan(null);
                            setFormData({
                                name: '',
                                phoneNumber: '',
                                loanType: '',
                                amountRequested: '',
                                disbursementDate: '',
                                loanOfficer: '',
                                loanPeriod: '',
                                status: 'Active'
                            });
                            setShowAddForm(true);
                        }}
                        className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Loan
                    </button>
                    {/* Clear All Button - Admin Only */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                        <button
                            onClick={async () => {
                                if (!confirm('⚠️ Are you sure you want to delete ALL loans?\n\nThis action cannot be undone!')) return;

                                if (!confirm('⚠️ Final confirmation: Delete ALL loan records?')) return;

                                try {
                                    const response = await fetch('http://localhost:3000/api/active-loans');
                                    const loans = await response.json();

                                    if (loans.length === 0) {
                                        alert('✅ No loans to delete.');
                                        return;
                                    }

                                    let deletedCount = 0;
                                    for (const loan of loans) {
                                        const deleteRes = await fetch(`http://localhost:3000/api/active-loans/${loan.id}`, {
                                            method: 'DELETE'
                                        });
                                        if (deleteRes.ok) {
                                            deletedCount++;
                                        }
                                    }

                                    alert(`✅ Successfully deleted ${deletedCount} loans.`);
                                    await fetchLoans();
                                } catch (error) {
                                    console.error('Error deleting all loans:', error);
                                    alert('❌ Failed to delete all loans.');
                                }
                            }}
                            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-fade-in">
                    <h3 className="text-sm font-black text-slate-800 mb-4">
                        {editingLoan ? 'Edit Loan' : 'Add New Loan'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Customer Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Enter customer name"
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
                                <label className="text-xs font-bold text-slate-600 block mb-1">Loan Type *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.loanType}
                                    onChange={(e) => setFormData({ ...formData, loanType: e.target.value })}
                                    placeholder="e.g., MINDA 90, MINDA 60, MUYA 90"
                                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Amount Requested *</label>
                                <input
                                    type="number"
                                    required
                                    value={formData.amountRequested}
                                    onChange={(e) => setFormData({ ...formData, amountRequested: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Disbursement Date *</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.disbursementDate}
                                    onChange={(e) => setFormData({ ...formData, disbursementDate: e.target.value })}
                                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Loan Period *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.loanPeriod}
                                    onChange={(e) => setFormData({ ...formData, loanPeriod: e.target.value })}
                                    placeholder="e.g., 3M, 6M, 12M"
                                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Loan Officer</label>
                                <input
                                    type="text"
                                    value={formData.loanOfficer}
                                    onChange={(e) => setFormData({ ...formData, loanOfficer: e.target.value })}
                                    placeholder="Enter loan officer name"
                                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 block mb-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Expired' | 'Overdue' })}
                                    className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Overdue">Overdue</option>
                                    <option value="Expired">Expired</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button type="submit" className="px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer">
                                {editingLoan ? 'Update Loan' : 'Add Loan'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowAddForm(false); setEditingLoan(null); }}
                                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name or phone..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] text-sm"
                />
            </div>
            {/* ADD THIS: Import Progress Indicator */}
            {importing && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm animate-pulse">
                    <div className="flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-amber-800">Importing Loans...</p>
                            <p className="text-xs text-amber-600">Processing your Excel file. This will complete in a few seconds.</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination Info */}
            {filteredLoans.length > 0 && (
                <div className="text-xs text-slate-500">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredLoans.length)} of {filteredLoans.length} loans
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin" />
                </div>
            ) : filteredLoans.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No loans found</p>
                    <p className="text-sm">Add your first loan using the button above or import from Excel</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedLoans.map((loan) => {
                        const expiryDate = calculateExpiryDate(loan.disbursementDate, loan.loanPeriod);
                        return (
                            <div
                                key={loan.id}
                                className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow ${loan.status === 'Active' ? 'border-emerald-200' : 'border-rose-200'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h4 className="font-bold text-slate-800">{loan.name}</h4>
                                            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${loan.status === 'Active'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}>
                                                {loan.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                            <p><span className="font-medium">Phone:</span> {loan.phoneNumber}</p>
                                            <p><span className="font-medium">Loan Type:</span> {loan.loanType}</p>
                                            <p><span className="font-medium">Amount:</span> {loan.amountRequested.toLocaleString()} ETB</p>
                                            <p><span className="font-medium">Disbursed:</span> {new Date(loan.disbursementDate).toLocaleDateString()}</p>
                                            <p><span className="font-medium">Period:</span> {loan.loanPeriod}</p>
                                            <p><span className="font-medium">Expires:</span> {expiryDate ? new Date(expiryDate).toLocaleDateString() : 'N/A'}</p>
                                            <p><span className="font-medium">Officer:</span> {loan.loanOfficer}</p>
                                            <p><span className="font-medium">Added By:</span> {loan.addedBy || 'System'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        {isAdmin ? (
                                            <button
                                                onClick={() => handleEdit(loan)}
                                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                disabled
                                                className="p-2 bg-slate-50 text-slate-300 rounded-lg cursor-not-allowed"
                                                title="Only admins can edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        )}
                                        {isAdmin ? (
                                            <button
                                                onClick={() => handleDelete(loan.id, loan.name)}
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