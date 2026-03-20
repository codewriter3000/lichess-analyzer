import './ExportButton.css';

export default function ExportButton({ username, disabled }) {
  function handleExport() {
    const url = username
      ? `/api/export/csv?username=${encodeURIComponent(username)}`
      : '/api/export/csv';

    const a = document.createElement('a');
    a.href = url;
    a.download = 'chess-games.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <button
      id="export-btn"
      onClick={handleExport}
      disabled={disabled}
      title="Export games as CSV"
    >
      <span className="material-symbols-outlined text-sm">download</span>
      Export CSV
    </button>
  );
}
