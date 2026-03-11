import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

function Sidebar({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isActive = (path) => location.pathname === path ? 'active' : '';

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div style={{display: 'flex', alignItems: 'center', flexDirection:"column", gap: '10px'}}>
          <img 
            src="https://api.beasconsultancy.com/assets/img/logo/1765541148_image.png" 
            alt="Logo" 
            style={{width: '100%', height: '100%', objectFit: 'contain'}}
          />
          <div>
            <p style={{fontSize: '20px', color: '#6b7280', margin: '0'}}>Leave Management</p>
          </div>
        </div>
      </div>
      
      <ul className="sidebar-menu">
        <li>
          <Link to="/dashboard" className={isActive('/dashboard')}>
            <span>📈</span> Dashboard
          </Link>
        </li>
        <li>
          <Link to="/attendance" className={isActive('/attendance')}>
            <span>⏰</span> Attendance
          </Link>
        </li>
        <li>
          <Link to="/holidays" className={isActive('/holidays')}>
            <span>📅</span> Holiday List
          </Link>
        </li>
        <li>
          <Link to="/apply-leave" className={isActive('/apply-leave')}>
            <span>➕</span> Apply Leave
          </Link>
        </li>
        <li>
          <Link to="/my-leaves" className={isActive('/my-leaves')}>
            <span>📋</span> My Leaves
          </Link>
        </li>
        <li>
          <Link to="/leave-balance" className={isActive('/leave-balance')}>
            <span>💰</span> Leave Balance
          </Link>
        </li>
        {(user.role === 'manager' || user.role === 'admin') && (
          <li>
            <Link to="/manage-leaves" className={isActive('/manage-leaves')}>
              <span>✅</span> Manage Leaves
            </Link>
          </li>
        )}
      </ul>

      <div style={{position: 'absolute', bottom: '24px', left: '0', right: '0', padding: '0 24px'}}>
        <div style={{padding: '16px', background: '#f9fafb', borderRadius: '8px', marginBottom: '12px', border: '1px solid #e5e7eb'}}>
          <div style={{fontSize: '12px', color: '#9ca3af', marginBottom: '4px'}}>Logged in as</div>
          <div style={{fontSize: '14px', fontWeight: '600', color: '#1a1a1a'}}>{user.name}</div>
          <div style={{fontSize: '12px', color: '#9ca3af'}}>{user.department}</div>
        </div>
        <button onClick={handleLogout} className="btn btn-logout" style={{width: '100%'}}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
