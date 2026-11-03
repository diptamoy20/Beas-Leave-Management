import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  FiHome,
  FiCalendar,
  FiFileText,
  FiUsers,
  FiCheckSquare,
  FiShield,
  FiCheckCircle,
  FiClock,
  FiVideo
} from 'react-icons/fi';

const ADMIN_ROLES = ['super_admin', 'admin_1', 'admin_2', 'admin_3', 'admin'];

const Sidebar = () => {
  const { sidebarExpanded } = useSelector((state) => state.theme);
  const { user } = useSelector((state) => state.auth);

  const role = user?.role;
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = ADMIN_ROLES.includes(role);
  const canManageAdmins = isSuperAdmin || Boolean(user?.permissions?.can_manage_admins);
  const canViewAllLeaves = isSuperAdmin || user?.permissions?.can_view_all_leaves !== false;

  const menuItems = [
    { path: '/dashboard', icon: <FiHome />, label: 'Dashboard' },
    { path: '/apply-leave', icon: <FiFileText />, label: 'Apply Leave' },
    { path: '/my-leaves', icon: <FiCalendar />, label: 'My Leaves' },
    { path: '/attendance', icon: <FiCheckCircle />, label: 'Attendance' },
    { path: '/comp-off', icon: <FiClock />, label: 'Comp-Off' },
    { path: '/client-meetings', icon: <FiVideo />, label: 'Client Meetings' },
    { path: '/holidays', icon: <FiCalendar />, label: 'Holidays' },
  ];

  // Super Admin: Admin Management
  if (canManageAdmins) {
    menuItems.push({
      path: '/admin-management',
      icon: <FiShield />,
      label: 'Admin Hierarchy'
    });
  }

  // Super Admin & Authorized Admins: Post-Manager Approval Leave Oversight
  if (isAdmin && canViewAllLeaves) {
    menuItems.push({
      path: '/approved-leaves-review',
      icon: <FiCheckCircle />,
      label: 'Leave Oversight'
    });
  }

  // All Admin tiers: Employee Leave Records
  if (isAdmin) {
    menuItems.push({
      path: '/leave-records',
      icon: <FiCheckSquare />,
      label: 'Employees Leave'
    });
  }

  // Managers & Admins assigned to approval duties
  if (role === 'manager' || isSuperAdmin) {
    menuItems.push({
      path: '/manage-leaves',
      icon: <FiUsers />,
      label: 'Manage Leaves'
    });
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
