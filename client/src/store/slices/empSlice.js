import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchEmployees = createAsyncThunk('employees/fetch', async (search = '', { rejectWithValue }) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get('/api/employees', {
      headers: { Authorization: `Bearer ${token}` },
      params: { search },
    });
    return response.data.data.employees;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch employees');
  }
});

export const fetchEmployeeLeaveHistory = createAsyncThunk(
  'employees/fetchLeaveHistory',
  async ({ employeeId, status }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (status && status !== 'All') params.status = status;
      const response = await axios.get(`/api/leaves/employee/${employeeId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch employee leave history');
    }
  }
);

const empSlice = createSlice({
  name: 'employees',
  initialState: {
    employees: [],
    loading: false,
    error: null,
    // Employee leave history state
    selectedEmployee: null,
    leaveSummary: null,
    employeeLeaves: [],
    historyLoading: false,
    historyError: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearEmployeeHistory: (state) => {
      state.selectedEmployee = null;
      state.leaveSummary = null;
      state.employeeLeaves = [];
      state.historyError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmployees.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loading = false;
        state.employees = action.payload;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchEmployeeLeaveHistory.pending, (state) => {
        state.historyLoading = true;
        state.historyError = null;
      })
      .addCase(fetchEmployeeLeaveHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.selectedEmployee = action.payload.employee;
        state.leaveSummary = action.payload.leaveSummary;
        state.employeeLeaves = action.payload.leaves;
      })
      .addCase(fetchEmployeeLeaveHistory.rejected, (state, action) => {
        state.historyLoading = false;
        state.historyError = action.payload;
      });
  },
});

export const { clearError, clearEmployeeHistory } = empSlice.actions;
export default empSlice.reducer;