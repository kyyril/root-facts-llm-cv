import { Sprout } from 'lucide-react';

function Header({ modelStatus, loadingPct }) {
  const isModelReady = modelStatus === 'Model AI Siap';

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <Sprout size={20} />
          <span>RootFacts</span>
        </div>

        <div className="status-pill">
          <span className={`status-dot ${isModelReady ? 'active' : ''}`}></span>
          <span>{modelStatus}</span>
          {!isModelReady && loadingPct > 0 && (
            <div
              style={{
                width: '60px',
                height: '4px',
                background: 'var(--border-light)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginLeft: '0.25rem',
              }}
            >
              <div
                style={{
                  width: `${loadingPct}%`,
                  height: '100%',
                  background: 'var(--primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
