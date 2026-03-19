import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchLeaves = createAsyncThunk('leave/fetchLeaves', async (_, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get('/api/leaves/my-leaves', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch leaves');
  }
});

export const applyLeave = createAsyncThunk('leave/applyLeave', async (leaveData, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post('/api/leaves/apply', leaveData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to apply leave');
  }
});

export const balanceLeave = createAsyncThunk('leaveBalance/balanceLeave', async (_, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get('/api/leaves/balance', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch leave balance');
  }
});

const leaveSlice = createSlice({
  name: 'leave',
  initialState: {
    leaves: [],
    leaveBalance: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeaves.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLeaves.fulfilled, (state, action) => {
        state.loading = false;
        state.leaves = action.payload.leaves;
        state.leaveBalance = action.payload.earned_leave;
      })
      .addCase(fetchLeaves.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(applyLeave.pending, (state) => {
        state.loading = true;
      })
      .addCase(applyLeave.fulfilled, (state, action) => {
        state.loading = false;
        state.leaves.push(action.payload);
      })
      .addCase(applyLeave.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(balanceLeave.pending, (state) => {
        state.loading = true;
      })
      .addCase(balanceLeave.fulfilled, (state, action) => {
        state.loading = false;
        state.leaveBalance = action.payload;
      })
      .addCase(balanceLeave.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });;
  },
});

export const { clearError } = leaveSlice.actions;
export default leaveSlice.reducer;
