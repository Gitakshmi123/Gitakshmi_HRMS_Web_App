import React from 'react';

export default function Modal({ title, children, open }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded p-4 w-full max-w-lg">
        {title && <h3 className="text-lg font-bold mb-2">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
