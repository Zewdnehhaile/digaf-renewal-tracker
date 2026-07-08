// src/components/ChatRoom.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChatMessage } from '../types';
import { dbService } from '../services/db';
import { notificationService } from '../services/notificationService';
import { io, Socket } from 'socket.io-client';
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
  Phone,
  Video,
  Smile,
  Paperclip,
  Settings,
  Users as UsersIcon,
  MessageCircle,
  Download,
  File,
  Image,
  FileText,
  Music,
  Archive,
  Film,
  PhoneCall,
  Video as VideoIcon,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from 'lucide-react';

interface ChatRoomProps {
  currentUser: User;
}

// Full emoji list with categories
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😊', '😂', '😍', '😎', '🤩', '🥳', '😇', '🤗', '😘', '🥰', '😁', '😆', '😜', '🤪', '😝', '🤓', '🧐', '🤨', '😏', '😒', '😔', '😌', '😉', '😃', '😄', '😀', '😬', '😑', '😶', '😐', '😕', '😟', '😢', '😭', '😤', '😠', '😡', '😰', '😨', '😱', '😳', '😵', '🥺', '🥴', '🥵', '🥶', '🤯', '🤬', '🤫', '🤭', '🥱', '😴']
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👏', '🤝', '🙏', '💪', '👋', '✌️', '🤞', '🖐️', '👊', '🖖', '🤙', '💅', '💃', '🕺', '🧘', '🚶', '🏃', '🧎', '💂', '👷', '👮', '🕵️', '👩‍💻', '👨‍💻', '👩‍🏫', '👨‍🏫', '👩‍⚕️', '👨‍⚕️', '👩‍🍳', '👨‍🍳']
  },
  {
    name: 'Heart',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💗', '💖', '💕', '💞', '💓', '💘', '💝', '💟', '💋', '💌', '💏', '💑', '💒', '💍', '💎']
  },
  {
    name: 'Symbols',
    emojis: ['🔥', '🎉', '💯', '✨', '🌟', '⭐', '💫', '🌈', '🌙', '☀️', '🌊', '⚡', '🔮', '🎯', '🎖️', '🏆', '🥇', '🥈', '🥉', '🎭', '🎪', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻']
  },
  {
    name: 'Animals',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦄', '🐴', '🦓', '🦒', '🐘', '🦏', '🐪', '🐫', '🦙', '🦘', '🐃', '🐂', '🐄', '🐖', '🐏', '🐑', '🐐', '🐊', '🦎', '🐢', '🐍', '🐲', '🐉', '🦕', '🦖']
  },
  {
    name: 'Food',
    emojis: ['🍕', '🍔', '🌮', '🌯', '🥙', '🥗', '🥪', '🍟', '🍝', '🌭', '🍿', '🧇', '🥞', '🧈', '🍳', '🥚', '🍞', '🥐', '🥖', '🥨', '🥯', '🧀', '🥩', '🍗', '🍖', '🍠', '🥔', '🌽', '🥕', '🥦', '🍅', '🍆', '🥒', '🥬', '🧄', '🧅', '🍄', '🥜', '🌰', '🍄', '🥚', '🍳', '🥞']
  }
];

// File type icons
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) return <Image className="w-5 h-5" />;
  if (['pdf'].includes(ext)) return <FileText className="w-5 h-5" />;
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return <FileText className="w-5 h-5" />;
  if (['mp3', 'wav', 'aac', 'flac', 'ogg'].includes(ext)) return <Music className="w-5 h-5" />;
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(ext)) return <Film className="w-5 h-5" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <Archive className="w-5 h-5" />;
  return <File className="w-5 h-5" />;
};

export default function ChatRoom({ currentUser }: ChatRoomProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeContact, setActiveContact] = useState<User | null>(null);
  const [searchText, setSearchText] = useState('');
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'groups'>('chats');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadedFileUrls, setUploadedFileUrls] = useState<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========== SOCKET.IO STATES ==========
  const [socket, setSocket] = useState<Socket | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [incomingCaller, setIncomingCaller] = useState<string | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected'>('idle');

  // Call states
  const [isCalling, setIsCalling] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callTimer, setCallTimer] = useState(0);
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Group chat states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsNotifications, setSettingsNotifications] = useState(true);
  const [settingsSound, setSettingsSound] = useState(true);

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  // ========== SOCKET.IO INITIALIZATION ==========
  useEffect(() => {
    const socketUrl = process.env.NODE_ENV === 'production'
      ? 'https://digaf-api.onrender.com'  // ✅ Your backend on Render
      : 'http://localhost:3000';
    const newSocket = io(socketUrl);
    newSocket.emit('register', currentUser.phoneNumber);

    // Listen for incoming calls
    newSocket.on('incoming-call', ({ from, offer, type }) => {
      setIncomingCaller(from);
      setIncomingOffer(offer);
      setCallType(type);
      setCallStatus('incoming');
      // Play ringtone sound if allowed
      if (settingsSound) {
        try {
          // Try multiple paths
          const audio = new Audio('/ringtone.mp3');
          audio.play().catch(() => {
            // Fallback: use Web Audio API to generate a simple beep
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
          });
        } catch (e) { }
      }
    });

    newSocket.on('call-connected', ({ from, answer }) => {
      if (peerConnection) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus('connected');
        setIsCalling(false);
        setIsInCall(true);
      }
    });

    newSocket.on('call-ended', ({ from }) => {
      endRealCall();
    });

    newSocket.on('call-rejected', ({ from }) => {
      alert(`📞 ${from} rejected your call.`);
      setIsCalling(false);
      setCallStatus('idle');
    });

    newSocket.on('ice-candidate', ({ from, candidate }) => {
      if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, [currentUser.phoneNumber]);

  // Fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await dbService.getGroupChats();
        setGroups(data);
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };
    fetchGroups();
  }, []);

  // Subscribe to users and messages
  useEffect(() => {
    const unsubscribeUsers = dbService.subscribeUsers((updatedUsers) => {
      const filteredUsers = updatedUsers.filter(u => u.phoneNumber !== currentUser.phoneNumber);
      setUsers(filteredUsers);
    });

    const unsubscribeChats = dbService.subscribeChats((updatedMessages) => {
      const userMessages = updatedMessages.filter(msg =>
        msg.sender === currentUser.phoneNumber ||
        msg.receiver === currentUser.phoneNumber ||
        (msg.groupId && groups.some(g => g.members?.includes(currentUser.phoneNumber)))
      );
      setMessages(userMessages);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeChats();
    };
  }, [currentUser.phoneNumber, groups]);

  // Notification logic
  const lastMessageCountRef = useRef(0);

  useEffect(() => {
    notificationService.requestPermission();

    if (lastMessageCountRef.current === 0 && messages.length > 0) {
      lastMessageCountRef.current = messages.length;
    }

    const checkForNewMessages = () => {
      if (messages.length > lastMessageCountRef.current) {
        const newestMsg = messages[0];

        if (newestMsg && newestMsg.sender !== currentUser.phoneNumber) {
          const sender = users.find(u => u.phoneNumber === newestMsg.sender);
          const senderName = sender ? sender.fullName : newestMsg.sender;

          notificationService.showBrowserNotification(
            `📩 New message from ${senderName}`,
            newestMsg.content.length > 60 ? newestMsg.content.substring(0, 60) + '...' : newestMsg.content,
            undefined,
            () => {
              window.focus();
              if (sender) {
                setActiveContact(sender);
              }
            }
          );
        }
        lastMessageCountRef.current = messages.length;
      }
    };

    checkForNewMessages();
    const intervalId = setInterval(checkForNewMessages, 3000);
    return () => clearInterval(intervalId);
  }, [messages, users, currentUser.phoneNumber]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeContact]);

  // Auto mark messages as read
  useEffect(() => {
    if (!activeContact) return;

    const unreadMessages = messages.filter(
      msg => msg.sender === activeContact.phoneNumber &&
        msg.receiver === currentUser.phoneNumber &&
        !msg.read
    );

    unreadMessages.forEach(msg => {
      dbService.markMessageAsRead(msg.id).catch(() => { });
    });
  }, [messages, activeContact, currentUser.phoneNumber]);

  // Call timer
  useEffect(() => {
    if (isInCall) {
      callTimerRef.current = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      setCallTimer(0);
    }
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    };
  }, [isInCall]);

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-[#8B5CF6]', 'bg-[#EC4899]', 'bg-[#F59E0B]', 'bg-[#10B981]',
      'bg-[#3B82F6]', 'bg-[#EF4444]', 'bg-[#14B8A6]', 'bg-[#F472B6]',
      'bg-[#34D399]', 'bg-[#60A5FA]', 'bg-[#FB923C]', 'bg-[#A855F7]'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const allContacts = useMemo(() => {
    const userContacts = users.map(u => ({ ...u, isGroup: false }));
    const groupContacts = groups.map(g => ({
      id: g.id,
      phoneNumber: g.id,
      fullName: g.name,
      role: 'Group',
      workspace: 'both',
      isGroup: true,
      members: g.members || [],
      createdBy: g.createdBy
    } as User));
    return [...userContacts, ...groupContacts];
  }, [users, groups]);

  const filteredContacts = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    let results = allContacts;

    if (activeTab === 'contacts') {
      results = allContacts.filter(c => !c.isGroup);
    } else if (activeTab === 'groups') {
      results = allContacts.filter(c => c.isGroup);
    }

    return results.filter(contact => {
      const name = contact.fullName?.toLowerCase() || '';
      const role = contact.customRole?.toLowerCase() || contact.role?.toLowerCase() || '';
      return name.includes(q) || role.includes(q);
    });
  }, [allContacts, searchText, activeTab]);

  const unreadCounterMap = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach(msg => {
      const target = msg.groupId || msg.receiver;
      if (msg.receiver === currentUser.phoneNumber && !msg.read) {
        counts[msg.sender] = (counts[msg.sender] || 0) + 1;
      }
      if (msg.groupId && !msg.read) {
        counts[msg.groupId] = (counts[msg.groupId] || 0) + 1;
      }
    });
    return counts;
  }, [messages, currentUser.phoneNumber]);

  const totalUnread = useMemo(() => {
    return Object.values(unreadCounterMap).reduce((a, b) => a + b, 0);
  }, [unreadCounterMap]);

  const conversationMetaMap = useMemo(() => {
    const meta: Record<string, { content: string; time: string; timestamp: string; sender: string }> = {};
    messages.forEach(msg => {
      const target = msg.groupId || (msg.sender === currentUser.phoneNumber ? msg.receiver : msg.sender);
      const isSent = msg.sender === currentUser.phoneNumber;

      const msgMeta = {
        content: isSent ? `You: ${msg.content}` : msg.content,
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: msg.createdAt,
        sender: msg.sender
      };

      const existing = meta[target];
      if (!existing || msg.createdAt > existing.timestamp) {
        meta[target] = msgMeta;
      }
    });
    return meta;
  }, [messages, currentUser.phoneNumber]);

  const activeConversationMessages = useMemo(() => {
    if (!activeContact) return [];
    const contactId = activeContact.isGroup ? activeContact.id : activeContact.phoneNumber;

    return messages
      .filter(msg => {
        if (activeContact.isGroup) {
          return msg.groupId === contactId;
        }
        return (msg.sender === currentUser.phoneNumber && msg.receiver === contactId) ||
          (msg.sender === contactId && msg.receiver === currentUser.phoneNumber);
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, activeContact, currentUser.phoneNumber]);

  // ========== REAL CALL FUNCTIONS ==========
  const startRealCall = async (type: 'voice' | 'video') => {
    if (!activeContact || !socket) {
      alert('Please select a contact first.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      });

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            to: activeContact.phoneNumber,
            candidate: event.candidate
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call-offer', {
        to: activeContact.phoneNumber,
        offer: offer,
        type: type
      });

      setPeerConnection(pc);
      setCallStatus('calling');
      setCallType(type);
      setIsCalling(true);

      socket.once('call-connected', async ({ answer }) => {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        setCallStatus('connected');
        setIsCalling(false);
        setIsInCall(true);
      });

      socket.once('call-rejected', () => {
        setIsCalling(false);
        setCallStatus('idle');
        alert('📞 Call rejected by the other user.');
      });

    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call. Please check microphone/camera permissions.');
      setIsCalling(false);
    }
  };

  const acceptCall = async () => {
    if (!incomingCaller || !socket || !incomingOffer) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      });

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', {
            to: incomingCaller,
            candidate: event.candidate
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call-answer', {
        to: incomingCaller,
        answer: answer
      });

      setPeerConnection(pc);
      setCallStatus('connected');
      setIsInCall(true);
      setIncomingCaller(null);
      setIncomingOffer(null);

    } catch (error) {
      console.error('Error accepting call:', error);
      alert('Failed to accept call.');
    }
  };

  const rejectCall = () => {
    if (socket && incomingCaller) {
      socket.emit('call-reject', { to: incomingCaller });
    }
    setIncomingCaller(null);
    setIncomingOffer(null);
    setCallStatus('idle');
    setCallType(null);
  };

  const endRealCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }

    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    if (socket && activeContact) {
      socket.emit('call-hangup', { to: activeContact.phoneNumber });
    }

    setIsInCall(false);
    setIsCalling(false);
    setCallStatus('idle');
    setCallType(null);
    setIncomingCaller(null);
    setIncomingOffer(null);
  };

  // Main call handler
  const handleCall = (type: 'voice' | 'video') => {
    if (!activeContact) return;
    startRealCall(type);
  };

  // ========== EXISTING FUNCTIONS ==========

  const handleSendMessage = async (e?: React.FormEvent | any) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    let fullMessage = messageText.trim();

    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => `📎 ${f.name}`).join(' ');
      fullMessage = fullMessage ? `${fullMessage} ${fileNames}` : fileNames;
    }

    if (!fullMessage || !activeContact) return;

    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      sender: currentUser.phoneNumber,
      receiver: activeContact.isGroup ? 'group' : activeContact.phoneNumber,
      workspace: currentUser.workspace || 'both',
      content: fullMessage,
      groupId: activeContact.isGroup ? activeContact.id : undefined,
      createdAt: new Date().toISOString(),
      read: false
    };

    setMessages(prev => [optimisticMessage, ...prev]);
    setMessageText('');
    setAttachedFiles([]);
    setShowEmojiPicker(false);

    try {
      const contactId = activeContact.isGroup ? activeContact.id : activeContact.phoneNumber;

      await dbService.sendChatMessage({
        sender: currentUser.phoneNumber,
        receiver: activeContact.isGroup ? 'group' : contactId,
        workspace: currentUser.workspace || 'both',
        content: fullMessage,
        groupId: activeContact.isGroup ? contactId : undefined
      });
    } catch (err) {
      console.error("Failed to send message", err);
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      alert('❌ Failed to send message. Please try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;
    try {
      await dbService.deleteMessage?.(messageId);
      setMessages(messages.filter(msg => msg.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

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
      setGroups(prev => [...prev, groupData]);

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

  const toggleMember = (phone: string) => {
    setSelectedMembers(prev =>
      prev.includes(phone)
        ? prev.filter(p => p !== phone)
        : [...prev, phone]
    );
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const handleBellClick = () => {
    const firstUnread = users.find(u => unreadCounterMap[u.phoneNumber] > 0);
    if (firstUnread) {
      setActiveContact(firstUnread);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Emoji picker functions
  const handleEmojiClick = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const handleFileAttach = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileList = Array.from(files);
      setAttachedFiles(prev => [...prev, ...fileList]);
      const fileNames = fileList.map(f => `📎 ${f.name}`).join(' ');
      setMessageText(prev => prev ? `${prev} ${fileNames}` : fileNames);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    const remainingFiles = attachedFiles.filter((_, i) => i !== index);
    const fileNames = remainingFiles.map(f => `📎 ${f.name}`).join(' ');
    const textParts = messageText.split('📎');
    const textBeforeFiles = textParts[0]?.trim() || '';
    setMessageText(fileNames ? `${textBeforeFiles} ${fileNames}` : textBeforeFiles);
  };

  const handleDownloadFile = (fileName: string) => {
    const fileUrl = uploadedFileUrls.get(fileName);
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const file = attachedFiles.find(f => f.name === fileName);
      if (file) {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else {
        alert(`📄 File "${fileName}" is no longer available. Please request it again.`);
      }
    }
  };

  // Settings
  const handleSettingsClick = () => {
    setShowSettingsModal(true);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('chat_notifications', String(settingsNotifications));
    localStorage.setItem('chat_sound', String(settingsSound));
    setShowSettingsModal(false);
    alert('✅ Settings saved successfully!');
  };

  // Load saved settings
  useEffect(() => {
    const savedNotifications = localStorage.getItem('chat_notifications') !== 'false';
    const savedSound = localStorage.getItem('chat_sound') !== 'false';
    setSettingsNotifications(savedNotifications);
    setSettingsSound(savedSound);
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.emoji-picker-container') && !target.closest('.emoji-button')) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Extract file names from message for display
  const getFileAttachments = (content: string) => {
    const fileRegex = /📎\s*([^\s]+)/g;
    const matches = [...content.matchAll(fileRegex)];
    return matches.map(m => m[1]);
  };

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ========== RENDER ==========

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">

      {/* TOP HEADER */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200/80 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[#8B5CF6]/30">
            D
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Digaf Microfinance Chat</h1>
            <p className="text-xs text-slate-400 font-medium">Secure Staff Communications</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[9px] font-black text-emerald-700 uppercase">Online</span>
          </div>
          <button
            onClick={handleBellClick}
            className="relative p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            {totalUnread > 0 ? (
              <BellRing className="w-5 h-5 text-rose-500" />
            ) : (
              <Bell className="w-5 h-5 text-slate-400" />
            )}
            {totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </button>
          <button
            onClick={handleSettingsClick}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-600"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR */}
        <div className="w-20 bg-slate-50/80 border-r border-slate-200/60 flex flex-col items-center py-4 shrink-0">
          <div className="flex flex-col items-center gap-2 flex-1">
            <button onClick={() => setActiveTab('chats')} className={`p-3 rounded-xl transition-all cursor-pointer ${activeTab === 'chats' ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30' : 'text-slate-400 hover:bg-slate-200'}`} title="Chats">
              <MessageCircle className="w-6 h-6" />
            </button>
            <button onClick={() => setActiveTab('contacts')} className={`p-3 rounded-xl transition-all cursor-pointer ${activeTab === 'contacts' ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30' : 'text-slate-400 hover:bg-slate-200'}`} title="Contacts">
              <UsersIcon className="w-6 h-6" />
            </button>
            <button onClick={() => setActiveTab('groups')} className={`p-3 rounded-xl transition-all cursor-pointer ${activeTab === 'groups' ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/30' : 'text-slate-400 hover:bg-slate-200'}`} title="Groups">
              <Users className="w-6 h-6" />
            </button>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center text-[#8B5CF6] font-black text-sm border-2 border-[#8B5CF6]/30">
            {getInitials(currentUser.fullName)}
          </div>
        </div>

        {/* MIDDLE PANEL - Contact List */}
        <div className="w-[380px] min-w-[340px] max-w-[420px] border-r border-slate-200/60 flex flex-col bg-white">
          <div className="px-4 py-3 border-b border-slate-200/60 bg-white/50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-black text-slate-800">{activeTab === 'chats' ? 'Messages' : activeTab === 'contacts' ? 'Contacts' : 'Groups'}</h2>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{filteredContacts.length}</span>
            </div>
            <div className="relative">
              <input type="text" placeholder={`Search ${activeTab}...`} value={searchText} onChange={(e) => setSearchText(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-sm pl-9 pr-3 py-2.5 rounded-lg text-slate-800 outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-all" />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredContacts.length === 0 ? (
              <div className="p-8 text-center"><UserIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-sm font-bold text-slate-400">No {activeTab} found</p></div>
            ) : (
              filteredContacts.map((contact) => {
                const contactId = contact.isGroup ? contact.id : contact.phoneNumber;
                const ucount = unreadCounterMap[contactId] || 0;
                const meta = conversationMetaMap[contactId];
                const isSelected = activeContact?.phoneNumber === contactId || (activeContact?.isGroup && activeContact.id === contactId);
                const avatarColor = getAvatarColor(contact.fullName || 'Unknown');

                return (
                  <button key={contactId} onClick={() => setActiveContact(contact)} className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 cursor-pointer group ${isSelected ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/20' : 'bg-transparent hover:bg-slate-50'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-base shrink-0 font-mono text-white ${avatarColor}`}>
                      {contact.isGroup ? '👥' : getInitials(contact.fullName || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <span className={`text-sm font-extrabold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>{contact.fullName}{contact.isGroup && <span className="text-[9px] font-normal ml-1 opacity-60">(Group)</span>}</span>
                        {meta && <span className={`text-[8px] font-bold shrink-0 font-mono ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>{meta.time}</span>}
                      </div>
                      <div className={`text-[8px] font-black uppercase tracking-wider font-mono truncate ${isSelected ? 'text-white/50' : 'text-slate-400'}`}>{contact.isGroup ? `${contact.members?.length || 0} members` : (contact.customRole || contact.role || 'Staff')}</div>
                      {meta ? <p className={`text-xs truncate mt-0.5 font-medium ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>{meta.content}</p> : <p className={`text-[10px] italic truncate mt-0.5 font-medium ${isSelected ? 'text-white/40' : 'text-slate-400'}`}>No messages yet</p>}
                    </div>
                    {ucount > 0 && <span className={`h-5 min-w-5 px-1.5 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 font-mono animate-pulse ${isSelected ? 'bg-white text-[#8B5CF6]' : 'bg-rose-500 text-white'}`}>{ucount}</span>}
                  </button>
                );
              })
            )}
          </div>

          {isAdmin && activeTab === 'groups' && (
            <div className="p-2 border-t border-slate-200/60 bg-white/50 shrink-0">
              <button onClick={() => setShowGroupModal(true)} className="w-full py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Create New Group</button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL - Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {activeContact ? (
            <>
              <div className="px-6 py-3 border-b border-slate-200/60 bg-white/90 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-base text-white ${getAvatarColor(activeContact.fullName || '')}`}>
                    {activeContact.isGroup ? '👥' : getInitials(activeContact.fullName || '')}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-800 tracking-tight leading-none">{activeContact.fullName}{activeContact.isGroup && <span className="text-[9px] font-normal ml-1 text-slate-400">(Group)</span>}</h4>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider font-mono mt-0.5 leading-none">{activeContact.isGroup ? `${activeContact.members?.length || 0} members` : (activeContact.customRole || activeContact.role || 'Staff')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleCall('voice')} className="p-2 hover:bg-emerald-50 rounded-lg transition-all text-slate-500 hover:text-emerald-600" title="Voice Call" disabled={isCalling || isInCall}><Phone className="w-4 h-4" /></button>
                  <button onClick={() => handleCall('video')} className="p-2 hover:bg-[#8B5CF6]/10 rounded-lg transition-all text-slate-500 hover:text-[#8B5CF6]" title="Video Call" disabled={isCalling || isInCall}><Video className="w-4 h-4" /></button>
                  <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border border-emerald-100/60"><Shield className="w-3 h-3 text-emerald-600" /><span className="hidden sm:inline">Secure</span></div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/20">
                {activeConversationMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <div className="p-6 bg-[#8B5CF6]/5 border border-[#8B5CF6]/10 rounded-full"><MessageSquare className="w-10 h-10 text-[#8B5CF6]" /></div>
                    <div><p className="text-base font-black text-slate-700">Secure Channel Open</p><p className="text-sm text-slate-400 font-medium max-w-xs">Send your first message to {activeContact.fullName?.split(' ')[0] || 'this contact'}.</p></div>
                  </div>
                ) : (
                  activeConversationMessages.map((msg, index) => {
                    const isSender = msg.sender === currentUser.phoneNumber;
                    const showAvatar = !isSender && (index === 0 || activeConversationMessages[index - 1]?.sender !== msg.sender);
                    const sender = users.find(u => u.phoneNumber === msg.sender);
                    const fileAttachments = getFileAttachments(msg.content);

                    return (
                      <div key={msg.id} className={`flex ${isSender ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                        {!isSender && showAvatar && <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 ${getAvatarColor(activeContact.fullName || '')}`}>{getInitials(activeContact.fullName || '')}</div>}
                        {!isSender && !showAvatar && <div className="w-8 shrink-0" />}
                        <div className={`flex flex-col ${isSender ? 'items-end' : 'items-start'} max-w-[75%]`}>
                          {!isSender && showAvatar && <span className="text-[8px] font-bold text-slate-500 mb-0.5 ml-1">{sender?.fullName?.split(' ')[0] || 'User'}</span>}
                          <div className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${isSender ? 'bg-[#8B5CF6] text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                            <span>{msg.content}</span>
                            {fileAttachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {fileAttachments.map((fileName, idx) => (
                                  <div key={idx} className="flex items-center gap-2 bg-slate-100/50 rounded-lg px-2 py-1">
                                    {getFileIcon(fileName)}
                                    <span className="text-xs font-medium truncate max-w-[120px]">{fileName}</span>
                                    <button onClick={() => handleDownloadFile(fileName)} className="p-1 hover:bg-slate-200 rounded transition-all text-slate-500 hover:text-[#8B5CF6]" title="Download file"><Download className="w-3 h-3" /></button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 font-mono tracking-wide px-1 mt-0.5">
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            {isSender && (msg.read ? <CheckCheck className="w-3 h-3 text-sky-500" /> : <Check className="w-2.5 h-2.5 text-slate-300" />)}
                            {isSender && <button onClick={() => handleDeleteMessage(msg.id)} className="p-0.5 hover:bg-slate-100 rounded transition-all text-slate-400 hover:text-rose-500"><Trash2 className="w-3 h-3" /></button>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="px-6 py-3 bg-white/90 border-t border-slate-200/60 shrink-0">
                <div className="flex items-center gap-2 relative">
                  <button type="button" onClick={toggleEmojiPicker} className="emoji-button p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-600" title="Add emoji"><Smile className="w-5 h-5" /></button>
                  {showEmojiPicker && (
                    <div className="emoji-picker-container absolute bottom-full left-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-2xl w-[350px] max-h-[350px] overflow-hidden z-50">
                      <div className="flex gap-1 p-2 border-b border-slate-100 overflow-x-auto">
                        {EMOJI_CATEGORIES.map((category, index) => (
                          <button key={index} onClick={() => setSelectedCategory(index)} className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all whitespace-nowrap ${selectedCategory === index ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{category.name}</button>
                        ))}
                      </div>
                      <div className="p-2 overflow-y-auto max-h-[250px]">
                        <div className="grid grid-cols-8 gap-1">
                          {EMOJI_CATEGORIES[selectedCategory].emojis.map((emoji) => (
                            <button key={emoji} type="button" onClick={() => handleEmojiClick(emoji)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all text-xl hover:scale-110">{emoji}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <button type="button" onClick={handleFileAttach} className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-600" title="Attach file"><Paperclip className="w-5 h-5" /></button>
                  <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.mp3,.mp4" onChange={handleFileSelect} className="hidden" />
                  <div className="flex-1 relative">
                    <input type="text" placeholder="Send a message..." value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={handleKeyDown} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 text-slate-800 pr-14 transition-all" />
                    <div className="absolute right-3 top-2.5 hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[7px] text-slate-400 font-mono font-black border border-slate-200"><CornerDownLeft className="w-2.5 h-2.5" /> ENTER</div>
                  </div>
                  <button type="submit" disabled={!messageText.trim() && attachedFiles.length === 0} className={`p-3 rounded-xl transition-all shadow-sm shrink-0 flex items-center justify-center cursor-pointer ${messageText.trim() || attachedFiles.length > 0 ? 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:scale-95 shadow-md shadow-[#8B5CF6]/25' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}><Send className="w-5 h-5" /></button>
                </div>
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {attachedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1 text-xs">
                        {getFileIcon(file.name)}<span className="truncate max-w-[100px]">{file.name}</span>
                        <button type="button" onClick={() => removeAttachedFile(index)} className="text-slate-400 hover:text-rose-500"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-5">
              <div className="p-6 bg-[#8B5CF6]/5 border border-[#8B5CF6]/10 rounded-full"><MessageSquare className="w-12 h-12 text-[#8B5CF6]" /></div>
              <div><h4 className="text-xl font-black text-slate-800 tracking-tight">Digaf Staff Chat</h4><p className="text-sm text-slate-500 font-medium max-w-sm">Select a contact from the list to start a secure conversation.</p></div>
              {isAdmin && <button onClick={() => setShowGroupModal(true)} className="mt-1 px-6 py-3 bg-[#8B5CF6] text-white text-xs font-black uppercase tracking-wider rounded-lg hover:bg-[#7C3AED] transition-all shadow-md shadow-[#8B5CF6]/20 flex items-center gap-2"><Users className="w-4 h-4" /> Create Group Chat</button>}
            </div>
          )}
        </div>
      </div>

      {/* GROUP CHAT MODAL */}
      {showGroupModal && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5"><h3 className="text-base font-black text-slate-800 flex items-center gap-2.5"><Users className="w-5 h-5 text-[#8B5CF6]" /> Create Group Chat</h3><button onClick={() => setShowGroupModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all"><X className="w-5 h-5 text-slate-500" /></button></div>
            <div className="space-y-5">
              <div><label className="text-xs font-bold text-slate-600 block mb-1.5">Group Name</label><input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Renewal Team" className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all" /></div>
              <div><label className="text-xs font-bold text-slate-600 block mb-2">Select Members <span className="text-slate-400 font-normal">({selectedMembers.length} selected)</span></label>
                <div className="max-h-52 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2.5">
                  {users.map(user => (
                    <button key={user.phoneNumber} onClick={() => toggleMember(user.phoneNumber)} className={`w-full text-left p-2.5 rounded-lg flex items-center gap-2.5 transition-all cursor-pointer ${selectedMembers.includes(user.phoneNumber) ? 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/30' : 'hover:bg-slate-50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[9px] text-white ${getAvatarColor(user.fullName)}`}>{getInitials(user.fullName)}</div>
                      <div className="flex-1"><span className="text-xs font-bold text-slate-800 block">{user.fullName}</span><span className="text-[8px] text-slate-400">{user.customRole || user.role}</span></div>
                      {selectedMembers.includes(user.phoneNumber) && <Check className="w-4 h-4 text-[#8B5CF6]" />}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedMembers.length < 2} className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${groupName.trim() && selectedMembers.length >= 2 ? 'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow-md shadow-[#8B5CF6]/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>Create Group ({selectedMembers.length} members)</button>
              <p className="text-[8px] text-slate-400 text-center font-medium"><Crown className="w-3 h-3 inline text-amber-500 mr-1" /> Only administrators can create group chats</p>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5"><h3 className="text-base font-black text-slate-800 flex items-center gap-2.5"><Settings className="w-5 h-5 text-[#8B5CF6]" /> Chat Settings</h3><button onClick={() => setShowSettingsModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all"><X className="w-5 h-5 text-slate-500" /></button></div>
            <div className="space-y-5">
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><div><span className="text-sm font-bold text-slate-800 block">🔔 Notifications</span><span className="text-xs text-slate-400">Show desktop notifications</span></div><button onClick={() => setSettingsNotifications(!settingsNotifications)} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${settingsNotifications ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{settingsNotifications ? 'ON' : 'OFF'}</button></div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><div><span className="text-sm font-bold text-slate-800 block">🔊 Sound</span><span className="text-xs text-slate-400">Play sound for messages</span></div><button onClick={() => setSettingsSound(!settingsSound)} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${settingsSound ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{settingsSound ? 'ON' : 'OFF'}</button></div>
              <button onClick={handleSaveSettings} className="w-full py-3 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#8B5CF6]/20">💾 Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* INCOMING CALL OVERLAY */}
      {callStatus === 'incoming' && incomingCaller && (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-900 to-slate-800 z-[200] flex flex-col items-center justify-center animate-fade-in">
          <div className="text-center space-y-6">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl text-white mx-auto animate-pulse ${callType === 'voice' ? 'bg-emerald-500' : 'bg-[#8B5CF6]'}`}>
              {callType === 'voice' ? <PhoneCall className="w-14 h-14" /> : <VideoIcon className="w-14 h-14" />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">{incomingCaller}</h3>
              <p className="text-slate-400 text-sm mt-1">{callType === 'voice' ? 'Incoming Voice Call...' : 'Incoming Video Call...'}</p>
            </div>
            <div className="flex items-center gap-6 mt-8">
              <button onClick={acceptCall} className="p-4 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-all text-white shadow-lg shadow-emerald-500/30">
                <Phone className="w-8 h-8" />
              </button>
              <button onClick={rejectCall} className="p-4 rounded-full bg-rose-500 hover:bg-rose-600 transition-all text-white shadow-lg shadow-rose-500/30">
                <PhoneOff className="w-8 h-8" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CALLING OVERLAY */}
      {isCalling && callStatus === 'calling' && (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-900 to-slate-800 z-[200] flex flex-col items-center justify-center animate-fade-in">
          <div className="text-center space-y-6">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl text-white mx-auto animate-pulse ${callType === 'voice' ? 'bg-emerald-500' : 'bg-[#8B5CF6]'}`}>
              {callType === 'voice' ? <PhoneCall className="w-14 h-14" /> : <VideoIcon className="w-14 h-14" />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">{activeContact?.fullName}</h3>
              <p className="text-slate-400 text-sm mt-1">{callType === 'voice' ? 'Calling...' : 'Video Calling...'}</p>
            </div>
            <button onClick={() => { setIsCalling(false); setCallStatus('idle'); setCallType(null); }} className="p-4 rounded-full bg-rose-500 hover:bg-rose-600 transition-all text-white shadow-lg shadow-rose-500/30"><PhoneOff className="w-8 h-8" /></button>
          </div>
        </div>
      )}

      {/* IN-CALL OVERLAY */}
      {isInCall && (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-900 to-slate-800 z-[200] flex flex-col items-center justify-center animate-fade-in">
          <div className="text-center space-y-6">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl text-white mx-auto ${callType === 'voice' ? 'bg-emerald-500' : 'bg-[#8B5CF6]'}`}>
              {callType === 'voice' ? <PhoneCall className="w-14 h-14" /> : <VideoIcon className="w-14 h-14" />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">{activeContact?.fullName}</h3>
              <p className="text-slate-400 text-sm mt-1">{callType === 'voice' ? 'Voice Call' : 'Video Call'}</p>
              <p className="text-emerald-400 text-sm font-mono mt-2">{formatCallTime(callTimer)}</p>
            </div>
            <div className="flex items-center gap-6 mt-8">
              <button onClick={() => setIsMuted(!isMuted)} className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-all text-white">{isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}</button>
              <button onClick={endRealCall} className="p-4 rounded-full bg-rose-500 hover:bg-rose-600 transition-all text-white shadow-lg shadow-rose-500/30"><PhoneOff className="w-8 h-8" /></button>
              <button onClick={() => setIsSpeakerOn(!isSpeakerOn)} className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-all text-white">{isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}