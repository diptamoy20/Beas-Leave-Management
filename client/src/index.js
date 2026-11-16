import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import axios from 'axios';
import { store } from './store/store';
import { logout } from './store/slices/authSlice';
import App from './App';

// Global 401 response interceptor: smoothly handle expired or invalid JWT tokens
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isAuthLogin = error.config?.url?.includes('/api/auth/login');
      if (!isAuthLogin) {
        store.dispatch(logout());
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
