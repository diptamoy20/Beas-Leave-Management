import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Alert, Button, Dropdown, Form, Modal, Spinner } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FiMenu,
  FiBell,
  FiMoon,
  FiSun,
  FiUser,
  FiLogOut,
  FiCalendar,
  FiAward,
  FiCheck,
  FiCheckCircle,
  FiXCircle,
  FiInfo,
  FiClock,
  FiX
} from 'react-icons/fi';
import { toggleSidebar, toggleDarkMode } from '../../store/slices/themeSlice';
import { logout } from '../../store/slices/authSlice';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../../store/slices/notificationSlice';
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
  const { notifications, unreadCount, loading: notifLoading } = useSelector((state) => state.notifications);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const notifDropdownRef = useRef(null);

  // Poll for notifications and unread count every 30 seconds
  useEffect(() => {
    if (user?.employee_id) {
      dispatch(fetchUnreadCount());
      const interval = setInterval(() => {
        dispatch(fetchUnreadCount());
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [dispatch, user]);

  // Click outside listener to reliably close notification menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setShowNotificationMenu(false);
      }
    };
    if (showNotificationMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationMenu]);

  const toggleNotificationMenu = () => {
    setShowNotificationMenu((prev) => {
      const nextState = !prev;
      if (nextState) {
        dispatch(fetchNotifications({ limit: 30, page: 1 }));
      }
      return nextState;
    });
  };

  const handleNotificationClick = (notif) => {
    dispatch(markNotificationAsRead(notif.id));
    setShowNotificationMenu(false);
    if (notif.link) {
      navigate(notif.link);
    } else if (notif.reference_id && notif.reference_type === 'LEAVE') {
      navigate(`/leave-details/${notif.reference_id}`);
    }
  };

  const handleDismissNotification = (e, notifId) => {
    e.stopPropagation();
    dispatch(markNotificationAsRead(notifId));
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    dispatch(markAllNotificationsAsRead());
  };

  const formatNotifTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'LEAVE_APPROVED':
        return { icon: <FiCheckCircle size={16} />, bg: 'rgba(33, 154, 107, 0.15)', color: '#219a6b' };
      case 'LEAVE_REJECTED':
        return { icon: <FiXCircle size={16} />, bg: 'rgba(204, 90, 63, 0.15)', color: '#cc5a3f' };
      case 'LEAVE_CANCELLED':
        return { icon: <FiClock size={16} />, bg: 'rgba(215, 162, 74, 0.15)', color: '#d7a24a' };
      case 'COMPOFF_CREDITED':
        return { icon: <FiAward size={16} />, bg: 'rgba(76, 144, 166, 0.15)', color: '#4c90a6' };
      default:
        return { icon: <FiInfo size={16} />, bg: 'rgba(31, 78, 95, 0.12)', color: '#1f4e5f' };
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

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
        <button
          className={`navbar-toggle ${sidebarExpanded ? 'is-open' : 'is-collapsed'}`}
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle sidebar"
        >
          <span className="navbar-toggle-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <div className="db-hero-badge-row">
          <h2 className="db-hero-title">
            {greeting}, {user?.name || 'Team Member'}!
          </h2>
          <span className="db-role-pill">
            <FiAward size={13} />
            <span>{user?.role ? user.role.replace(/_/g, ' ').toUpperCase() : 'EMPLOYEE'}</span>
          </span>
          <span className="db-date-pill">
            <FiCalendar size={13} />
            <span>{todayFormatted}</span>
          </span>
        </div>
        {/* <div className="navbar-greeting">
          <span className="navbar-kicker">Workspace</span>
          <h5 className="mb-0">Good Morning, {user?.name?.split(' ')[0]}!</h5>
        </div> */}
      </div>

      <div className="navbar-right">
        <button className="navbar-icon-btn" onClick={() => dispatch(toggleDarkMode())}>
          {darkMode ? <FiSun /> : <FiMoon />}
        </button>

        <div className="position-relative" ref={notifDropdownRef}>
          <button
            type="button"
            className="navbar-icon-btn position-relative"
            id="notification-btn"
            onClick={toggleNotificationMenu}
            aria-label="Notifications"
          >
            <FiBell />
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotificationMenu && (
            <div className="notification-menu notification-menu-popup">
              <div className="notif-header">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-bold" style={{ fontSize: '0.95rem' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="badge bg-danger rounded-pill" style={{ fontSize: '0.7rem' }}>
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-decoration-none"
                    style={{ fontSize: '0.78rem', color: 'var(--secondary-color)' }}
                    onClick={handleMarkAllRead}
                  >
                    <FiCheck className="me-1" /> Mark all read
                  </button>
                )}
              </div>

              <div className="notif-list">
                {notifLoading && notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted">
                    <Spinner animation="border" size="sm" className="me-2" />
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-muted">
                    <FiBell size={28} className="d-block mx-auto mb-2 opacity-50" />
                    <div className="fw-semibold">No notifications yet</div>
                    <small style={{ fontSize: '0.78rem' }}>You're all caught up!</small>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const iconConfig = getNotifIcon(notif.type);
                    return (
                      <div
                        key={notif.id}
                        className={`notif-item ${!notif.is_read ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div
                          className="notif-icon-circle"
                          style={{ background: iconConfig.bg, color: iconConfig.color }}
                        >
                          {iconConfig.icon}
                        </div>
                        <div className="notif-body">
                          <div className="notif-title">{notif.title}</div>
                          <div className="notif-message">{notif.message}</div>
                          <div className="notif-time">{formatNotifTime(notif.created_at)}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 notif-dismiss-btn"
                          title="Dismiss notification"
                          aria-label="Dismiss notification"
                          onClick={(e) => handleDismissNotification(e, notif.id)}
                        >
                          <FiX size={15} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

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
