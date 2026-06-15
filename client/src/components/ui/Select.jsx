import React from 'react';

export default function Select({ label, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="text-sm text-gray-600">{label}</span>}
      <select className="mt-1 p-2 border rounded w-full" {...props}>{children}</select>
    </label>
  );
}
