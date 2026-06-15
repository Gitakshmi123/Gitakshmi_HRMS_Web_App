import React from 'react';

export default function Input({ label, ...props }) {
  return (
    <label className="block">
      {label && <span className="text-sm text-gray-600">{label}</span>}
      <input className="mt-1 p-2 border rounded w-full" {...props} />
    </label>
  );
}
