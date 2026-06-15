import React, { useRef, useState } from 'react';
import api from '../../utils/api';

// Simple Excel uploader component to integrate with backend upload endpoint
// Props:
// - uploadUrl: string (required) - API endpoint to POST FormData to
// - annualCTC: number (required) - numeric CTC to send
// - onSuccess: function(responseData) - called when upload succeeds
// - children: optional custom button/content

export default function ExcelUploader({ uploadUrl, annualCTC, onSuccess, children }) {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploaded, setUploaded] = useState(false);

  const resetInput = () => {
    if (fileRef.current) {
      try {
        fileRef.current.value = null;
      } catch (e) {}
    }
  };

  const handleFileChange = async (e) => {
    setError(null);
    setUploaded(false);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!uploadUrl) {
      setError('Upload URL not configured');
      resetInput();
      return;
    }

    setLoading(true);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('ctc', Number(annualCTC));
      form.append('annualCTC', Number(annualCTC));

      const res = await api.post(uploadUrl, form);

      if (res.data && res.data.success) {
        setUploaded(true);
        if (window.showToast) window.showToast({ message: res.data.message || 'Excel uploaded successfully', type: 'success' });
        if (onSuccess) onSuccess(res.data.data);
      } else {
        const message = (res.data && (res.data.message || res.data.error)) || 'Upload failed';
        setError(message);
        resetInput();
      }
    } catch (err) {
      const backend = err.response && err.response.data;
      if (backend) {
        if (backend.errors && Array.isArray(backend.errors)) {
          setError(`${backend.message || 'Validation failed'}: ${backend.errors.map(e => `Row ${e.row}: ${e.message}`).join('; ')}`);
        } else {
          setError(backend.message || backend.error || 'Upload failed');
        }
      } else {
        setError(err.message || 'Upload failed');
      }
      resetInput();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        disabled={loading || uploaded}
      />
      {children}
      {loading && <div className="text-sm text-slate-500">Uploading...</div>}
      {uploaded && <div className="mt-2 text-green-600 text-sm flex items-center gap-1">&#10003; Uploaded</div>}
      {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
    </div>
  );
}
