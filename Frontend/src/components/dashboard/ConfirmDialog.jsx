import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import './ConfirmDialog.css';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busyLabel,
  danger = true,
  isBusy = false,
  onConfirm,
  onCancel,
}) {
  const { language } = useLanguage();
  const isKm = language !== 'en';

  if (!open) return null;

  return (
    <div className="confirm-dialog-scrim" role="dialog" aria-modal="true">
      <div className="confirm-dialog-card font-kantomruy">
        <div className={`confirm-dialog-icon-badge ${danger ? 'danger' : ''}`}>
          <AlertTriangle size={22} />
        </div>
        <h3 className="confirm-dialog-title">{title || (isKm ? 'បញ្ជាក់ការលុប' : 'Confirm Delete')}</h3>
        <p className="confirm-dialog-message">
          {message ||
            (isKm
              ? 'តើអ្នកប្រាកដជាចង់លុបកំណត់ត្រានេះមែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។'
              : 'Are you sure you want to delete this? This action cannot be undone.')}
        </p>
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-cancel-btn" type="button" onClick={onCancel} disabled={isBusy}>
            {cancelLabel || (isKm ? 'បោះបង់' : 'Cancel')}
          </button>
          <button
            className={`confirm-dialog-confirm-btn ${danger ? 'danger' : ''}`}
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? busyLabel || (isKm ? 'កំពុងលុប...' : 'Deleting...') : confirmLabel || (isKm ? 'លុប' : 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
