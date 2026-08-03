import { useState } from 'react';

export default function DataExplorer() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [imputationMethod, setImputationMethod] = useState('forward_fill');
  const [scaler, setScaler] = useState('minmax');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a CSV dataset file first.');
      return;
    }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/dataset/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Upload failed');
      }

      const data = await res.json();
      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="premium-dash select-none space-y-6">
      {/* Header */}
      <div className="dash-section-head">
        <span className="dash-section-tag">Dataset Loader & Preprocessing</span>
        <h2 className="dash-section-title">Data Explorer & Ingestion Pipeline</h2>
        <p className="dash-section-desc">
          Upload custom CSV datasets containing combined Soft & Hard X-ray time series, validate required columns, handle missing values, and inspect feature distributions.
        </p>
      </div>

      {/* UPLOAD CARD */}
      <div className="dash-card p-6">
        <div className="dash-card-header-left mb-4">
          <div className="dash-card-bar" style={{ background: '#F59E0B' }} />
          <span className="dash-card-title">CSV Dataset Upload & Validation</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* File Picker Zone */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border-2 border-dashed border-white/20 hover:border-amber-500/50 rounded-xl p-6 text-center transition-all bg-black/20">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload-input"
              />
              <label htmlFor="csv-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
                <span className="text-3xl">📁</span>
                <span className="text-sm font-bold font-mono text-white">
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop CSV file'}
                </span>
                <span className="text-[10px] font-mono text-white/40">
                  Required columns: timestamp, soft_xray (or soft_flux), hard_xray (or hard_flux)
                </span>
              </label>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-mono text-[11px]">
