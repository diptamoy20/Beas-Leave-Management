import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Spinner, Alert, Badge } from 'react-bootstrap';
import {
  FiShield,
  FiUsers,
  FiUserPlus,
  FiUser,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiX,
  FiSearch,
  FiAlertCircle,
  FiCheckCircle,
  FiSliders,
  FiLock,
  FiRefreshCw
} from 'react-icons/fi';
import '../assets/css/EmployeeLeaveHistory.css';

const ROLE_METADATA = {
  super_admin: {
    label: 'Super Admin',
    desc: 'Highest Access Level (Manages Admins & System Access)',
    bg: '#6f42c1',
    badgeClass: 'badge-super-admin',
  },
  admin: {
    label: 'Admin',
    desc: 'Administrator (Operations & Leave Management)',
    bg: '#0d6efd',
    badgeClass: 'badge-admin',
  },
  manager: {
    label: 'Manager',
    desc: 'Team Manager (Approves Team Leave Requests & Comp-Off)',
    bg: '#0dcaf0',
    badgeClass: 'badge-manager',
  },
  employee: {
    label: 'Employee',
    desc: 'Standard Employee (Applies for Leaves & Attendance)',
    bg: '#6c757d',
    badgeClass: 'badge-employee',
  }
};

const DEFAULT_PERMISSIONS = {
  super_admin: {
    can_manage_admins: true,
    can_view_all_leaves: true,
    can_modify_approved_leaves: true,
    can_adjust_balances: true,
    can_manage_holidays: true,
  },
  admin: {
    can_manage_admins: false,
    can_view_all_leaves: true,
    can_modify_approved_leaves: true,
    can_adjust_balances: true,
    can_manage_holidays: true,
  },
  manager: {
    can_manage_admins: false,
    can_view_all_leaves: false,
    can_modify_approved_leaves: false,
    can_adjust_balances: false,
    can_manage_holidays: false,
  },
  employee: {
    can_manage_admins: false,
    can_view_all_leaves: false,
    can_modify_approved_leaves: false,
    can_adjust_balances: false,
    can_manage_holidays: false,
  },
};

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Assign Admin Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [eligibleEmployees, setEligibleEmployees] = useState([]);
  const [empSearch, setEmpSearch] = useState('');
  const [empLoading, setEmpLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [newPermissions, setNewPermissions] = useState(DEFAULT_PERMISSIONS.admin);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Edit Admin Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editPermissions, setEditPermissions] = useState({});
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete/Demote Confirmation
  const [showDemoteModal, setShowDemoteModal] = useState(false);
  const [adminToDemote, setAdminToDemote] = useState(null);
  const [submittingDemote, setSubmittingDemote] = useState(false);

  const [roleCounts, setRoleCounts] = useState({ super: 0, admin: 0, manager: 0, employee: 0, total: 0 });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const fetchAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/admin/admins', { headers: getAuthHeaders() });
      setAdmins(res.data.data?.admins || []);
      if (res.data.data?.counts) {
        setRoleCounts(res.data.data.counts);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch admin list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Search eligible employees when modal opens or query changes
  useEffect(() => {
    if (!showAssignModal) return;
    const timer = setTimeout(async () => {
      setEmpLoading(true);
      try {
        const res = await axios.get('/api/admin/eligible-employees', {
          headers: getAuthHeaders(),
          params: { search: empSearch }
        });
        setEligibleEmployees(res.data.data?.employees || []);
      } catch (err) {
        console.error(err);
      } finally {
        setEmpLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [empSearch, showAssignModal]);

  const handleRoleChangeForNew = (role) => {
    setNewRole(role);
    setNewPermissions(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.admin);
  };

  const handleRoleChangeForEdit = (role) => {
    setEditRole(role);
    // If switching to super_admin, enable all permissions
    if (role === 'super_admin') {
      setEditPermissions(DEFAULT_PERMISSIONS.super_admin);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmp) {
      alert('Please select an employee');
      return;
    }
    setSubmittingAssign(true);
    try {
      await axios.post(
        '/api/admin/admins',
        {
          employee_id: selectedEmp,
          role: newRole,
          permissions: newPermissions
        },
        { headers: getAuthHeaders() }
      );
      setMessage(`Successfully assigned as ${ROLE_METADATA[newRole]?.label || newRole}`);
      setShowAssignModal(false);
      setSelectedEmp('');
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || 'Error assigning admin');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const openEditModal = (admin) => {
    setEditingAdmin(admin);
    setEditRole(admin.role);
    setEditPermissions({ ...admin.permissions });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setSubmittingEdit(true);
    try {
      // 1. Update role if changed
      if (editRole !== editingAdmin.role) {
        await axios.put(
          `/api/admin/admins/${editingAdmin.employee_id}/role`,
          { role: editRole },
          { headers: getAuthHeaders() }
        );
      }

      // 2. Update permissions
      await axios.put(
        `/api/admin/admins/${editingAdmin.employee_id}/permissions`,
        { permissions: editPermissions },
        { headers: getAuthHeaders() }
      );

      setMessage(`Updated ${editingAdmin.name}'s role and permissions`);
      setShowEditModal(false);
      setEditingAdmin(null);
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update admin');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDemoteSubmit = async () => {
    if (!adminToDemote) return;
    setSubmittingDemote(true);
    try {
      await axios.delete(`/api/admin/admins/${adminToDemote.employee_id}`, {
        headers: getAuthHeaders()
      });
      setMessage(`Removed admin privileges for ${adminToDemote.name}`);
      setShowDemoteModal(false);
      setAdminToDemote(null);
      fetchAdmins();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to demote admin');
    } finally {
      setSubmittingDemote(false);
    }
  };

  const filteredAdmins = useMemo(() => {
    if (!search) return admins;
    const q = search.toLowerCase();
    return admins.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        String(a.employee_id).includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.role?.toLowerCase().includes(q)
    );
  }, [admins, search]);

  const stats = useMemo(() => {
    return {
      total: roleCounts.total || admins.length,
      super: roleCounts.super || admins.filter((a) => a.role === 'super_admin').length,
      admin: roleCounts.admin || admins.filter((a) => a.role === 'admin').length,
      manager: roleCounts.manager || admins.filter((a) => a.role === 'manager').length,
      employee: roleCounts.employee || 0,
    };
  }, [admins, roleCounts]);

  return (
    <div className="elh-wrapper">
      {/* Page Header */}
      <div className="elh-page-header">
        <div className="elh-header-title-area">
          <div className="elh-breadcrumb">
            <span>Administration</span> / <span className="active">Role Hierarchy</span>
          </div>
          <h1 className="elh-page-title">
            <FiShield style={{ marginRight: '10px', color: '#6f42c1' }} />
            Hierarchy & Access Control
          </h1>
          <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
            Manage Super Admin, Admin, and Manager privileges and configure granular administrator permissions.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={fetchAdmins} disabled={loading}>
            <FiRefreshCw className={loading ? 'spin' : ''} style={{ marginRight: '6px' }} />
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowAssignModal(true);
              setNewRole('admin');
              setNewPermissions(DEFAULT_PERMISSIONS.admin);
              setSelectedEmp('');
            }}
            style={{ backgroundColor: '#6f42c1', borderColor: '#6f42c1' }}
          >
            <FiUserPlus style={{ marginRight: '6px' }} /> Assign Role
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant="success" dismissible onClose={() => setMessage(null)}>
          <FiCheckCircle style={{ marginRight: '8px' }} /> {message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <FiAlertCircle style={{ marginRight: '8px' }} /> {error}
        </Alert>
      )}

      {/* Hierarchy Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #6f42c1' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Super Admin</span>
                <h3 className="mb-0 mt-1 fw-bold" style={{ color: '#6f42c1' }}>{stats.super}</h3>
                <small className="text-muted">Highest Authority</small>
              </div>
              <div className="p-3 rounded-circle" style={{ backgroundColor: 'rgba(111, 66, 193, 0.1)' }}>
                <FiLock size={24} style={{ color: '#6f42c1' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #0d6efd' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Admin</span>
                <h3 className="mb-0 mt-1 fw-bold text-primary">{stats.admin}</h3>
                <small className="text-muted">Operations & Permissions</small>
              </div>
              <div className="p-3 rounded-circle bg-primary-subtle">
                <FiShield size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #0dcaf0' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Manager</span>
                <h3 className="mb-0 mt-1 fw-bold text-info">{stats.manager}</h3>
                <small className="text-muted">Team Approvals & Leaves</small>
              </div>
              <div className="p-3 rounded-circle bg-info-subtle">
                <FiUsers size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card shadow-sm border-0 h-100 p-3" style={{ borderLeft: '4px solid #6c757d' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="text-muted small text-uppercase fw-bold">Employee</span>
                <h3 className="mb-0 mt-1 fw-bold text-secondary">{stats.employee}</h3>
                <small className="text-muted">Standard Team Members</small>
              </div>
              <div className="p-3 rounded-circle bg-secondary-subtle">
                <FiUser size={24} className="text-secondary" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card shadow-sm border-0">
        <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <h5 className="mb-0 fw-bold">Active Privileged Users ({filteredAdmins.length})</h5>
          <div style={{ maxWidth: '300px', width: '100%' }}>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <FiSearch />
              </span>
              <Form.Control
                type="text"
                placeholder="Search by name, ID..."
                className="border-start-0"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>User</th>
                <th>Designation</th>
                <th>Role Tier</th>
                <th>Permissions Matrix</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <div className="mt-2 text-muted">Loading administrators...</div>
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-5 text-muted">
                    No administrators found matching your search.
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => {
                  const roleMeta = ROLE_METADATA[admin.role] || ROLE_METADATA.admin;
                  return (
                    <tr key={admin.employee_id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold me-3"
                            style={{
                              width: '42px',
                              height: '42px',
                              backgroundColor: roleMeta.bg,
                              fontSize: '1rem',
                            }}
                          >
                            {admin.name ? admin.name.charAt(0).toUpperCase() : 'A'}
                          </div>
                          <div>
                            <div className="fw-bold">{admin.name}</div>
                            <small className="text-muted">
                              ID: #{admin.employee_id} • {admin.email}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-secondary">{admin.designation || 'Not specified'}</span>
                      </td>
                      <td>
                        <span
                          className="badge py-2 px-3 fw-semibold"
                          style={{
                            backgroundColor: roleMeta.bg,
                            fontSize: '0.85rem',
                          }}
                        >
                          {roleMeta.label}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1" style={{ maxWidth: '380px' }}>
                          {admin.role === 'super_admin' ? (
                            <Badge bg="dark" className="p-1 px-2">
                              ⭐ Full System Rights (Super Admin)
                            </Badge>
                          ) : (
                            <>
                              <Badge
                                bg={admin.permissions?.can_view_all_leaves ? 'success' : 'light'}
                                text={admin.permissions?.can_view_all_leaves ? 'white' : 'muted'}
                                className="border"
                              >
                                {admin.permissions?.can_view_all_leaves ? <FiCheck /> : <FiX />} View All Leaves
                              </Badge>
                              <Badge
                                bg={admin.permissions?.can_modify_approved_leaves ? 'primary' : 'light'}
                                text={admin.permissions?.can_modify_approved_leaves ? 'white' : 'muted'}
                                className="border"
                              >
                                {admin.permissions?.can_modify_approved_leaves ? <FiCheck /> : <FiX />} Modify Approved Leaves
                              </Badge>
                              <Badge
                                bg={admin.permissions?.can_adjust_balances ? 'info' : 'light'}
                                text={admin.permissions?.can_adjust_balances ? 'white' : 'muted'}
                                className="border"
                              >
                                {admin.permissions?.can_adjust_balances ? <FiCheck /> : <FiX />} Adjust Balances
                              </Badge>
                              <Badge
                                bg={admin.permissions?.can_manage_holidays ? 'secondary' : 'light'}
                                text={admin.permissions?.can_manage_holidays ? 'white' : 'muted'}
                                className="border"
                              >
                                {admin.permissions?.can_manage_holidays ? <FiCheck /> : <FiX />} Manage Holidays
                              </Badge>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="text-end">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => openEditModal(admin)}
                          title="Configure Role & Permissions"
                        >
                          <FiEdit2 /> Edit
                        </Button>
                        {admin.role !== 'super_admin' && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => {
                              setAdminToDemote(admin);
                              setShowDemoteModal(true);
                            }}
                            title="Demote to Regular Employee"
                          >
                            <FiTrash2 /> Demote
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ASSIGN NEW ADMIN MODAL */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">
            <FiUserPlus className="me-2 text-primary" /> Assign Subordinate Admin
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAssignSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">1. Search & Select Employee</Form.Label>
              <Form.Control
                type="text"
                placeholder="Type to filter employees by name, email, ID..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="mb-2"
              />
              {empLoading ? (
                <div className="text-muted small py-2">
                  <Spinner animation="border" size="sm" className="me-2" /> Searching employees...
                </div>
              ) : (
                <Form.Select
                  size="sm"
                  value={selectedEmp}
                  onChange={(e) => setSelectedEmp(e.target.value)}
                  required
                >
                  <option value="">-- Choose an Employee --</option>
                  {eligibleEmployees.map((emp) => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.name} (#{emp.employee_id}) — {emp.designation || 'Staff'} ({emp.email})
                    </option>
                  ))}
                </Form.Select>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">2. Choose Role to Assign</Form.Label>
              <div className="row g-2">
                {['employee', 'manager', 'admin', 'super_admin'].map((roleKey) => {
                  const meta = ROLE_METADATA[roleKey];
                  const isSelected = newRole === roleKey;
                  return (
                    <div key={roleKey} className="col-12 col-md-6 col-lg-3">
                      <div
                        onClick={() => handleRoleChangeForNew(roleKey)}
                        className={`p-3 rounded border cursor-pointer h-100 ${
                          isSelected ? 'border-primary bg-light' : ''
                        }`}
                        style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                      >
                        <div className="d-flex align-items-center mb-1">
                          <Form.Check
                            type="radio"
                            name="roleRadio"
                            checked={isSelected}
                            onChange={() => handleRoleChangeForNew(roleKey)}
                            className="me-2"
                          />
                          <span className="fw-bold" style={{ color: meta.bg }}>
                            {meta.label}
                          </span>
                        </div>
                        <small className="text-muted d-block ps-4">{meta.desc}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="fw-semibold">3. Granular Permissions</Form.Label>
              <div className="p-3 bg-light rounded border">
                <Form.Check
                  type="checkbox"
                  id="perm_view_leaves"
                  label="Can View All Leaves Across Organization"
                  checked={Boolean(newPermissions.can_view_all_leaves)}
                  onChange={(e) =>
                    setNewPermissions({ ...newPermissions, can_view_all_leaves: e.target.checked })
                  }
                  className="mb-2"
                />
                <Form.Check
                  type="checkbox"
                  id="perm_modify_leaves"
                  label="Can Modify / Override Leaves After Manager Approval"
                  checked={Boolean(newPermissions.can_modify_approved_leaves)}
                  onChange={(e) =>
                    setNewPermissions({
                      ...newPermissions,
                      can_modify_approved_leaves: e.target.checked,
                    })
                  }
                  className="mb-2"
                />
                <Form.Check
                  type="checkbox"
                  id="perm_adjust_balances"
                  label="Can Adjust Employee Leave Balances"
                  checked={Boolean(newPermissions.can_adjust_balances)}
                  onChange={(e) =>
                    setNewPermissions({ ...newPermissions, can_adjust_balances: e.target.checked })
                  }
                  className="mb-2"
                />
                <Form.Check
                  type="checkbox"
                  id="perm_manage_holidays"
                  label="Can Manage Company Holidays"
                  checked={Boolean(newPermissions.can_manage_holidays)}
                  onChange={(e) =>
                    setNewPermissions({ ...newPermissions, can_manage_holidays: e.target.checked })
                  }
                  className="mb-2"
                />
              </div>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submittingAssign}>
              {submittingAssign ? <Spinner animation="border" size="sm" /> : 'Confirm Assignment'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* EDIT ROLE & PERMISSIONS MODAL */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">
            <FiSliders className="me-2 text-primary" /> Edit Admin: {editingAdmin?.name}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label className="fw-semibold">Role Tier</Form.Label>
              <Form.Select
                value={editRole}
                onChange={(e) => handleRoleChangeForEdit(e.target.value)}
              >
                <option value="super_admin">Super Admin (Highest Authority)</option>
                <option value="admin">Admin (Administrator)</option>
                <option value="manager">Manager (Team Leaves & Approvals)</option>
                <option value="employee">Employee (Standard Access)</option>
              </Form.Select>
              <Form.Text className="text-muted">
                {ROLE_METADATA[editRole]?.desc}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label className="fw-semibold">Permissions</Form.Label>
              <div className="p-3 bg-light rounded border">
                <Form.Check
                  type="checkbox"
                  id="edit_view_leaves"
                  label="Can View All Leaves"
                  checked={editRole === 'super_admin' || Boolean(editPermissions.can_view_all_leaves)}
                  disabled={editRole === 'super_admin'}
                  onChange={(e) =>
                    setEditPermissions({
                      ...editPermissions,
                      can_view_all_leaves: e.target.checked,
                    })
                  }
                  className="mb-2"
                />
                <Form.Check
                  type="checkbox"
                  id="edit_modify_leaves"
                  label="Can Modify Approved Leaves (Post-Manager Review)"
                  checked={
                    editRole === 'super_admin' ||
                    Boolean(editPermissions.can_modify_approved_leaves)
                  }
                  disabled={editRole === 'super_admin'}
                  onChange={(e) =>
                    setEditPermissions({
                      ...editPermissions,
                      can_modify_approved_leaves: e.target.checked,
                    })
                  }
                  className="mb-2"
                />
                <Form.Check
                  type="checkbox"
                  id="edit_adjust_balances"
                  label="Can Adjust Leave Balances"
                  checked={
                    editRole === 'super_admin' || Boolean(editPermissions.can_adjust_balances)
                  }
                  disabled={editRole === 'super_admin'}
                  onChange={(e) =>
                    setEditPermissions({
                      ...editPermissions,
                      can_adjust_balances: e.target.checked,
                    })
                  }
                  className="mb-2"
                />
                <Form.Check
                  type="checkbox"
                  id="edit_manage_holidays"
                  label="Can Manage Holidays"
                  checked={
                    editRole === 'super_admin' || Boolean(editPermissions.can_manage_holidays)
                  }
                  disabled={editRole === 'super_admin'}
                  onChange={(e) =>
                    setEditPermissions({
                      ...editPermissions,
                      can_manage_holidays: e.target.checked,
                    })
                  }
                  className="mb-2"
                />
              </div>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submittingEdit}>
              {submittingEdit ? <Spinner animation="border" size="sm" /> : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* DEMOTE CONFIRMATION MODAL */}
      <Modal show={showDemoteModal} onHide={() => setShowDemoteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold text-danger">Demote Administrator</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to remove admin privileges from{' '}
          <strong>{adminToDemote?.name}</strong> (#{adminToDemote?.employee_id})?
          <p className="text-muted small mt-2">
            This employee will be returned to a standard <code>employee</code> role and lose access to
            all administrative tools.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDemoteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDemoteSubmit} disabled={submittingDemote}>
            {submittingDemote ? <Spinner animation="border" size="sm" /> : 'Yes, Demote'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminManagement;
