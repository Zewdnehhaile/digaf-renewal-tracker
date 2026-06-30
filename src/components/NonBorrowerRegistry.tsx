// src/components/NonBorrowerRegistry.tsx
import React, { useState, useEffect } from 'react';
import { User, NonBorrower } from '../types';
import { dbService } from '../services/db';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Users,
  X,
  RefreshCw,
  Building2,
  Phone,
  User as UserIcon,
  Briefcase
} from 'lucide-react';

interface NonBorrowerRegistryProps {
  currentUser: User;
}

export default function NonBorrowerRegistry({ currentUser }: NonBorrowerRegistryProps) {
  const [nonBorrowers, setNonBorrowers] = useState<NonBorrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<NonBorrower | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    workPosition: '',
    company: '',
    notes: ''
  });

  // Fetch non-borrowers
  const fetchNonBorrowers = async () => {
    try {
      const data = await dbService.getNonBorrowers();
      setNonBorrowers(data);
    } catch (error) {
      console.error('Error fetching non-borrowers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNonBorrowers();
  }, []);

  // Filter non-borrowers
  const filteredNonBorrowers = nonBorrowers.filter(entry =>
    entry.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.phoneNumber.includes(searchQuery) ||
    entry.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.workPosition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEntry) {
        await dbService.updateNonBorrower(editingEntry.id, formData);
        alert('✅ Non-borrower updated successfully!');
      } else {
        await dbService.addNonBorrower({
          ...formData,
          dateAdded: new Date().toISOString(),
          addedBy: currentUser.fullName
        });
        alert('✅ Non-borrower added successfully!');
      }
      setShowAddForm(false);
      setEditingEntry(null);
      setFormData({ fullName: '', phoneNumber: '', workPosition: '', company: '', notes: '' });
      fetchNonBorrowers();
    } catch (error) {
      console.error('Error saving non-borrower:', error);
      alert('❌ Failed to save non-borrower.');
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" from non-borrowers?`)) return;
    try {
      await dbService.deleteNonBorrower(id);
      alert('✅ Non-borrower deleted successfully!');
      fetchNonBorrowers();
    } catch (error) {
      console.error('Error deleting non-borrower:', error);
      alert('❌ Failed to delete non-borrower.');
    }
  };

  // Handle edit
  const handleEdit = (entry: NonBorrower) => {
    setEditingEntry(entry);
    setFormData({
      fullName: entry.fullName,
      phoneNumber: entry.phoneNumber,
      workPosition: entry.workPosition || '',
      company: entry.company || '',
      notes: entry.notes || ''
    });
    setShowAddForm(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Non-Borrower Registry
          </h2>
          <p className="text-sm text-slate-500">Manage non-borrower individuals</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-xs font-bold text-orange-600">
            Total: {nonBorrowers.length}
          </div>
          <button
            onClick={() => {
              setEditingEntry(null);
              setFormData({ fullName: '', phoneNumber: '', workPosition: '', company: '', notes: '' });
              setShowAddForm(true);
            }}
            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Non-Borrower
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-fade-in">
          <h3 className="text-sm font-black text-slate-800 mb-4">
            {editingEntry ? 'Edit Non-Borrower' : 'Add Non-Borrower'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter full name"
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
                <label className="text-xs font-bold text-slate-600 block mb-1">Work Position</label>
                <input
                  type="text"
                  value={formData.workPosition}
                  onChange={(e) => setFormData({ ...formData, workPosition: e.target.value })}
                  placeholder="e.g., Manager, Officer"
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Company name"
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600 block mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm h-20 focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer">
                {editingEntry ? 'Update' : 'Add Non-Borrower'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setEditingEntry(null); }}
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
          placeholder="Search by name, phone, company, or position..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] text-sm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin" />
        </div>
      ) : filteredNonBorrowers.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No non-borrowers found</p>
          <p className="text-sm">Add your first non-borrower using the button above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNonBorrowers.map((entry) => (
            <div
              key={entry.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="font-bold text-slate-800">{entry.fullName}</h4>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <p><span className="font-medium">Phone:</span> {entry.phoneNumber}</p>
                    {entry.workPosition && <p><span className="font-medium">Position:</span> {entry.workPosition}</p>}
                    {entry.company && <p><span className="font-medium">Company:</span> {entry.company}</p>}
                    {entry.notes && <p><span className="font-medium">Notes:</span> {entry.notes}</p>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Added: {new Date(entry.dateAdded).toLocaleString()}</span>
                    <span>Added By: {entry.addedBy || 'System'}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(entry)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id, entry.fullName)}
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