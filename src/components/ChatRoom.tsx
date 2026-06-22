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
  AlertCircle,
  Phone,
  CornerDownLeft,
  Users,
  Plus,
  X,
  Bell,
  BellRing
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

  // Handle Send - NOW SUPPORTS ENTER KEY
  // Handle Send - FIXED
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
  // Handle Enter key press - FIXED
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Call handleSendMessage directly with the event
      handleSendMessage(e as any);
    }
  };

  // Handle Group Chat Creation
  const handleCreateGroup = async () => {
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
    } catch (err) {
      console.error("Failed to create group", err);
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

  return (
    <div className="relative bg-white border border-slate-200 shadow-3xs rounded-2xl flex flex-col md:flex-row h-[580px] overflow-hidden animate-fade-in font-sans">
      {/* NOTIFICATION BELL - Always visible */}
      <div className="absolute top-3 right-3 z-50">
        <button
          onClick={handleBellClick}
          className="relative p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full shadow-lg transition-all cursor-pointer border border-slate-200"
          title={totalUnread > 0 ? `${totalUnread} unread messages` : "No new messages"}
        >
          {totalUnread > 0 ? (
            <BellRing className="w-5 h-5 text-rose-500 animate-pulse" />
          ) : (
            <Bell className="w-5 h-5 text-slate-400" />
          )}
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
              {totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* LEFT COLUMN: CONTACT PANEL */}
      <div className="w-full md:w-80 border-r border-slate-150 flex flex-col h-full bg-slate-50/50">
        {/* Contact List Header with Search */}
        <div className="p-4 border-b border-slate-150 bg-white space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#8B5CF6]" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Staff Chat</h3>
            </div>
            {/* GROUP CHAT BUTTON - Only for Admin */}
            {isAdmin && (
              <button
                onClick={() => setShowGroupModal(true)}
                className="p-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg hover:bg-[#8B5CF6]/20 transition-all cursor-pointer"
                title="Create Group Chat"
              >
                <Users className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search staff..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250/70 text-[10.5px] pl-8 pr-3.5 py-2 rounded-xl text-slate-800 outline-none focus:ring-1 focus:ring-[#8B5CF6] font-bold"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
          {filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-[10.5px] font-bold text-slate-400 italic">
              No matching employees found.
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
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${isSelected
                      ? 'bg-violet-50/90 border border-violet-100 shadow-3xs'
                      : 'bg-transparent border border-transparent hover:bg-slate-100/50'
                    }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[10.5px] shrink-0 font-mono ${isSelected ? 'bg-[#8B5CF6] text-white' : 'bg-slate-200 text-slate-650'
                    }`}>
                    {getInitials(user.fullName)}
                  </div>

                  <div className="flex-1 min-w-0 leading-tight space-y-0.5">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[11px] font-extrabold text-slate-850 truncate block">{user.fullName}</span>
                      {meta && (
                        <span className="text-[7.5px] font-black text-slate-400 shrink-0 font-mono">{meta.time}</span>
                      )}
                    </div>
                    <div className="text-[8px] font-black text-slate-450 uppercase tracking-wider block font-mono truncate leading-none">
                      {user.customRole || user.role} | {user.workspace?.replace('_', ' ') || 'all'}
                    </div>
                    {meta ? (
                      <p className="text-[9.5px] text-slate-500 truncate leading-tight mt-0.5 font-sans font-medium">
                        {meta.content}
                      </p>
                    ) : (
                      <p className="text-[9px] text-slate-350 italic truncate leading-tight font-medium">
                        Start conversation
                      </p>
                    )}
                  </div>

                  {ucount > 0 && (
                    <span className="h-4.5 min-w-4.5 px-1 bg-rose-500 rounded-full text-[8.5px] font-black text-white flex items-center justify-center shrink-0 font-mono animate-pulse">
                      {ucount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Current user footer */}
        <div className="p-3 border-t border-slate-150 bg-white shrink-0 flex items-center gap-2">
          <div className="w-6 h-6.5 rounded-full bg-slate-100 p-1 flex items-center justify-center border border-slate-200">
            <UserIcon className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="leading-tight">
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider leading-none">You</span>
            <span className="text-[10px] font-extrabold text-slate-800 block truncate leading-none mt-0.5">{currentUser.fullName}</span>
          </div>
          {totalUnread > 0 && (
            <span className="ml-auto text-[8px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black">
              {totalUnread} new
            </span>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE CHAT */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/20">
        {activeContact ? (
          <>
            {/* Header */}
            <div className="px-4.5 py-3 border-b border-slate-150 bg-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] font-black text-[10.5px] flex items-center justify-center font-mono border border-violet-150">
                  {getInitials(activeContact.fullName)}
                </div>
                <div>
                  <h4 className="text-[11.5px] font-black text-slate-850 tracking-tight leading-none">{activeContact.fullName}</h4>
                  <p className="text-[8.5px] text-slate-450 uppercase tracking-widest block font-mono mt-0.5 leading-none">
                    {activeContact.customRole || activeContact.role} | {activeContact.workspace?.toUpperCase().replace('_', ' ') || 'ALL'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-wider border border-emerald-100/50">
                <Shield className="w-3 h-3 text-emerald-600" />
                SECURE
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4.5 space-y-3.5 bg-[#F8FAFC]">
              {activeConversationMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-2 p-6">
                  <div className="p-3 bg-white border border-slate-150 rounded-2xl shadow-3xs">
                    <MessageSquare className="w-6 h-6 text-slate-350" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10.5px] font-bold text-slate-700">Secure Channel Open</p>
                    <p className="text-[9px] text-slate-400 font-medium max-w-xs">
                      Send your first message to start the conversation.
                    </p>
                  </div>
                </div>
              ) : (
                activeConversationMessages.map((msg) => {
                  const isSender = msg.sender === currentUser.phoneNumber;
                  const timeLabel = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isSender ? 'items-end' : 'items-start'} space-y-1 max-w-[85%] ${isSender ? 'ml-auto' : 'mr-auto'}`}
                    >
                      <div className={`p-3 rounded-2xl text-[11px] leading-relaxed shadow-3xs ${isSender
                          ? 'bg-[#8B5CF6] text-white rounded-br-none'
                          : 'bg-white border border-slate-150 text-slate-805 rounded-bl-none'
                        }`}>
                        {msg.content}
                      </div>

                      <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 font-mono tracking-wide px-1">
                        <span>{timeLabel}</span>
                        {isSender && (
                          msg.read ? (
                            <CheckCheck className="w-3 h-3 text-sky-500" />
                          ) : (
                            <Check className="w-2.5 h-2.5 text-slate-350" />
                          )
                        )}
                        {isSender && (
                          <span className="text-[7.5px] text-slate-250 italic">
                            {msg.read ? 'seen' : 'sent'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input - ENTER KEY WORKS NOW */}
            <form
              onSubmit={handleSendMessage}
              className="px-4 py-3 bg-white border-t border-slate-150 shrink-0 flex items-center gap-2"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder={`Message ${activeContact.fullName.split(' ')[0]}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[11px] font-bold outline-none focus:ring-1 focus:ring-[#8B5CF6] text-slate-800 pr-16"
                />
                <div className="absolute right-2.5 top-2.5 hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[8px] text-slate-400 font-mono font-black border border-slate-200 leading-none">
                  <CornerDownLeft className="w-2 h-2 text-slate-400" />
                  ENTER
                </div>
              </div>

              <button
                type="submit"
                disabled={!messageText.trim()}
                className={`p-2.5 rounded-xl transition-all shadow-3xs shrink-0 flex items-center justify-center cursor-pointer ${messageText.trim()
                    ? 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:scale-95'
                    : 'bg-slate-100 text-slate-350 border border-slate-200'
                  }`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
            <div className="p-4 bg-violet-50 text-[#8B5CF6] border border-violet-100/70 rounded-full shadow-3xs">
              <MessageSquare className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Staff Communications</h4>
              <p className="text-[10px] text-slate-500 font-medium max-w-xs mx-auto">
                Select a staff member from the list to start a secure conversation.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* GROUP CHAT MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#8B5CF6]" />
                Create Group Chat
              </h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Renewal Team"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">
                  Select Members ({selectedMembers.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2">
                  {users.map(user => (
                    <button
                      key={user.phoneNumber}
                      onClick={() => toggleMember(user.phoneNumber)}
                      className={`w-full text-left p-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${selectedMembers.includes(user.phoneNumber)
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
                className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${groupName.trim() && selectedMembers.length >= 2
                    ? 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
              >
                Create Group ({selectedMembers.length} members)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}