// src/components/ChatRoom.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChatMessage } from '../types';
import { dbService } from '../services/db';
import {
  MessageSquare,
  Search,
  Send,
  Shield,
  User as UserIcon,
  Check,
  CheckCheck,
  CornerDownLeft,
  Users,
  Plus,
  X,
  Bell,
  BellRing,
  Crown,
  Trash2,
  MoreVertical,
  Phone,
  Video,
  Smile
} from 'lucide-react';

interface ChatRoomProps {
  currentUser: User;
}

export default function ChatRoom({ currentUser }: ChatRoomProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeContact, setActiveContact] = useState<User | null>(null);
  const [searchText, setSearchText] = useState('');
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Group chat states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  // Subscribe to Users & Messages
  useEffect(() => {
    const unsubscribeUsers = dbService.subscribeUsers((updatedUsers) => {
      setUsers(updatedUsers.filter(u => u.phoneNumber !== currentUser.phoneNumber));
    });

    const unsubscribeChats = dbService.subscribeChats((updatedMessages) => {
      console.log('📨 Received messages:', updatedMessages);
      setMessages(updatedMessages);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeChats();
    };
  }, [currentUser.phoneNumber]);

  // Scroll to bottom when messages or active contact changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeContact]);

  // Auto mark incoming/current messages as read
  useEffect(() => {
    if (!activeContact) return;

    const unreadMessages = messages.filter(
      msg => msg.sender === activeContact.phoneNumber &&
        msg.receiver === currentUser.phoneNumber &&
        !msg.read
    );

    unreadMessages.forEach(msg => {
      dbService.markMessageAsRead(msg.id).catch(err => {
        console.error("Could not auto-mark message as read", err);
      });
    });
  }, [messages, activeContact, currentUser.phoneNumber]);

  // Filter users for contact list
  const filteredUsers = useMemo(() => {
    const q = searchText.toLowerCase().trim();

    return users.filter(u => {
      const matchesSearch =
        u.fullName.toLowerCase().includes(q) ||
        u.phoneNumber.includes(q) ||
        (u.customRole || u.role || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const isPrivilegedRole =
        currentUser.role === 'admin' ||
        currentUser.role === 'super_admin' ||
        currentUser.role === 'FTD' ||
        currentUser.role === 'Contact Center';

      if (isPrivilegedRole || currentUser.workspace === 'both') {
        return true;
      }

      const targetIsAdmin = u.role === 'admin' || u.role === 'super_admin';
      const targetSameWorkspace = u.workspace === currentUser.workspace || u.workspace === 'both';

      return targetIsAdmin || targetSameWorkspace;
    });
  }, [users, searchText, currentUser]);

  // Unread Message Counts per User Phone Number
  const unreadCounterMap = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(msg => {
      if (msg.receiver === currentUser.phoneNumber && !msg.read) {
        counts[msg.sender] = (counts[msg.sender] || 0) + 1;
      }
    });
    return counts;
  }, [messages, currentUser.phoneNumber]);

  // Total unread count for notification bell
  const totalUnread = useMemo(() => {
    return Object.values(unreadCounterMap).reduce((a, b) => a + b, 0);
  }, [unreadCounterMap]);

  // Last Message preview and timestamp per contact
  const conversationMetaMap = useMemo(() => {
    const meta: Record<string, { content: string; time: string; timestamp: string }> = {};
    messages.forEach(msg => {
      const isSent = msg.sender === currentUser.phoneNumber;
      const otherParty = isSent ? msg.receiver : msg.sender;

      const msgMeta = {
        content: msg.content,
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: msg.createdAt
      };

      const existing = meta[otherParty];
      if (!existing || msg.createdAt > existing.timestamp) {
        meta[otherParty] = msgMeta;
      }
    });
    return meta;
  }, [messages, currentUser.phoneNumber]);

  // Filter messages for active chat conversation
  const activeConversationMessages = useMemo(() => {
    if (!activeContact) return [];
    return messages
      .filter(
        msg => (msg.sender === currentUser.phoneNumber && msg.receiver === activeContact.phoneNumber) ||
          (msg.sender === activeContact.phoneNumber && msg.receiver === currentUser.phoneNumber)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, activeContact, currentUser.phoneNumber]);

  // Handle Send
  const handleSendMessage = async (e?: React.FormEvent | any) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (!messageText.trim() || !activeContact) return;

    try {
      await dbService.sendChatMessage({
        sender: currentUser.phoneNumber,
        receiver: activeContact.phoneNumber,
        workspace: currentUser.workspace || 'both',
        content: messageText.trim()
      });
      setMessageText('');
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;
    try {
      // Delete from database
      await dbService.deleteMessage?.(messageId) || console.warn('Delete not implemented in dbService');
      // Remove from local state
      setMessages(messages.filter(msg => msg.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  // Handle Group Chat Creation - ONLY for Admin/Super Admin
  const handleCreateGroup = async () => {
    if (!isAdmin) {
      alert('Only administrators can create group chats.');
      return;
    }
    if (!groupName.trim() || selectedMembers.length < 2) return;

    try {
      const groupId = `group_${Date.now()}`;
      const groupData = {
        id: groupId,
        name: groupName.trim(),
        members: [currentUser.phoneNumber, ...selectedMembers],
        createdBy: currentUser.phoneNumber,
        createdAt: new Date().toISOString(),
        isGroup: true
      };

      await dbService.createGroupChat(groupData);

      // Send welcome message to all members
      for (const member of selectedMembers) {
        await dbService.sendChatMessage({
          sender: currentUser.phoneNumber,
          receiver: member,
          workspace: currentUser.workspace || 'both',
          content: `📢 You have been added to group: ${groupName}`,
          groupId: groupId
        });
      }

      setShowGroupModal(false);
      setGroupName('');
      setSelectedMembers([]);
      alert('✅ Group created successfully!');
    } catch (err) {
      console.error("Failed to create group", err);
      alert('❌ Failed to create group.');
    }
  };

  // Toggle member selection
  const toggleMember = (phone: string) => {
    setSelectedMembers(prev =>
      prev.includes(phone)
        ? prev.filter(p => p !== phone)
        : [...prev, phone]
    );
  };

  // Helper Initials
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  // Handle notification bell click - go to first unread
  const handleBellClick = () => {
    const firstUnread = users.find(u => unreadCounterMap[u.phoneNumber] > 0);
    if (firstUnread) {
      setActiveContact(firstUnread);
    }
  };

  // Format timestamp for messages
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative bg-white border border-slate-200 shadow-lg rounded-2xl flex flex-col md:flex-row h-[75vh] min-h-[500px] overflow-hidden animate-fade-in font-sans">
      {/* NOTIFICATION BELL - Always visible */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={handleBellClick}
          className="relative p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-full shadow-md transition-all cursor-pointer border border-slate-200 hover:shadow-lg"
          title={totalUnread > 0 ? `${totalUnread} unread messages` : "No new messages"}
        >
          {totalUnread > 0 ? (
            <BellRing className="w-5 h-5 text-rose-500 animate-pulse" />
          ) : (
            <Bell className="w-5 h-5 text-slate-400" />
          )}
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-sm">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* LEFT COLUMN: CONTACT PANEL */}
      <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col h-full bg-gradient-to-b from-slate-50/50 to-white">
        {/* Contact List Header */}
        <div className="p-5 border-b border-slate-200 bg-white/80 backdrop-blur-sm space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#8B5CF6]/10 rounded-xl">
                <MessageSquare className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight">Messages</h3>
                <p className="text-[10px] text-slate-400 font-medium">Staff Communications</p>
              </div>
            </div>
            {/* GROUP CHAT BUTTON - Only for Admin/Super Admin */}
            {isAdmin && (
              <button
                onClick={() => setShowGroupModal(true)}
                className="p-2 bg-[#8B5CF6] text-white rounded-xl hover:bg-[#7C3AED] transition-all cursor-pointer shadow-sm flex items-center gap-1.5 text-[10px] font-black uppercase"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">New Group</span>
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search staff members..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-white border border-slate-200 text-[11px] pl-10 pr-4 py-3 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] font-medium transition-all shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {filteredUsers.length === 0 ? (
            <div className="p-10 text-center">
              <UserIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-[11px] font-bold text-slate-400">No staff found</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Try adjusting your search</p>
            </div>
          ) : (
            filteredUsers.map(user => {
              const ucount = unreadCounterMap[user.phoneNumber] || 0;
              const meta = conversationMetaMap[user.phoneNumber];
              const isSelected = activeContact?.phoneNumber === user.phoneNumber;

              return (
                <button
                  key={user.phoneNumber}
                  onClick={() => setActiveContact(user)}
                  className={`w-full text-left p-3.5 rounded-xl transition-all flex items-center gap-3.5 cursor-pointer group ${isSelected
                      ? 'bg-[#8B5CF6] text-white shadow-md shadow-[#8B5CF6]/20'
                      : 'bg-transparent hover:bg-slate-100/80'
                    }`}
                >
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-[12px] shrink-0 font-mono transition-all ${isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                    }`}>
                    {getInitials(user.fullName)}
                  </div>

                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="flex justify-between items-start gap-1">
                      <span className={`text-[12px] font-extrabold truncate block ${isSelected ? 'text-white' : 'text-slate-800'
                        }`}>
                        {user.fullName}
                      </span>
                      {meta && (
                        <span className={`text-[8px] font-bold shrink-0 font-mono ${isSelected ? 'text-white/60' : 'text-slate-400'
                          }`}>
                          {meta.time}
                        </span>
                      )}
                    </div>
                    <div className={`text-[8px] font-black uppercase tracking-wider font-mono truncate leading-none mt-0.5 ${isSelected ? 'text-white/50' : 'text-slate-400'
                      }`}>
                      {user.customRole || user.role} · {user.workspace?.replace('_', ' ') || 'all'}
                    </div>
                    {meta ? (
                      <p className={`text-[10px] truncate leading-tight mt-1 font-medium ${isSelected ? 'text-white/70' : 'text-slate-500'
                        }`}>
                        {meta.content}
                      </p>
                    ) : (
                      <p className={`text-[9px] italic truncate leading-tight mt-1 font-medium ${isSelected ? 'text-white/40' : 'text-slate-350'
                        }`}>
                        No messages yet
                      </p>
                    )}
                  </div>

                  {ucount > 0 && (
                    <span className={`h-5 min-w-5 px-1.5 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 font-mono animate-pulse ${isSelected
                        ? 'bg-white text-[#8B5CF6]'
                        : 'bg-rose-500 text-white'
                      }`}>
                      {ucount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Current user footer */}
        <div className="p-4 border-t border-slate-200 bg-white/80 backdrop-blur-sm shrink-0 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center border border-[#8B5CF6]/20">
            <UserIcon className="w-4.5 h-4.5 text-[#8B5CF6]" />
          </div>
          <div className="leading-tight flex-1 min-w-0">
            <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider block leading-none">You</span>
            <span className="text-[11px] font-extrabold text-slate-800 block truncate leading-none mt-0.5">{currentUser.fullName}</span>
          </div>
          {totalUnread > 0 && (
            <span className="text-[8px] bg-rose-500 text-white px-2.5 py-1 rounded-full font-black animate-pulse">
              {totalUnread} new
            </span>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE CHAT */}
      <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-slate-50/20 to-white">
        {activeContact ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] font-black text-[12px] flex items-center justify-center font-mono border-2 border-violet-200 shadow-sm">
                  {getInitials(activeContact.fullName)}
                </div>
                <div>
                  <h4 className="text-[14px] font-black text-slate-800 tracking-tight leading-none">{activeContact.fullName}</h4>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mt-1 leading-none">
                    {activeContact.customRole || activeContact.role} · {activeContact.workspace?.toUpperCase().replace('_', ' ') || 'ALL'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3.5 py-1.5 rounded-full text-[8.5px] font-black uppercase tracking-wider border border-emerald-100/60 shadow-sm">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Secure</span>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-slate-50/30 to-white">
              {activeConversationMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <MessageSquare className="w-10 h-10 text-[#8B5CF6]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[13px] font-black text-slate-700">Secure Channel Open</p>
                    <p className="text-[10px] text-slate-400 font-medium max-w-xs">
                      Send your first message to start the conversation with {activeContact.fullName.split(' ')[0]}.
                    </p>
                  </div>
                </div>
              ) : (
                activeConversationMessages.map((msg) => {
                  const isSender = msg.sender === currentUser.phoneNumber;
                  const timeLabel = formatMessageTime(msg.createdAt);

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isSender ? 'items-end' : 'items-start'} space-y-1 max-w-[75%] ${isSender ? 'ml-auto' : 'mr-auto'}`}
                    >
                      <div className={`p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${isSender
                          ? 'bg-[#8B5CF6] text-white rounded-br-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                        }`}>
                        {msg.content}
                      </div>

                      <div className="flex items-center gap-2 text-[8.5px] font-bold text-slate-400 font-mono tracking-wide px-1">
                        <span>{timeLabel}</span>
                        {isSender && (
                          msg.read ? (
                            <CheckCheck className="w-3.5 h-3.5 text-sky-500" />
                          ) : (
                            <Check className="w-3 h-3 text-slate-300" />
                          )
                        )}
                        {isSender && (
                          <span className="text-[7.5px] text-slate-350 italic">
                            {msg.read ? 'seen' : 'sent'}
                          </span>
                        )}
                        {/* Delete button - only for sender */}
                        {isSender && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-0.5 hover:bg-slate-100 rounded-md transition-all text-slate-400 hover:text-rose-500"
                            title="Delete message"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="px-6 py-4 bg-white/80 backdrop-blur-sm border-t border-slate-200 shrink-0 flex items-center gap-3"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder={`Message ${activeContact.fullName.split(' ')[0]}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 text-slate-800 pr-20 transition-all"
                />
                <div className="absolute right-3 top-3 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-[8px] text-slate-400 font-mono font-black border border-slate-200 leading-none">
                  <CornerDownLeft className="w-2.5 h-2.5 text-slate-400" />
                  ENTER
                </div>
              </div>

              <button
                type="submit"
                disabled={!messageText.trim()}
                className={`p-3.5 rounded-xl transition-all shadow-sm shrink-0 flex items-center justify-center cursor-pointer ${messageText.trim()
                    ? 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:scale-95 shadow-md shadow-[#8B5CF6]/25'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </>
        ) : (
          // No active contact - empty state
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-5">
            <div className="p-6 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-full shadow-sm">
              <MessageSquare className="w-12 h-12 text-[#8B5CF6]" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-lg font-black text-slate-800 tracking-tight">Staff Communications</h4>
              <p className="text-[11px] text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                Select a staff member from the list on the left to start a secure conversation.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowGroupModal(true)}
                className="mt-2 px-6 py-3 bg-[#8B5CF6] text-white text-[11px] font-black uppercase tracking-wider rounded-xl hover:bg-[#7C3AED] transition-all shadow-md shadow-[#8B5CF6]/20 flex items-center gap-2"
              >
                <Users className="w-4.5 h-4.5" />
                Create Group Chat
              </button>
            )}
          </div>
        )}
      </div>

      {/* GROUP CHAT MODAL - Only for Admin/Super Admin */}
      {showGroupModal && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2.5">
                <Users className="w-5 h-5 text-[#8B5CF6]" />
                Create Group Chat
              </h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1.5">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Renewal Team"
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">
                  Select Members <span className="text-slate-400 font-normal">({selectedMembers.length} selected)</span>
                </label>
                <div className="max-h-52 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2.5">
                  {users.map(user => (
                    <button
                      key={user.phoneNumber}
                      onClick={() => toggleMember(user.phoneNumber)}
                      className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer ${selectedMembers.includes(user.phoneNumber)
                          ? 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/30'
                          : 'hover:bg-slate-50'
                        }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-[10px]">
                        {getInitials(user.fullName)}
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-800 block">{user.fullName}</span>
                        <span className="text-[9px] text-slate-400">{user.role}</span>
                      </div>
                      {selectedMembers.includes(user.phoneNumber) && (
                        <Check className="w-4 h-4 text-[#8B5CF6]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedMembers.length < 2}
                className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${groupName.trim() && selectedMembers.length >= 2
                    ? 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow-md shadow-[#8B5CF6]/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
              >
                Create Group ({selectedMembers.length} members)
              </button>

              <p className="text-[8px] text-slate-400 text-center font-medium">
                <Crown className="w-3 h-3 inline text-amber-500 mr-1" />
                Only administrators can create group chats
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}