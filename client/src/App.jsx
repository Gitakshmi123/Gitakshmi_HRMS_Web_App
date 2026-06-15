import React, { useEffect } from "react";
import { notification, App as AntApp, ConfigProvider } from "antd";
import { Toaster } from 'react-hot-toast';
import RootRouter from "./router/RootRouter";

// Context Providers
// NOTE: AuthProvider is already in main.jsx, do NOT duplicate it here.
import { UIProvider } from "./context/UIContext";
import { TenantProvider } from "./context/TenantContext";
import { AppHelper } from "./utils/antdGlobal";


export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 8,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
      }}
    >
      <AntApp
        notification={{
          placement: 'topRight',
          top: 70,
          duration: 3,
          maxCount: 3,
        }}
      >
        <AppHelper />
        <TenantProvider>
          <UIProvider>
            <div className="min-h-screen bg-gray-50">
              <Toaster position="top-right" reverseOrder={false} />

              <RootRouter />
            </div>
          </UIProvider>
        </TenantProvider>
      </AntApp>
    </ConfigProvider>
  );
}
