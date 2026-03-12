import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import themeReducer from './slices/themeSlice';
import leaveReducer from './slices/leaveSlice';
import holidayReducer from './slices/holidaySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    leave: leaveReducer,
    holiday: holidayReducer,
  },
});
