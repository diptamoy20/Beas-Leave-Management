import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  FiHome, 
  FiCalendar, 
  FiFileText, 
  FiClock, 
  FiUsers, 
  FiCheckSquare 
} from 'react-icons/fi';

const Sidebar = () => {
  const { sidebarExpanded } = useSelector((state) => state.theme);
  const { user } = useSelector((state) => state.auth);

  const menuItems = [
    { path: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
    { path: '/apply-leave', icon: <FiFileText />, label: 'Apply Leave' },
    { path: '/my-leaves', icon: <FiCalendar />, label: 'My Leaves' },
    { path: '/attendance', icon: <FiClock />, label: 'Attendance' },
    { path: '/holidays', icon: <FiCalendar />, label: 'Holidays' },
    { path: '/leave-balance', icon: <FiCheckSquare />, label: 'Leave Balance' },
  ];

  if (user?.role === 'manager') {
    menuItems.push(
      { path: '/manage-leaves', icon: <FiUsers />, label: 'Manage Leaves' }
    );
  }

  return (
    <aside className={`sidebar ${!sidebarExpanded ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <NavLink to="/dashboard" className="sidebar-logo">
          {sidebarExpanded ? (
            <img 
              src="https://api.beasconsultancy.com/assets/img/logo/1765541148_image.png" 
              alt="BEAS Consultancy" 
              className="sidebar-logo-img"
            />
          ) : (
            <span className="sidebar-logo-short">B</span>
          )}
        </NavLink>
      </div>

      <ul className="sidebar-menu">
        {menuItems.map((item) => (
          <li key={item.path} className="sidebar-menu-item">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `sidebar-menu-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="sidebar-menu-icon">{item.icon}</span>
              <span className="sidebar-menu-text">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;
