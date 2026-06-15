import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { RBACProvider } from './context/RBACContext';

if (typeof window !== 'undefined' && typeof window.global === 'undefined') {
  window.global = window;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <RBACProvider>
      <BrowserRouter future={{ v7_startTransition: true }}>
        <App />
      </BrowserRouter>
    </RBACProvider>
  </AuthProvider>
);
