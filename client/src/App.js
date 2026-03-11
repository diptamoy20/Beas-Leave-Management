import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import ApplyLeave from './components/ApplyLeave';
import MyLeaves from './components/MyLeaves';
import LeaveBalance from './components/LeaveBalance';
import ManageLeaves from './components/ManageLeaves';
import Attendance from './components/Attendance';
import Holidays from './components/Holidays';
import Sidebar from './components/Sidebar';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Router>
      {user ? (
        <div className="app-layout">
          <Sidebar user={user} onLogout={handleLogout} />
          <div className="main-content">
            <Routes>
              <Route path="/dashboard" element={<Dashboard user={user} />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/holidays" element={<Holidays />} />
              <Route path="/apply-leave" element={<ApplyLeave />} />
              <Route path="/my-leaves" element={<MyLeaves />} />
              <Route path="/leave-balance" element={<LeaveBalance />} />
              <Route path="/manage-leaves" element={(user.role === 'manager' || user.role === 'admin') ? <ManageLeaves /> : <Navigate to="/dashboard" />} />
              <Route path="/login" element={<Navigate to="/dashboard" />} />
              <Route path="/register" element={<Navigate to="/dashboard" />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </Router>
  );
}

export default App;
