/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';

export const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  return <TenantContext.Provider value={{ tenant, setTenant }}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
