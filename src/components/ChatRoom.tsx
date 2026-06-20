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
  CornerDownLeft
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

  // Subscribe to Users & Messages
  useEffect(() => {
    const unsubscribeUsers = dbService.subscribeUsers((updatedUsers) => {
      // Exclude self from the chat listing
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

  // Secure Workspace Filtering & Search matching
  const filteredUsers = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    
    return users.filter(u => {
      // 1. Search Query Match
      const matchesSearch = 
        u.fullName.toLowerCase().includes(q) || 
        u.phoneNumber.includes(q) ||
        (u.customRole || u.role || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Workspace Isolate & Security check:
      // Admins, Super Admins, multi-workspace players, or special role 'FTD' & 'Contact Center' can chat with all staff.
      const isPrivilegedRole = 
        currentUser.role === 'admin' || 
        currentUser.role === 'super_admin' || 
        currentUser.role === 'FTD' || 
        currentUser.role === 'Contact Center';

      if (isPrivilegedRole || currentUser.workspace === 'both') {
        return true;
      }

      // Rest Of Employees: Can only see colleagues in the SAME workspace round, or admins, or those assigned to 'both'.
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

  // Last Message preview and timestamp per contact
  const conversationMetaMap = useMemo(() => {
    const meta: Record<string, { content: string; time: string; timestamp: string }> = {};
    messages.forEach(msg => {
      const isSent = msg.sender === currentUser.phoneNumber;
      const otherParty = isSent ? msg.receiver : msg.sender;

      // Keep only most recent
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
    return messages.filter(
      msg => (msg.sender === currentUser.phoneNumber && msg.receiver === activeContact.phoneNumber) ||
             (msg.sender === activeContact.phoneNumber && msg.receiver === currentUser.phoneNumber)
    );
  }, [messages, activeContact, currentUser.phoneNumber]);

  // Handle Send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  // Helper Initials
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="bg-white border Richmond border-slate-200 shadow-3xs rounded-2xl flex flex-col md:flex-row h-[580px] overflow-hidden animate-fade-in font-sans">
      {/* LEFT COLUMN: CONTACT PANEL */}
      <div className="w-full md:w-80 border-r border-slate-150 flex flex-col h-full bg-slate-50/50">
        {/* Contact List Header with Search */}
        <div className="p-4 border-b border-slate-150 bg-white space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#8B5CF6]" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Internal Registry Chat</h3>
          </div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search staff registry by name/phone..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250/70 text-[10.5px] pl-8 pr-3.5 py-2 rounded-xl text-slate-800 outline-none focus:ring-1 focus:ring-[#8B5CF6] font-bold"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Contact list flow */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
          {filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-[10.5px] font-bold text-slate-400 italic">
              No matching employees accessible matching secure workspace criteria.
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
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 cursor-pointer ${
                    isSelected 
                      ? 'bg-violet-50/90 border border-violet-100 shadow-3xs' 
                      : 'bg-transparent border border-transparent hover:bg-slate-100/50'
                  }`}
                >
                  {/* Left Logo Emblem */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-[10.5px] shrink-0 font-mono ${
                    isSelected ? 'bg-[#8B5CF6] text-white' : 'bg-slate-200 text-slate-650'
                  }`}>
                    {getInitials(user.fullName)}
                  </div>

                  {/* Middle Data */}
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
                        (Start secure conversation)
                      </p>
                    )}
                  </div>

                  {/* Right Badges */}
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

        {/* Current user footer signature */}
        <div className="p-3 border-t border-slate-150 bg-white shrink-0 flex items-center gap-2">
          <div className="w-6 h-6.5 rounded-full bg-slate-905 text-slate-800 bg-slate-100 p-1 flex items-center justify-center border border-slate-200">
            <UserIcon className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="leading-tight">
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider leading-none">Your Node</span>
            <span className="text-[10px] font-extrabold text-slate-800 block truncate leading-none mt-0.5">{currentUser.fullName}</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE CHAT SCREEN */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/20">
        {activeContact ? (
          <>
            {/* Header section with contact details */}
            <div className="px-4.5 py-3 border-b border-slate-150 bg-white flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] font-black text-[10.5px] flex items-center justify-center font-mono border border-violet-150">
                  {getInitials(activeContact.fullName)}
                </div>
                <div>
                  <h4 className="text-[11.5px] font-black text-slate-850 tracking-tight leading-none">{activeContact.fullName}</h4>
                  <p className="text-[8.5px] text-slate-450 uppercase tracking-widest block font-mono mt-0.5 leading-none">
                    {activeContact.customRole || activeContact.role} | Workspace: <strong className="text-violet-600">{activeContact.workspace?.toUpperCase().replace('_', ' ') || 'ALL'}</strong>
                  </p>
                </div>
              </div>

              {/* Secure workspace banner */}
              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-wider border border-emerald-100/50">
                <Shield className="w-3 h-3 text-emerald-600" />
                SECURE END-TO-END
              </div>
            </div>

            {/* Chat Stream message logs list */}
            <div className="flex-1 overflow-y-auto p-4.5 space-y-3.5 bg-[#F8FAFC]">
              {activeConversationMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-2 p-6">
                  <div className="p-3 bg-white border border-slate-150 rounded-2xl shadow-3xs">
                    <MessageSquare className="w-6 h-6 text-slate-350 animate-bounce" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10.5px] font-bold text-slate-700">Encrypted Registry Workspace Tunnel Open</p>
                    <p className="text-[9px] text-slate-400 font-medium max-w-xs">
                      Type your message in the command line below to begin real-time staff communication. No customer profiles can access this deck.
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
                      <div className={`p-3 rounded-2xl text-[11px] leading-relaxed shadow-3xs ${
                        isSender 
                          ? 'bg-[#8B5CF6] text-white rounded-br-none' 
                          : 'bg-white border border-slate-150 text-slate-805 rounded-bl-none'
                      }`}>
                        {msg.content}
                      </div>

                      <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 font-mono tracking-wide px-1">
                        <span>{timeLabel}</span>
                        {isSender && (
                          msg.read ? (
                            <CheckCheck className="w-3 h-3 text-sky-505 text-indigo-505 text-sky-500" />
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

            {/* Prompt input control form */}
            <form 
              onSubmit={handleSendMessage}
              className="px-4 py-3 bg-white border-t border-slate-150 shrink-0 flex items-center gap-2"
            >
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder={`Send private message to ${activeContact.fullName.split(' ')[0]}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[11px] font-bold outline-none focus:ring-1 focus:ring-[#8B5CF6] text-slate-800 pr-16"
                />
                
                {/* Visual send key reminder */}
                <div className="absolute right-2.5 top-2.5 hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[8px] text-slate-400 font-mono font-black border border-slate-200 leading-none">
                  <CornerDownLeft className="w-2 h-2 text-slate-400" />
                  ENTER
                </div>
              </div>

              <button
                type="submit"
                disabled={!messageText.trim()}
                className={`p-2.5 rounded-xl transition-all shadow-3xs shrink-0 flex items-center justify-center cursor-pointer ${
                  messageText.trim() 
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
            <div className="p-4 bg-violet-50 text-[#8B5CF6] border border-violet-100/70 rounded-full animate-pulse shadow-3xs">
              <MessageSquare className="w-7 h-7" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Internal Communications Hub</h4>
              <p className="text-[10px] text-slate-500 font-medium max-w-xs mx-auto">
                Select another teammate from the staff register sidebar on the left to begin a secure, real-time encrypted connection.
              </p>
            </div>
            
            <div className="inline-flex items-center gap-1 bg-slate-100/60 text-slate-450 text-[8px] font-mono font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-slate-200">
              <AlertCircle className="w-3 h-3 text-indigo-500" />
              Personnel Database Tunnel Active
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
