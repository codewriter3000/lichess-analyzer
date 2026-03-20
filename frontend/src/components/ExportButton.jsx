import './ExportButton.css';

export default function ExportButton({ username, disabled }) {
  function handleExport() {
    const url = username
      ? `/api/export/csv?username=${encodeURIComponent(username)}`
      : '/api/export/csv';

    // Create a temporary link to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chess-games.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <button
      className="btn btn-primary export-btn"
      onClick={handleExport}
      disabled={disabled}
      title="Export games as CSV"
    >
      ⬇ Export CSV
    </button>
  );
}
