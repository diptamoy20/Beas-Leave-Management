import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/Dashboard';
import ApplyLeave from './components/ApplyLeave';
import MyLeaves from './components/MyLeaves';
import Attendance from './components/Attendance';
import Holidays from './components/Holidays';
import LeaveBalance from './components/LeaveBalance';
import ManageLeaves from './components/ManageLeaves';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';

function App() {
  const { user } = useSelector((state) => state.auth);
  const { darkMode, sidebarExpanded } = useSelector((state) => state.theme);

  useEffect(() => {
    document.body.className = darkMode ? 'dark-mode' : 'light-mode';
  }, [darkMode]);

  const PrivateRoute = ({ children }) => {
    return user ? children : <Navigate to="/login" />;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <div className="app-container">
                <Sidebar />
                <div className={`main-content ${!sidebarExpanded ? 'sidebar-collapsed' : ''}`}>
                  <Navbar />
                  <div className="page-content">
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/apply-leave" element={<ApplyLeave />} />
                      <Route path="/my-leaves" element={<MyLeaves />} />
                      <Route path="/attendance" element={<Attendance />} />
                      <Route path="/holidays" element={<Holidays />} />
                      <Route path="/leave-balance" element={<LeaveBalance />} />
                      <Route path="/manage-leaves" element={<ManageLeaves />} />
                      <Route path="/" element={<Navigate to="/dashboard" />} />
                    </Routes>
                  </div>
                </div>
              </div>
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
