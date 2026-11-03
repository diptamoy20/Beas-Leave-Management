import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Safely parse user from localStorage to prevent crash on corrupted/undefined values
const getUserFromStorage = () => {
  try {
    const user = localStorage.getItem('user');
    if (!user || user === 'undefined' || user === 'null') {
      if (user === 'undefined' || user === 'null') {
        localStorage.removeItem('user');
      }
      return null;
    }
    return JSON.parse(user);
  } catch (error) {
    console.error('Error parsing user from localStorage:', error);
    localStorage.removeItem('user');
    return null;
  }
};

const getTokenFromStorage = () => {
  const token = localStorage.getItem('token');
  if (!token || token === 'undefined' || token === 'null') {
    if (token === 'undefined' || token === 'null') {
      localStorage.removeItem('token');
    }
    return null;
  }
  return token;
};

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const response = await axios.post('/api/auth/login', credentials);
    const { token, user } = response.data?.data || {};
    if (token) {
      localStorage.setItem('token', token);
    }
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Login failed');
  }
});

export const register = createAsyncThunk('auth/register', async (userData, { rejectWithValue }) => {
  try {
    const response = await axios.post('/api/auth/register', userData);
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Registration failed');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: getUserFromStorage(),
    token: getTokenFromStorage(),
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload?.user || null;
        state.token = action.payload?.token || null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
