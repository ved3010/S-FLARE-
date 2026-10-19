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
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading || !selectedFile}
              className={`w-full py-2.5 px-4 rounded-lg font-mono text-xs font-bold uppercase transition-all ${loading || !selectedFile ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 cursor-pointer'}`}
            >
              {loading ? 'Validating & Processing Dataset...' : 'Upload & Validate CSV Dataset'}
            </button>
          </div>

          {/* Preprocessing Options */}
          <div className="glass rounded-xl p-4 space-y-4 text-mono">
            <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
              Preprocessing Configuration
            </div>

            <div className="space-y-1.5 text-[11px]">
              <label className="text-white/60 text-[10px] block">MISSING VALUE HANDLING:</label>
              <select
                value={imputationMethod}
                onChange={(e) => setImputationMethod(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white font-mono text-[11px] focus:outline-none"
              >
                <option value="forward_fill">Forward Fill (LOCF)</option>
                <option value="linear">Linear Interpolation</option>
                <option value="median">Median Replacement</option>
              </select>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <label className="text-white/60 text-[10px] block">FEATURE NORMALIZATION:</label>
              <select
                value={scaler}
                onChange={(e) => setScaler(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded p-2 text-white font-mono text-[11px] focus:outline-none"
              >
                <option value="minmax">MinMaxScaler [0, 1]</option>
                <option value="standard">StandardScaler (Z-score)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* DATASET SUMMARY & PREVIEW */}
      {summary && (
        <div className="space-y-6">
          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="dash-card p-4 font-mono">
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mb-1">TOTAL OBSERVATIONS</span>
              <span className="text-2xl font-black text-amber-400">{summary.totalRows.toLocaleString()}</span>
              <span className="text-[9px] text-white/40 block mt-1">{summary.filename}</span>
            </div>

            <div className="dash-card p-4 font-mono">
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mb-1">CHRONOLOGICAL SPAN</span>
              <span className="text-xs font-bold text-white block">{summary.startTime}</span>
              <span className="text-xs font-bold text-white/50 block">to {summary.endTime}</span>
            </div>

            <div className="dash-card p-4 font-mono">
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mb-1">FLARE CLASS BALANCE</span>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm font-bold text-red-400">{summary.flareEventCount} Flare</span>
                <span className="text-sm font-bold text-emerald-400">{summary.nonFlareEventCount} Quiet</span>
              </div>
            </div>

            <div className="dash-card p-4 font-mono">
              <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mb-1">COLUMNS DETECTED</span>
              <span className="text-sm font-bold text-sky-400">{summary.columnNames.length} Features</span>
              <span className="text-[9px] text-white/40 block mt-1">{summary.columnNames.join(', ')}</span>
            </div>
          </div>

          {/* Sample Preview Table */}
          <div className="dash-card p-5 font-mono">
            <div className="dash-card-header-left mb-4">
              <div className="dash-card-bar" style={{ background: '#38BDF8' }} />
              <span className="dash-card-title">Dataset Preview (First 10 Rows)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-[9px] uppercase">
                    {summary.columnNames.map((col) => (
                      <th key={col} className="py-2 px-3 font-bold">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {summary.samplePreview.map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      {summary.columnNames.map((col) => (
                        <td key={col} className="py-2 px-3 text-white/80">
                          {typeof row[col] === 'number' ? row[col].toExponential(3) : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
