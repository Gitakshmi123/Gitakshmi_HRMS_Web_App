import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layout
import SuperAdminLayout from '../layouts/SuperAdminLayout';

// Pages
import Dashboard from '../pages/super-admin/Dashboard';
import Companies from '../pages/super-admin/Companies';
import Modules from '../pages/super-admin/Modules';
import Activities from '../pages/super-admin/Activities';

// Fallback empty page for unbuilt routes
const Placeholder = ({ title }) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
      <p className="text-slate-500">This page is under construction.</p>
    </div>
  </div>
);

export default function SuperAdminRoutes() {
  return (
    <Routes>
      <Route element={<SuperAdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="modules" element={<Modules />} />
        <Route path="activities" element={<Activities />} />
        <Route path="users" element={<Placeholder title="Global Users Management" />} />
        <Route path="settings" element={<Placeholder title="Platform Settings" />} />
        <Route path="*" element={<Navigate to="/super-admin" replace />} />
      </Route>
    </Routes>
  );
}
