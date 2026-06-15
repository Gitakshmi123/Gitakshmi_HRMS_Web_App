import { createPortal } from "react-dom";
import { useState, useEffect } from "react";

const GlobalModal = ({ isOpen, onClose, children, maxWidth = "max-w-5xl" }) => {
  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOpen]);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center">

      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Modal */}
      <div
        className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl p-6 
        transform transition-all duration-300 ease-out 
        animate-in fade-in zoom-in-95`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-black transition"
        >
          ✕
        </button>

        {children}
      </div>
    </div>,
    document.body
  );
};

export default GlobalModal;
