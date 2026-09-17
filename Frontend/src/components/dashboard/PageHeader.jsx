import React from 'react';
import { ArrowLeft } from 'lucide-react';
import './PageHeader.css';

export default function PageHeader({ icon, title, subtitle, onBack, backLabel, right }) {
  return (
    <header className="page-header-bar">
      <div className="page-header-left">
        {onBack && (
          <button
            type="button"
            className="page-header-back-btn"
            onClick={onBack}
            aria-label={backLabel || 'Back'}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="page-header-text-block">
          <h1 className="page-header-title">
            {icon && <span className="page-header-icon-badge">{icon}</span>}
            {title}
          </h1>
          {subtitle && <p className="page-header-sub">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  );
}
