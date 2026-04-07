export default function PageLoading() {
  return (
    <main className="page">
      <div className="card stack">
        <div className="page-loading">
          <div className="page-loading-header">
            <div className="page-loading-mark" />
            <div className="stack" style={{ gap: 8 }}>
              <div className="page-loading-line page-loading-line-title" />
              <div className="page-loading-line page-loading-line-subtitle" />
            </div>
          </div>
          <div className="grid3">
            <div className="page-loading-block" />
            <div className="page-loading-block" />
            <div className="page-loading-block" />
          </div>
          <div className="panel stack">
            <div className="page-loading-line page-loading-line-wide" />
            <div className="page-loading-line" />
            <div className="page-loading-line page-loading-line-short" />
          </div>
        </div>
      </div>
    </main>
  );
}
