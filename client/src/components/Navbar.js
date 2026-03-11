import React from 'react';
import { Link } from 'react-router-dom';

function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <h2>Leave Management System</h2>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/apply-leave">Apply Leave</Link>
          <Link to="/my-leaves">My Leaves</Link>
          <Link to="/leave-balance">Balance</Link>
          {(user.role === 'manager' || user.role === 'admin') && (
            <Link to="/manage-leaves">Manage Leaves</Link>
          )}
          <button onClick={onLogout} className="btn btn-danger" style={{marginLeft: '10px'}}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
