import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import EmployeeForm from "./EmployeeForm";
import api from "../../utils/api";
import { showToast } from "../../utils/uiNotifications";
import usePagePermissions from "../../hooks/usePagePermissions";

export default function EmployeeFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { employeeId } = useParams();
  const [employee, setEmployee] = useState(location.state?.employee || null);
  const [loading, setLoading] = useState(Boolean(employeeId && !location.state?.employee));

  const { canView, canCreate, canEdit, loading: permLoading } = usePagePermissions('people.employees');

  const employeesPath = useMemo(() => {
    return location.pathname.startsWith("/tenant")
      ? "/tenant/employees"
      : "/hr/employees";
  }, [location.pathname]);

  const isEditMode = location.pathname.includes("/edit");
  const isCreateMode = !employeeId && !isEditMode;

  useEffect(() => {
    if (permLoading) return;

    if (!canView) {
      showToast("error", "Access Denied", "You do not have permission to view this page");
      navigate("/hr/dashboard", { replace: true });
      return;
    }

    if (isCreateMode && !canCreate) {
      showToast("error", "Access Denied", "You do not have permission to create employees");
      navigate(employeesPath, { replace: true });
      return;
    }
  }, [canView, canCreate, isCreateMode, permLoading, navigate, employeesPath]);

  useEffect(() => {
    let cancelled = false;

    async function loadEmployee() {
      if (!employeeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get(`/hr/employees/${employeeId}`);
        if (!cancelled) {
          setEmployee(res.data?.data || res.data || null);
        }
      } catch {
        if (!cancelled) {
          showToast("error", "Error", "Failed to load employee details");
          navigate(employeesPath, { replace: true });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEmployee();

    return () => {
      cancelled = true;
    };
  }, [employeeId, employeesPath, navigate]);

  useEffect(() => {
    if (location.state?.employee) {
      setEmployee(location.state.employee);
      setLoading(false);
    }
  }, [location.state]);

  const forceViewOnly = isEditMode && !canEdit;

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {(loading || permLoading) ? (
        <div className="flex h-[70vh] items-center justify-center text-sm font-medium text-slate-500">
          Loading employee form...
        </div>
      ) : (
        <EmployeeForm
          employee={employee}
          viewOnly={forceViewOnly}
          onClose={() => navigate(employeesPath)}
          onDraftSaved={(savedDraft) => {
            setEmployee(savedDraft);
            if (savedDraft?._id && savedDraft._id !== employeeId) {
              navigate(`${employeesPath}/${savedDraft._id}/edit`, {
                replace: true,
                state: { employee: savedDraft },
              });
            }
          }}
        />
      )}
    </div>
  );
}
