// src/components/EarlyPaymentClosure.tsx
import React, { useState, useEffect } from 'react';
import { User, EarlyPaymentRecord, PaymentReceipt } from '../types';
import { dbService } from '../services/db';
import { Coins, Plus, CheckCircle, Clock, Eye, Trash2, XCircle } from 'lucide-react';

interface EarlyPaymentClosureProps {
  currentUser: User;
}

export default function EarlyPaymentClosure({ currentUser }: EarlyPaymentClosureProps) {
  const [records, setRecords] = useState<EarlyPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loanId, setLoanId] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [currentInstallment, setCurrentInstallment] = useState('');

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      // TODO: Fetch from API - replace with actual API call
      const mockRecords: EarlyPaymentRecord[] = [
        {
          id: '1',
          customerName: 'Abebe Kebede',
          phoneNumber: '0912345678',
          loanId: 'LOAN-001',
          totalInstallments: 12,
          currentInstallment: 5,
          status: 'Partial',
          receipts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          customerName: 'Birtukan Mamo',
          phoneNumber: '0922334455',
          loanId: 'LOAN-002',
          totalInstallments: 8,
          currentInstallment: 8,
          status: 'Fully Closed',
          receipts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          closedAt: new Date().toISOString(),
          closedBy: 'Admin'
        }
      ];
      setRecords(mockRecords);
      setLoading(false);
    } catch (error) {
      console.error('Error loading records:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName) {
      alert('Please enter customer name');
      return;
    }

    if (!totalInstallments || parseInt(totalInstallments) < 1) {
      alert('Please enter a valid total installments number');
      return;
    }

    if (!currentInstallment || parseInt(currentInstallment) < 1) {
      alert('Please enter a valid current installment number');
      return;
    }

    const newRecord: EarlyPaymentRecord = {
      id: `ep-${Date.now()}`,
      customerName,
      phoneNumber: phoneNumber || '',
      loanId: loanId || undefined,
      totalInstallments: parseInt(totalInstallments),
      currentInstallment: parseInt(currentInstallment),
      status: 'Partial',
      receipts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // TODO: Save to API
      setRecords([newRecord, ...records]);
      alert('✅ Early payment record created successfully!');
      
      // Reset form
      setCustomerName('');
      setPhoneNumber('');
      setLoanId('');
      setTotalInstallments('');
      setCurrentInstallment('');
      setShowAddModal(false);
    } catch (error) {
      console.error('Error saving record:', error);
      alert('❌ Failed to save record');
    }
  };

  const handlePartialPayment = (record: EarlyPaymentRecord) => {
    if (record.currentInstallment >= record.totalInstallments) {
      alert('All installments are already completed!');
      return;
    }

    if (confirm(`Process partial payment for ${record.customerName}? Installment ${record.currentInstallment + 1} of ${record.totalInstallments}`)) {
      const updated = {
        ...record,
        currentInstallment: record.currentInstallment + 1,
        status: record.currentInstallment + 1 >= record.totalInstallments ? 'Fully Closed' : 'Partial',
        updatedAt: new Date().toISOString()
      };
      // TODO: Update in API
      setRecords(records.map(r => r.id === record.id ? updated : r));
      alert('✅ Partial payment recorded!');
    }
  };

  const handleFullyClose = (record: EarlyPaymentRecord) => {
    if (record.status === 'Fully Closed') {
      alert('This loan is already fully closed!');
      return;
    }

    if (confirm(`Mark ${record.customerName}'s loan as FULLY CLOSED?`)) {
      const updated = {
        ...record,
        status: 'Fully Closed',
        closedAt: new Date().toISOString(),
        closedBy: currentUser.fullName,
        updatedAt: new Date().toISOString()
      };
      // TODO: Update in API
      setRecords(records.map(r => r.id === record.id ? updated : r));
      alert('✅ Loan marked as Fully Closed!');
    }
  };

  const handleDelete = (record: EarlyPaymentRecord) => {
    if (confirm(`Delete ${record.customerName}'s early payment record?`)) {
      // TODO: Delete from API
      setRecords(records.filter(r => r.id !== record.id));
      alert('🗑️ Record deleted successfully!');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      'Partial': 'bg-amber-50 text-amber-800 border-amber-200',
      'Fully Closed': 'bg-emerald-50 text-emerald-800 border-emerald-200',
      'Pending': 'bg-slate-50 text-slate-800 border-slate-200'
    };
    return `px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${styles[status as keyof typeof styles] || styles.Pending}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#8B5CF6]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-150 p-6 shadow-3xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#8B5CF6]" />
              Early Payment Closure
            </h2>
            <p className="text-[10.5px] text-slate-500 font-medium mt-1">
              Manage early loan closures, partial payments, and track installment progress
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>

        {/* Records Table */}
        {records.length === 0 ? (
          <div className="mt-6 text-center py-12 text-slate-400">
            <p className="text-sm">No early payment records yet.</p>
            <p className="text-xs mt-1">Click "Add Customer" to start tracking early loan closures.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-[10.5px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-150 text-[8.5px] uppercase tracking-wider font-extrabold">
                  <th className="p-3">Customer</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Loan ID</th>
                  <th className="p-3">Installments</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="p-3 font-extrabold text-slate-800">{record.customerName}</td>
                    <td className="p-3 text-slate-600">{record.phoneNumber || 'N/A'}</td>
                    <td className="p-3 text-slate-600 font-mono">{record.loanId || 'N/A'}</td>
                    <td className="p-3 text-slate-600">
                      {record.currentInstallment} / {record.totalInstallments}
                    </td>
                    <td className="p-3">
                      <span className={getStatusBadge(record.status)}>
                        {record.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {record.status !== 'Fully Closed' && (
                          <>
                            <button
                              onClick={() => handlePartialPayment(record)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-[8.5px] font-black transition-all"
                              title="Partial Payment"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleFullyClose(record)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-[8.5px] font-black transition-all"
                              title="Fully Close"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {record.status === 'Fully Closed' && (
                          <span className="text-[8.5px] font-black text-emerald-600 px-2">✓ Closed</span>
                        )}
                        <button
                          onClick={() => handleDelete(record)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-[8.5px] font-black transition-all"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#8B5CF6]" />
                Add Early Payment Record
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider block mb-1">
                    Customer Full Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:border-[#8B5CF6] outline-none transition-all"
                    placeholder="Enter customer name"
                    required
                  />
                </div>

                <div>
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider block mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:border-[#8B5CF6] outline-none transition-all"
                    placeholder="Enter phone number (optional)"
                  />
                </div>

                <div>
                  <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider block mb-1">
                    Loan ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={loanId}
                    onChange={(e) => setLoanId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:border-[#8B5CF6] outline-none transition-all"
                    placeholder="Enter loan ID if available"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider block mb-1">
                      Total Installments *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={totalInstallments}
                      onChange={(e) => setTotalInstallments(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:border-[#8B5CF6] outline-none transition-all"
                      placeholder="Enter total installments"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[8.5px] uppercase font-black text-slate-450 tracking-wider block mb-1">
                      Current Installment *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={currentInstallment}
                      onChange={(e) => setCurrentInstallment(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:border-[#8B5CF6] outline-none transition-all"
                      placeholder="Enter current installment"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}