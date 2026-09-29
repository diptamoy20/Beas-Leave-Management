import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchLeaves = createAsyncThunk('leave/fetchLeaves', async (search = '', { rejectWithValue }) => {
  try {
    const token = localStorage.getItem('token');
    const params = {};
    if (search) params.search = search;

    const response = await axios.get('/api/leaves/leave-details', {
      headers: { Authorization: `Bearer ${token}` },
      params
    });
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch leaves');
  }
});

export const fetchLeaveDetail = createAsyncThunk('leave/fetchLeaveDetail', async (id, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(`/api/leaves/leave-details/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // API returns { data: { leave: {...}, earned_leave: "..." } }
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch leave detail');
  }
});

export const applyLeave = createAsyncThunk('leave/applyLeave', async (leaveData, { rejectWithValue }) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.post('/api/leaves/apply', leaveData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data;
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
    return response.data.data;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch leave balance');
  }
});

const leaveSlice = createSlice({
  name: 'leave',
  initialState: {
    leaves: [],
    leaveDetail: null,
    leaveBalance: null,
    leaveBalanceObject: null,
    loading: false,
    detailLoading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearLeaveDetail: (state) => {
      state.leaveDetail = null;
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
      .addCase(fetchLeaveDetail.pending, (state) => {
        state.detailLoading = true;
        state.leaveDetail = null;
      })
      .addCase(fetchLeaveDetail.fulfilled, (state, action) => {
        state.detailLoading = false;
        // action.payload.leave is the single normalized leave object
        state.leaveDetail = action.payload.leave;
        state.leaveBalance = action.payload.earned_leave;
      })
      .addCase(fetchLeaveDetail.rejected, (state, action) => {
        state.detailLoading = false;
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
        state.leaveBalanceObject = action.payload;
        state.leaveBalance = action.payload.earned_leave;
      })
      .addCase(balanceLeave.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError, clearLeaveDetail } = leaveSlice.actions;
export default leaveSlice.reducer;
