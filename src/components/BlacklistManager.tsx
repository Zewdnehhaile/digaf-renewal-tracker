// src/components/BlacklistManager.tsx
import React, { useState, useEffect } from 'react';
import { User, BlacklistEntry } from '../types';
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
  FileText,
  Upload
} from 'lucide-react';

interface BlacklistManagerProps {
  currentUser: User;
}

export default function BlacklistManager({ currentUser }: BlacklistManagerProps) {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [editingEntry, setEditingEntry] = useState<BlacklistEntry | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    reason: '',
    notes: '',
    status: 'Blocked' as 'Blocked' | 'Approved'
  });

  // Fetch blacklist entries
  const fetchEntries = async () => {
    try {
      const data = await dbService.getBlacklist();
      setEntries(data);
    } catch (error) {
      console.error('Error fetching blacklist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Filter entries
  const filteredEntries = entries.filter(entry =>
    entry.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.phoneNumber.includes(searchQuery) ||
    entry.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Replace the handleSubmit function with this version that validates exact phone number
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number is not the default placeholder
    if (formData.phoneNumber === '+251 900 000 000' || formData.phoneNumber === '251900000000' || formData.phoneNumber === '900000000') {
      alert('❌ Please enter a valid, real phone number. Default placeholder numbers are not allowed.');
      return;
    }

    try {
      if (editingEntry) {
        await dbService.updateBlacklistEntry(editingEntry.id, formData);
        alert('✅ Blacklist entry updated successfully!');
      } else {
        await dbService.addBlacklistEntry({
          ...formData,
          addedBy: currentUser.fullName,
          dateAdded: new Date().toISOString()
        });
        alert('✅ Blacklist entry added successfully!');
      }
      setShowAddForm(false);
      setEditingEntry(null);
      setFormData({ fullName: '', phoneNumber: '', reason: '', notes: '', status: 'Blocked' });
      fetchEntries();
    } catch (error) {
      console.error('Error saving blacklist entry:', error);
      alert('❌ Failed to save blacklist entry.');
    }
  };

  // Handle import from text
  const handleImport = async () => {
    if (!importText.trim()) {
      alert('❌ Please paste blacklist entries.');
      return;
    }

    const lines = importText.split('\n').filter(line => line.trim());
    const entries: any[] = [];

    lines.forEach(line => {
      // Format: Name, Phone, Reason, Notes
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        entries.push({
          id: `bl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          fullName: parts[0] || 'Unknown',
          phoneNumber: parts[1] || '+251 900 000 000',
          reason: parts[2] || 'Imported',
          notes: parts[3] || '',
          status: 'Blocked',
          addedBy: currentUser.fullName,
          dateAdded: new Date().toISOString()
        });
      }
    });

    if (entries.length === 0) {
      alert('❌ No valid entries found. Format: Name, Phone, Reason, Notes');
      return;
    }

    try {
      await Promise.all(entries.map(entry => dbService.addBlacklistEntry(entry)));
      alert(`✅ ${entries.length} blacklist entries imported successfully!`);
      setShowImportModal(false);
      setImportText('');
      fetchEntries();
    } catch (error) {
      console.error('Error importing blacklist:', error);
      alert('❌ Failed to import blacklist entries.');
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" from blacklist?`)) return;
    try {
      await dbService.deleteBlacklistEntry(id);
      alert('✅ Blacklist entry deleted successfully!');
      fetchEntries();
    } catch (error) {
      console.error('Error deleting blacklist entry:', error);
      alert('❌ Failed to delete blacklist entry.');
    }
  };

  // Handle edit click
  const handleEdit = (entry: BlacklistEntry) => {
    setEditingEntry(entry);
    setFormData({
      fullName: entry.fullName,
      phoneNumber: entry.phoneNumber,
      reason: entry.reason,
      notes: entry.notes || '',
      status: entry.status
    });
    setShowAddForm(true);
  };

  // Toggle status
  const toggleStatus = async (entry: BlacklistEntry) => {
    const newStatus = entry.status === 'Blocked' ? 'Approved' : 'Blocked';
    if (!confirm(`Change status to ${newStatus}?`)) return;
    try {
      await dbService.updateBlacklistEntry(entry.id, { status: newStatus });
      alert(`✅ Status changed to ${newStatus}`);
      fetchEntries();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('❌ Failed to update status.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Blacklist Manager
          </h2>
          <p className="text-sm text-slate-500">Manage blocked customers</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-600">
            Blocked: {entries.filter(e => e.status === 'Blocked').length}
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-600">
            Approved: {entries.filter(e => e.status === 'Approved').length}
          </div>
          <button
            onClick={() => {
              setEditingEntry(null);
              setFormData({ fullName: '', phoneNumber: '', reason: '', notes: '', status: 'Blocked' });
              setShowAddForm(true);
            }}
            className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add to Blacklist
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-fade-in">
          <h3 className="text-sm font-black text-slate-800 mb-4">
            {editingEntry ? 'Edit Blacklist Entry' : 'Add to Blacklist'}
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
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600 block mb-1">Reason *</label>
                <input
                  type="text"
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Reason for blacklisting"
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
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Blocked' | 'Approved' })}
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-bold"
                >
                  <option value="Blocked">Blocked</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer">
                {editingEntry ? 'Update Entry' : 'Add Entry'}
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
          placeholder="Search by name, phone, or reason..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] text-sm"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No blacklist entries found</p>
          <p className="text-sm">Add your first blacklist entry using the button above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={`bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow ${entry.status === 'Blocked' ? 'border-red-200' : 'border-emerald-200'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="font-bold text-slate-800">{entry.fullName}</h4>
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${entry.status === 'Blocked'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                      {entry.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <p><span className="font-medium">Phone:</span> {entry.phoneNumber}</p>
                    <p><span className="font-medium">Reason:</span> {entry.reason}</p>
                    {entry.notes && <p><span className="font-medium">Notes:</span> {entry.notes}</p>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Added by: {entry.addedBy}</span>
                    <span>Date: {new Date(entry.dateAdded).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => toggleStatus(entry)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${entry.status === 'Blocked'
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        : 'bg-red-50 hover:bg-red-100 text-red-700'
                      }`}
                  >
                    {entry.status === 'Blocked' ? 'Approve' : 'Block'}
                  </button>
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-800">Import Blacklist Entries</h3>
              <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-all">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Format: <span className="font-mono bg-slate-100 px-1 rounded">Name, Phone, Reason, Notes</span></p>
              <p className="text-xs text-slate-500">Example: <span className="font-mono bg-slate-100 px-1 rounded">John Doe, +251 900 000 000, Fraud, Test entry</span></p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="John Doe, +251 900 000 000, Fraud, Test entry"
                className="w-full p-3 border border-slate-200 rounded-xl text-sm h-40 focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-mono"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleImport} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-all cursor-pointer">
                Import Entries
              </button>
              <button onClick={() => { setShowImportModal(false); setImportText(''); }} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}