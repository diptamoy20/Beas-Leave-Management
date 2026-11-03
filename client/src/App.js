import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCurrentUser } from './store/slices/authSlice';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import Login from './components/auth/Login';
import Dashboard from './components/Dashboard';
import ApplyLeave from './components/ApplyLeave';
import MyLeaves from './components/MyLeaves';
import Attendance from './components/Attendance';
import AttendanceSummary from './components/AttendanceSummary';
import Holidays from './components/Holidays';
import LeaveBalance from './components/LeaveBalance';
import ManageLeaves from './components/ManageLeaves';
import LeaveRecords from './components/LeaveRecords';
import AdminManagement from './components/AdminManagement';
import ApprovedLeavesReview from './components/ApprovedLeavesReview';
import CompOffManagement from './components/CompOffManagement';
import ClientMeetings from './components/ClientMeetings';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';
import LeaveDetails from './components/LeaveDetails';

function App() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { darkMode, sidebarExpanded } = useSelector((state) => state.theme);

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  useEffect(() => {
    document.body.className = darkMode ? 'dark-mode' : 'light-mode';
  }, [darkMode]);

  const PrivateRoute = ({ children }) => {
    return user ? children : <Navigate to="/login" />;
  };

  const RoleRoute = ({ children, allowedRoles, requiredPermission }) => {
    if (!user) return <Navigate to="/login" />;
    if (user.role === 'super_admin') return children;
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to="/dashboard" />;
    }
    if (requiredPermission && user.permissions && !user.permissions[requiredPermission]) {
      return <Navigate to="/dashboard" />;
    }
    return children;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

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
                      <Route path="/leave-details/:id" element={<LeaveDetails />} />
                      <Route path="/apply-leave" element={<ApplyLeave />} />
                      <Route path="/my-leaves" element={<MyLeaves />} />
                      <Route path="/attendance" element={<Attendance />} />
                      <Route path="/attendance-summary" element={<AttendanceSummary />} />
                      <Route path="/holidays" element={<Holidays />} />
                      <Route path="/leave-balance" element={<LeaveBalance />} />
                      <Route path="/manage-leaves" element={<ManageLeaves />} />
                      <Route path="/leave-records" element={<LeaveRecords />} />
                      <Route path="/comp-off" element={<CompOffManagement />} />
                      <Route path="/client-meetings" element={<ClientMeetings />} />
                      <Route
                        path="/admin-management"
                        element={
                          <RoleRoute allowedRoles={['super_admin']} requiredPermission="can_manage_admins">
                            <AdminManagement />
                          </RoleRoute>
                        }
                      />
                      <Route
                        path="/approved-leaves-review"
                        element={
                          <RoleRoute
                            allowedRoles={['super_admin', 'admin', 'admin_1', 'admin_2', 'admin_3']}
                            requiredPermission="can_view_all_leaves"
                          >
                            <ApprovedLeavesReview />
                          </RoleRoute>
                        }
                      />
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
