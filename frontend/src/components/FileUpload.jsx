import { useState, useRef } from 'react';
import './FileUpload.css';

export default function FileUpload({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.pgn') && file.type !== 'application/octet-stream') {
      setError('Please select a .pgn file');
      return;
    }

    setError('');
    setIsLoading(true);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('pgn', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onUpload(data.games, data.username || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function handleChange(e) {
    handleFile(e.target.files[0]);
  }

  return (
    <div
      className={`upload-area ${isDragging ? 'dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
      aria-label="Upload PGN file"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pgn"
        onChange={handleChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {isLoading ? (
        <div className="upload-inner">
          <span className="spinner" />
          <p>Parsing PGN file...</p>
        </div>
      ) : (
        <div className="upload-inner">
          <div className="upload-icon">📂</div>
          <p className="upload-text">
            {fileName
              ? `✓ ${fileName} loaded`
              : 'Drop your PGN file here or click to browse'}
          </p>
          <p className="upload-hint">Supports Lichess & Chess.com PGN exports</p>
          {error && <p className="upload-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
