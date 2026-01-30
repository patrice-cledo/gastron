import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationsState {
  readMessageIds: string[];
  markAsRead: (messageId: string) => void;
  markAllAsRead: () => void;
  hasUnreadMessages: (messageIds: string[]) => boolean;
}

const NOTIFICATIONS_STORAGE_KEY = 'notifications-storage';

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      readMessageIds: [],
      
      markAsRead: (messageId) => {
        const { readMessageIds } = get();
        if (!readMessageIds.includes(messageId)) {
          set({ readMessageIds: [...readMessageIds, messageId] });
        }
      },
      
      markAllAsRead: () => {
        // This will be called when the notifications screen is viewed
        // We'll get all message IDs from the screen and mark them all as read
      },
      
      hasUnreadMessages: (messageIds) => {
        const { readMessageIds } = get();
        return messageIds.some(id => !readMessageIds.includes(id));
      },
    }),
    {
      name: NOTIFICATIONS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
