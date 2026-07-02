// src/components/NotificationBell.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Trash2, X, MessageSquare, Users, AtSign, Megaphone, CheckCircle, AlertTriangle } from 'lucide-react';
import { Notification } from '../types';
import { notificationService } from '../services/notificationService';

interface NotificationBellProps {
  userId: string;
  userName: string;
}

export default function NotificationBell({ userId, userName }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Request notification permission on mount
    notificationService.requestPermission();

    // Subscribe to notifications
    const unsubscribe = notificationService.subscribeNotifications(userId, (data) => {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
      setLoading(false);

      // Show browser notification for new unread notifications
      const latestUnread = data.filter(n => !n.read);
      if (latestUnread.length > 0) {
        const last = latestUnread[latestUnread.length - 1];
        // Check if it's a new notification (within last 10 seconds)
        const createdAt = new Date(last.createdAt);
        const now = new Date();
        if ((now.getTime() - createdAt.getTime()) < 10000) {
          notificationService.showBrowserNotification(
            last.title,
            last.message,
            '/favicon.ico',
            () => {
              // Handle click - navigate to relevant page
              if (last.relatedType === 'chat' && last.relatedId) {
                window.location.href = '/chat';
              }
            }
          );
        }
      }
    });

    // Click outside to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userId]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'personal_message': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'group_message': return <Users className="w-4 h-4 text-purple-500" />;
      case 'mention': return <AtSign className="w-4 h-4 text-yellow-500" />;
      case 'admin_announcement': return <Megaphone className="w-4 h-4 text-red-500" />;
      case 'finance_approval': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'system_alert': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead(userId);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleMarkRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(notifications.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[500px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#8B5CF6]" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[8px] font-black rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-[9px] font-bold text-[#8B5CF6] transition-all flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Read All
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[400px]">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8B5CF6]"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No notifications</p>
                <p className="text-xs">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-all cursor-pointer ${
                    !notification.read ? 'bg-[#8B5CF6]/5' : ''
                  }`}
                  onClick={() => handleMarkRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold ${!notification.read ? 'text-slate-900' : 'text-slate-600'}`}>
                          {notification.title}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] text-slate-400 whitespace-nowrap">
                            {getTimeAgo(notification.createdAt)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(notification.id);
                            }}
                            className="p-1 hover:bg-slate-200 rounded-lg transition-all text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10.5px] text-slate-600 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <span className="inline-block mt-1 w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"></span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-100 text-center">
              <button
                onClick={() => {
                  // Navigate to notification center or mark all as read
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-[#8B5CF6] hover:text-[#7C3AED] transition-all"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}