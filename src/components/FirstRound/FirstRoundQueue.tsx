// src/components/FirstRound/FirstRoundQueue.tsx
import React, { useState, useEffect } from 'react';
import { User, FirstRoundApplicant } from '../../types';
import { dbService } from '../../services/db';
import {
    Plus,
    Edit,
    Trash2,
    CheckCircle,
    Copy,
    Search,
    FileText,
    Users,
    Clock,
    RefreshCw,
    X
} from 'lucide-react';

interface FirstRoundQueueProps {
    currentUser: User;
}

export default function FirstRoundQueue({ currentUser }: FirstRoundQueueProps) {
    const [applicants, setApplicants] = useState<FirstRoundApplicant[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [inputMode, setInputMode] = useState<'single' | 'bulk'>('single');
    const [applicantText, setApplicantText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Edit state
    const [editingApplicant, setEditingApplicant] = useState<FirstRoundApplicant | null>(null);
    const [editFormData, setEditFormData] = useState<any>({});

    // Fetch applicants from MongoDB
    const fetchApplicants = async () => {
        try {
            const data = await dbService.getFirstRoundApplicants();
            const pendingOnly = data.filter((a: any) => a.status === 'pending');
            setApplicants(pendingOnly);
        } catch (error) {
            console.error('Error fetching applicants:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplicants();
    }, []);

    // Add applicant
    // Add applicant - UPDATED VERSION
    const handleAddApplicant = async () => {
        if (!applicantText.trim()) return;

        const lines = applicantText.split('\n').filter(line => line.trim());
        const newApplicants: FirstRoundApplicant[] = [];

        if (inputMode === 'single') {
            // Format: Full Name, Field of Work, Address, Position, Phone Number
            const [fullName, fieldOfWork, address, position, phoneNumber, ...notes] = lines;

            const applicant: FirstRoundApplicant = {
                id: `fr-${Date.now()}`,
                referenceId: `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                name: fullName || 'Unknown',
                bank: fieldOfWork || '',        // Field of work (yesera tekuam)
                branch: address || '',          // Address of field
                position: position || '',       // Work position
                phoneNumber: phoneNumber || '',
                notes: notes.join('\n'),
                status: 'pending',
                createdBy: currentUser.phoneNumber,
                createdByName: currentUser.fullName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            newApplicants.push(applicant);
        } else {
            // Bulk mode - just names
            lines.forEach(name => {
                if (name.trim()) {
                    newApplicants.push({
                        id: `fr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                        referenceId: `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                        name: name.trim(),
                        bank: '',
                        position: '',
                        branch: '',
                        phoneNumber: '',
                        notes: '',
                        status: 'pending',
                        createdBy: currentUser.phoneNumber,
                        createdByName: currentUser.fullName,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            });
        }

        try {
            await dbService.addFirstRoundApplicants(newApplicants);
            setApplicants([...newApplicants, ...applicants]);
            setApplicantText('');
            setShowAddForm(false);
            alert(`✅ ${newApplicants.length} applicant(s) added successfully!`);
        } catch (error) {
            console.error('Error adding applicants:', error);
            alert('❌ Failed to add applicant. Please try again.');
        }
    };
    // Complete applicant
    const handleComplete = async (applicant: FirstRoundApplicant) => {
        try {
            const currentApplicant = applicants.find(a => a.id === applicant.id);
            if (!currentApplicant) {
                alert('This applicant no longer exists. Please refresh the page.');
                return;
            }

            const updated = {
                ...applicant,
                status: 'completed' as const,
                completedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            delete (updated as any)._id;

            await dbService.updateFirstRoundApplicant(applicant.id, updated);
            setApplicants(prev => prev.filter(a => a.id !== applicant.id));
            alert('✅ Applicant moved to Completed Loans successfully!');

        } catch (error) {
            console.error('Error completing applicant:', error);
            alert('❌ Failed to complete applicant. Please try again.');
        }
    };

    // Delete applicant
    const handleDelete = async (id: string) => {
        if (!confirm('Delete this applicant?')) return;
        try {
            await dbService.deleteFirstRoundApplicant(id);
            setApplicants(applicants.filter(a => a.id !== id));
            alert('✅ Applicant deleted successfully!');
        } catch (error) {
            console.error('Error deleting applicant:', error);
            alert('❌ Failed to delete applicant.');
        }
    };

    // Edit applicant - Save
    const handleEditSave = async () => {
        try {
            delete editFormData._id;
            await dbService.updateFirstRoundApplicant(editingApplicant!.id, editFormData);
            setApplicants(prev => prev.map(a =>
                a.id === editingApplicant!.id ? { ...a, ...editFormData } : a
            ));
            setEditingApplicant(null);
            alert('✅ Applicant updated successfully!');
        } catch (error) {
            console.error('Error updating applicant:', error);
            alert('❌ Failed to update applicant.');
        }
    };

    // Copy to clipboard
    const handleCopy = async (applicant: FirstRoundApplicant) => {
        const text = `Name: ${applicant.name}\nBank: ${applicant.bank || 'N/A'}\nPosition: ${applicant.position || 'N/A'}\nBranch: ${applicant.branch || 'N/A'}\nPhone: ${applicant.phoneNumber || 'N/A'}\nREF: ${applicant.referenceId}`;
        await navigator.clipboard.writeText(text);
        alert('📋 Copied to clipboard!');
    };

    // Filter applicants
    const filteredApplicants = applicants.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.referenceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.bank.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pendingCount = applicants.filter(a => a.status === 'pending').length;
    const completedCount = applicants.filter(a => a.status === 'completed').length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#8B5CF6]" />
                        First Round Queue
                    </h2>
                    <p className="text-sm text-slate-500">Manage incoming loan applicants</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-violet-50 border border-violet-100 rounded-lg text-xs font-bold text-[#8B5CF6]">
                        Pending: {pendingCount}
                    </div>
                    <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-600">
                        Completed: {completedCount}
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Applicant
                    </button>
                </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-fade-in">
                    <h3 className="text-sm font-black text-slate-800 mb-4">Add Incoming Applicants</h3>
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setInputMode('single')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${inputMode === 'single' ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            Single Applicant
                        </button>
                        <button
                            onClick={() => setInputMode('bulk')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${inputMode === 'bulk' ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            Bulk Paste Mode
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 block mb-1">
                                {inputMode === 'single' ? 'Applicant Details' : 'Paste Names (one per line)'}
                            </label>
                            <textarea
                                value={applicantText}
                                onChange={(e) => setApplicantText(e.target.value)}
                                placeholder={inputMode === 'single' ? "Full Name\nField of Work (yesera tekuam)\nAddress of field\nWork Position\nPhone Number\nAdditional Notes" : "Adem Mohammed\nKirubel Tibebu\nNaaf sori"}
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] font-mono text-sm min-h-[150px]"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleAddApplicant} className="px-6 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-xl transition-all cursor-pointer">
                                Add Applicant
                            </button>
                            <button onClick={() => { setShowAddForm(false); setApplicantText(''); }} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, reference ID, or bank..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] text-sm"
                />
            </div>

            {/* Applicants List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin" />
                </div>
            ) : filteredApplicants.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No pending applicants</p>
                    <p className="text-sm">Add your first applicant using the button above</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredApplicants.map((applicant, index) => (
                        <div key={applicant.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                                        <h4 className="font-bold text-slate-800">{applicant.name}</h4>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                        <p><span className="font-medium">Full Name:</span> {applicant.name}</p>
                                        <p><span className="font-medium">Field of Work:</span> {applicant.bank || 'N/A'}</p>
                                        <p><span className="font-medium">Address of Field:</span> {applicant.branch || 'N/A'}</p>
                                        <p><span className="font-medium">Work Position:</span> {applicant.position || 'N/A'}</p>
                                        <p><span className="font-medium">Phone Number:</span> {applicant.phoneNumber || 'N/A'}</p>
                                    </div>
                                    {applicant.notes && (
                                        <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs text-slate-600 whitespace-pre-wrap">
                                            {applicant.notes}
                                        </div>
                                    )}
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">REF: {applicant.referenceId}</span>
                                        <span>Logged by: {applicant.createdByName}</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(applicant.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
                                <button onClick={() => handleComplete(applicant)} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Complete
                                </button>
                                <button onClick={() => { setEditingApplicant(applicant); setEditFormData({ ...applicant }); }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1">
                                    <Edit className="w-3.5 h-3.5" />
                                    Edit
                                </button>
                                <button onClick={() => handleDelete(applicant.id)} className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1">
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete
                                </button>
                                <button onClick={() => handleCopy(applicant)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ml-auto">
                                    <Copy className="w-3.5 h-3.5" />
                                    Copy
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editingApplicant && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-slate-800">Edit Applicant</h3>
                            <button onClick={() => setEditingApplicant(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-all">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <input type="text" value={editFormData.name || ''} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} placeholder="Name" className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]" />
                            <input type="text" value={editFormData.bank || ''} onChange={(e) => setEditFormData({ ...editFormData, bank: e.target.value })} placeholder="Bank" className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]" />
                            <input type="text" value={editFormData.position || ''} onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })} placeholder="Position" className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]" />
                            <input type="text" value={editFormData.branch || ''} onChange={(e) => setEditFormData({ ...editFormData, branch: e.target.value })} placeholder="Branch" className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]" />
                            <input type="text" value={editFormData.phoneNumber || ''} onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })} placeholder="Phone Number" className="w-full p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]" />
                            <textarea value={editFormData.notes || ''} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} placeholder="Notes" className="w-full p-2 border border-slate-200 rounded-xl text-sm h-20 focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]" />
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={handleEditSave} className="flex-1 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black rounded-xl transition-all cursor-pointer">
                                Save Changes
                            </button>
                            <button onClick={() => setEditingApplicant(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all cursor-pointer">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}