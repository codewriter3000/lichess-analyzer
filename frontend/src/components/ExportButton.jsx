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
      className="w-full flex items-center gap-2 bg-primary/10 text-primary py-2.5 px-4 rounded-sm font-label text-xs uppercase tracking-widest hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      onClick={handleExport}
      disabled={disabled}
      title="Export games as CSV"
    >
      <span className="material-symbols-outlined text-sm">download</span>
      Export CSV
    </button>
  );
}

