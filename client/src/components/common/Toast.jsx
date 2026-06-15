import React from 'react';

export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded">
      {message}
    </div>
  );
}
