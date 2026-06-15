/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect } from 'react';

export const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // Always ensure 'dark' class is removed
    document.documentElement.classList.remove('dark');
    // We can still set the localStorage if we want to store user preference (though we are forcing light)
    // But it's safer to just set it to light
    localStorage.setItem('theme', 'light');
  }, [theme]);

  const toggleTheme = () => {
    setTheme('light');
  };

  return (
    <UIContext.Provider value={{ toast, setToast, theme, setTheme, toggleTheme }}>
      {children}
    </UIContext.Provider>
  );
}
