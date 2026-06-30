// src/components/GuarantorManager.tsx
import React, { useState, useEffect } from 'react';
import { User, Guarantor } from '../types';
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
} from 'lucide-react';

interface GuarantorManagerProps {
  currentUser: User;
}

export default function GuarantorManager({ currentUser }: GuarantorManagerProps) {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGuarantor, setEditingGuarantor] = useState<Guarantor | null>(null);
  const [formData, setFormData] = useState({
    guarantorName: '',
    phoneNumber: '',
    customerName: '',
    customerId: '',
    assignmentDate: '',
    expiryDate: '',
    status: 'Active' as 'Active' | 'Expired'
  });

  // Fetch guarantors
  const fetchGuarantors = async () => {
    try {
      const data = await dbService.getGuarantors();
      // Auto-expire guarantors if expiry date passed
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

  // Filter guarantors
  const filteredGuarantors = guarantors.filter(g =>
    g.guarantorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.phoneNumber.includes(searchQuery) ||
    g.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check for duplicate guarantor
  const checkDuplicate = async (phoneNumber: string, excludeId?: string) => {
    const existing = await dbService.checkDuplicateGuarantor(phoneNumber);
    if (existing && existing.id !== excludeId) {
      return true;
    }
    return false;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate
    const isDuplicate = await checkDuplicate(formData.phoneNumber, editingGuarantor?.id);
    if (isDuplicate) {
      alert('⚠️ This guarantor is currently guaranteeing another customer.\n\nPlease wait until the current guarantee expires.');
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
      setFormData({
        guarantorName: '',
        phoneNumber: '',
        customerName: '',
        customerId: '',
        assignmentDate: '',
        expiryDate: '',
        status: 'Active'
      });
      fetchGuarantors();
    } catch (error) {
      console.error('Error saving guarantor:', error);
      alert('❌ Failed to save guarantor.');
    }
  };

  // Handle delete
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

  // Handle edit
  const handleEdit = (guarantor: Guarantor) => {
    setEditingGuarantor(guarantor);
    setFormData({
      guarantorName: guarantor.guarantorName,
      phoneNumber: guarantor.phoneNumber,
      customerName: guarantor.customerName,
      customerId: guarantor.customerId || '',
      assignmentDate: guarantor.assignmentDate,
      expiryDate: guarantor.expiryDate,
      status: guarantor.status
    });
    setShowAddForm(true);
  };

  const activeCount = guarantors.filter(g => g.status === 'Active').length;
  const expiredCount = guarantors.filter(g => g.status === 'Expired').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-500" />
            Guarantor Manager
          </h2>
          <p className="text-sm text-slate-500">Manage customer guarantors</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-600">
            Active: {activeCount}
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
            Expired: {expiredCount}
          </div>
          <button
            onClick={() => {
              setEditingGuarantor(null);
              setFormData({
                guarantorName: '',
                phoneNumber: '',
                customerName: '',
                customerId: '',
                assignmentDate: '',
                expiryDate: '',
                status: 'Active'
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
                <label className="text-xs font-bold text-slate-600 block mb-1">Assignment Date *</label>
                <input
                  type="date"
                  required
                  value={formData.assignmentDate}
                  onChange={(e) => setFormData({ ...formData, assignmentDate: e.target.value })}
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
                onClick={() => { setShowAddForm(false); setEditingGuarantor(null); }}
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
          placeholder="Search by guarantor name, phone, or customer..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] text-sm"
        />
      </div>

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
          {filteredGuarantors.map((guarantor) => (
            <div
              key={guarantor.id}
              className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow ${
                guarantor.status === 'Active' ? 'border-emerald-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="font-bold text-slate-800">{guarantor.guarantorName}</h4>
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${
                      guarantor.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {guarantor.status}
                    </span>
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
                  <button
                    onClick={() => handleDelete(guarantor.id, guarantor.guarantorName)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}