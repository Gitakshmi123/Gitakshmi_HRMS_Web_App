import { useState, useCallback } from 'react';
import api from '../utils/api';

/**
 * Custom hook for Organization Structure API calls
 * Provides loading states, error handling, and all org structure operations
 */
export default function useOrgStructure() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Get full company hierarchy
   */
  const getHierarchy = useCallback(async (depth = 10) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/hr/employees/hierarchy?depth=${depth}`);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load hierarchy';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get organizational tree for a specific employee
   */
  const getOrgTree = useCallback(async (employeeId, depth = 5) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/hr/employees/${employeeId}/org-tree?depth=${depth}`);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load org tree';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get full company org tree
   */
  const getCompanyOrgTree = useCallback(async (depth = 10) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/hr/org/tree?depth=${depth}`);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load company tree';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get top-level employees (no manager)
   */
  const getTopLevelEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/hr/employees/top-level');
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load top-level employees';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Set manager for an employee
   */
  const setManager = useCallback(async (employeeId, managerId) => {
    setLoading(true);
    setError(null);
    try {
      // Ensure managerId is a raw 24-char hex ObjectId or null
      const raw = managerId === undefined || managerId === null ? '' : String(managerId);
      const match = raw.match(/[a-fA-F0-9]{24}/);
      const sendManagerId = match ? match[0] : null;
      const response = await api.post(`/hr/employees/${employeeId}/set-manager`, { managerId: sendManagerId });
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to set manager';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Remove manager from an employee
   */
  const removeManager = useCallback(async (employeeId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.delete(`/hr/employees/${employeeId}/manager`);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to remove manager';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get direct reports for an employee
   */
  const getDirectReports = useCallback(async (employeeId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/hr/employees/${employeeId}/direct-reports`);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load direct reports';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get manager for an employee
   */
  const getManager = useCallback(async (employeeId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/hr/employees/${employeeId}/manager`);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load manager';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get reporting chain (all managers up the chain)
   */
  const getReportingChain = useCallback(async (employeeId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/hr/employees/${employeeId}/reporting-chain`);
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load reporting chain';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get all employees
   */
  const getAllEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/hr/employees');
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load employees';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get all departments
   */
  const getDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/hr/departments');
      return { success: true, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load departments';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getHierarchy,
    getOrgTree,
    getCompanyOrgTree,
    getTopLevelEmployees,
    setManager,
    removeManager,
    getDirectReports,
    getManager,
    getReportingChain,
    getAllEmployees,
    getDepartments,
    clearError: () => setError(null)
  };
}

