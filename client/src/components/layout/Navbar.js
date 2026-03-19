import React from 'react';
import { Alert, Button, Dropdown, Form, Modal } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiBell, FiMoon, FiSun, FiUser, FiLogOut } from 'react-icons/fi';
import { toggleSidebar, toggleDarkMode } from '../../store/slices/themeSlice';
import { logout } from '../../store/slices/authSlice';
import { useState } from 'react';
import axios from 'axios';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetData, setResetData] = useState({
    identifier: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { darkMode, sidebarExpanded } = useSelector((state) => state.theme);
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };


  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (resetData.newPassword !== resetData.confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    if (resetData.newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }

    setResetLoading(true);
    try {
      const response = await axios.post('/api/auth/forgot-password', {
        identifier: resetData.identifier,
        newPassword: resetData.newPassword
      });

      setResetSuccess(response.data.message);
      setTimeout(() => {
        setShowResetModal(false);
        setResetData({ identifier: '', newPassword: '', confirmPassword: '' });
        setResetSuccess('');
      }, 2000);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <nav className={`navbar-custom ${!sidebarExpanded ? 'sidebar-collapsed' : ''}`}>
      <div className="navbar-left">
        <button className="navbar-toggle" onClick={() => dispatch(toggleSidebar())}>
          <FiMenu />
        </button>
        <h5 className="mb-0">Good Morning, {user?.name?.split(' ')[0]}!</h5>
      </div>

      <div className="navbar-right">
        <button className="navbar-icon-btn" onClick={() => dispatch(toggleDarkMode())}>
          {darkMode ? <FiSun /> : <FiMoon />}
        </button>

        <button className="navbar-icon-btn">
          <FiBell />
          <span className="notification-badge">3</span>
        </button>

        <Dropdown align="end" className="profile-dropdown">
          <Dropdown.Toggle variant="link" id="profile-dropdown">
            <img
              src={`https://ui-avatars.com/api/?name=${user?.name}&background=405189&color=fff`}
              alt="Profile"
              className="profile-img"
            />
          </Dropdown.Toggle>

          <Dropdown.Menu>
            <div className="px-3 py-2 border-bottom">
              <h6 className="mb-0">{user?.name}</h6>
              <h6 className="mb-2 mt-2">({user?.employee_id})</h6>
              <small className="text-muted">{user?.email}</small>
            </div>
            <Dropdown.Item onClick={() => navigate('/profile')}>
              <FiUser className="me-2" /> My Profile
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setShowResetModal(true)}>
              <FiUser className="me-2" /> Change Password
            </Dropdown.Item>

            <Dropdown.Divider />
            <Dropdown.Item onClick={handleLogout} className="text-danger">
              <FiLogOut className="me-2" /> Logout
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
      <Modal show={showResetModal} onHide={() => setShowResetModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reset Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {resetError && <Alert variant="danger">{resetError}</Alert>}
          {resetSuccess && <Alert variant="success">{resetSuccess}</Alert>}

          <Form onSubmit={handleResetPassword}>
            <Form.Group className="mb-3">
              <Form.Label>Email or Employee ID</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter your email or employee ID"
                value={resetData.identifier}
                onChange={(e) => setResetData({ ...resetData, identifier: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>New Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={resetData.newPassword}
                onChange={(e) => setResetData({ ...resetData, newPassword: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Confirm Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Confirm new password"
                value={resetData.confirmPassword}
                onChange={(e) => setResetData({ ...resetData, confirmPassword: e.target.value })}
                required
              />
            </Form.Group>

            <Button
              variant="primary"
              type="submit"
              className="w-100"
              disabled={resetLoading}
              style={{ background: '#405189', border: 'none' }}
            >
              {resetLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </nav>
  );

};

export default Navbar;
