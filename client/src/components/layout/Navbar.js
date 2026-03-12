import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiBell, FiMoon, FiSun, FiUser, FiLogOut } from 'react-icons/fi';
import { toggleSidebar, toggleDarkMode } from '../../store/slices/themeSlice';
import { logout } from '../../store/slices/authSlice';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { darkMode, sidebarExpanded } = useSelector((state) => state.theme);
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
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
              <small className="text-muted">{user?.email}</small>
            </div>
            <Dropdown.Item onClick={() => navigate('/profile')}>
              <FiUser className="me-2" /> My Profile
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item onClick={handleLogout} className="text-danger">
              <FiLogOut className="me-2" /> Logout
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </nav>
  );
};

export default Navbar;
