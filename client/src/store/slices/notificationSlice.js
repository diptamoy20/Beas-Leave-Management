import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params = { limit: 30, page: 1 }, { rejectWithValue }) => {
    try {
      const res = await axios.get('/api/notifications', {
        headers: getAuthHeaders(),
        params
      });
      return res.data?.data || { notifications: [], pagination: {} };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch notifications');
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get('/api/notifications/unread-count', {
        headers: getAuthHeaders()
      });
      return Number(res.data?.data?.unread || 0);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch unread count');
    }
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (id, { rejectWithValue }) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`, {}, {
        headers: getAuthHeaders()
      });
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark notification as read');
    }
  }
);

export const markAllNotificationsAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      await axios.patch('/api/notifications/read-all', {}, {
        headers: getAuthHeaders()
      });
      return true;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark all as read');
    }
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    pagination: {
      total: 0,
      unread: 0,
      page: 1,
      limit: 30,
      totalPages: 1
    }
  },
  reducers: {
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.notifications || [];
        state.pagination = action.payload.pagination || state.pagination;
        state.unreadCount = action.payload.pagination?.unread ?? state.unreadCount;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch unread count
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })

      // Mark single read (permanently removed from list and unread count)
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const id = action.payload;
        const index = state.notifications.findIndex((n) => n.id === id);
        if (index !== -1) {
          if (!state.notifications[index].is_read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          state.notifications.splice(index, 1);
        }
      })

      // Mark all read (permanently cleared)
      .addCase(markAllNotificationsAsRead.fulfilled, (state) => {
        state.notifications = [];
        state.unreadCount = 0;
      });
  }
});

export const { clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
