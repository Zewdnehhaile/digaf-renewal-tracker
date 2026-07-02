import type { Notification } from '../types';

const API_BASE_URL = 'https://digaf-api.onrender.com/api';
//const API_BASE_URL = 'http://localhost:3000/api';
async function apiRequest(endpoint: string, options: any = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.data ? JSON.stringify(options.data) : undefined,
  });
  if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
  return response.json();
}

export const notificationService = {
  // Get all notifications for a user
  getNotifications: async (userId: string): Promise<Notification[]> => {
    try {
      const data = await apiRequest(`/notifications/${userId}`);
      return data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  },

  // Create a notification
  createNotification: async (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<Notification> => {
    try {
      const data = await apiRequest('/notifications', {
        method: 'POST',
        data: notification
      });
      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId: string): Promise<void> => {
    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  // Mark all notifications as read
  markAllAsRead: async (userId: string): Promise<void> => {
    try {
      await apiRequest(`/notifications/${userId}/read-all`, {
        method: 'PUT'
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  // Delete a notification
  deleteNotification: async (notificationId: string): Promise<void> => {
    try {
      await apiRequest(`/notifications/${notificationId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  // Subscribe to real-time notifications (polling fallback)
  subscribeNotifications: (userId: string, callback: (notifications: Notification[]) => void): (() => void) => {
    const f = async () => {
      try {
        const data = await notificationService.getNotifications(userId);
        callback(data);
      } catch {
        callback([]);
      }
    };
    f();
    const interval = setInterval(f, 5000);
    return () => clearInterval(interval);
  },

  // Request browser notification permission
  requestPermission: async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  },

  // Show browser notification
  showBrowserNotification: (title: string, body: string, icon?: string, onClick?: () => void): void => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(title, {
        body: body,
        icon: icon || '/favicon.ico',
        silent: false,
        requireInteraction: true,
      });

      notification.onclick = () => {
        if (onClick) onClick();
        notification.close();
      };

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  }
};