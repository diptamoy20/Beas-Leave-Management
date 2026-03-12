import { createSlice } from '@reduxjs/toolkit';

const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    darkMode: localStorage.getItem('darkMode') === 'true' || false,
    sidebarExpanded: true,
  },
  reducers: {
    toggleDarkMode: (state) => {
      state.darkMode = !state.darkMode;
      localStorage.setItem('darkMode', state.darkMode);
    },
    toggleSidebar: (state) => {
      state.sidebarExpanded = !state.sidebarExpanded;
    },
  },
});

export const { toggleDarkMode, toggleSidebar } = themeSlice.actions;
export default themeSlice.reducer;
