import { useState, useRef, useEffect } from 'react';
import './FileUpload.css';

export default function FileUpload({ onUpload, uploadId }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    function handleFabFile(e) { handleFile(e.detail); }
    window.addEventListener('pgn-file-selected', handleFabFile);
    return () => window.removeEventListener('pgn-file-selected', handleFabFile);
  }, []);

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
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
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
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div
      className={`upload-dropzone${isDragging ? ' dragging' : ''}`}
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
        id={uploadId}
        type="file"
        accept=".pgn"
        onChange={e => handleFile(e.target.files[0])}
        className="hidden"
        aria-hidden="true"
      />

      {isLoading ? (
        <div className="upload-inner">
          <span className="spinner" />
          <p className="font-body text-primary/70">Parsing PGN file...</p>
        </div>
      ) : (
        <div className="upload-inner">
          <span className="material-symbols-outlined text-5xl text-primary/30">description</span>
          <p className="font-headline text-lg text-primary">
            {fileName ? `✓ ${fileName} loaded` : 'Drop your PGN file here or click to browse'}
          </p>
          <p className="font-label text-xs uppercase tracking-widest text-primary/50">
            Supports Lichess &amp; Chess.com PGN exports
          </p>
          {error && <p className="font-body text-sm text-error mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}
