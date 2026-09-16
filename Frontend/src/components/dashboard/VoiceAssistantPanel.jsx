import { AudioLines, Check, ChevronUp, Pause, Play, Pencil, Plus, RotateCcw, Send, Square, X } from 'lucide-react';
import { useState as useLocalState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Waveform from './Waveform';

export default function VoiceAssistantPanel({
  mode,
  inFollowup = false,
  transcript = '',
  error = '',
  elapsed = '00:00',
  onStart,
  onPause,
  onStop,
  onRestart,
  onSend,
  onRecordAnswer,
  onOpenQuickEdit,
  onCloseQuickEdit,
  onApplyQuickEdit,
  onContinueRecording,
  onFinishAndReview,
  showQuickEdit = false,
  currentItem = null,
  question = '',
  history = [],
  answerText = '',
  onAnswerChange,
  onAnswerSubmit,
  isAnswering = false,
}) {
  const { t } = useLanguage();
  const isRecording = mode === 'listening' || mode === 'transcribing' || mode === 'clarification';
  // inFollowup takes priority for the title text: once a question has been
  // asked, keep showing "answer the question" even while mode cycles
  // through listening/paused/captured for the spoken answer -- only the
  // literal recording state (paused, captured, transcribing) should
  // override that when it's more specific than "still answering".
  const title = inFollowup
    ? (mode === 'paused' ? t('paused') : mode === 'captured' ? t('captured') : mode === 'transcribing' ? t('transcribing') : t('answerQuestion'))
    : mode === 'standby' ? t('assistantTitle')
    : mode === 'paused' ? t('paused')
    : mode === 'captured' ? t('captured')
    : mode === 'transcribing' ? t('transcribing')
    : t('recording');
  const subtitle = mode === 'standby' ? t('assistantSubtitle') : t('listeningSale');

  if (mode === 'standby') {
    return (
      <section className="voice-standby">
        <AssistantAvatar />
        <h2>{title}<br />{subtitle}</h2>
        {error && <p className="review-error-message">{error}</p>}
        <button className="voice-start-button" type="button" onClick={onStart}>
          <span>{t('tapMic')}</span>
          <b><AudioLines size={20} /></b>
        </button>
      </section>
    );
  }

  return (
    <section className="voice-active-screen">
      <div className="recording-indicator">
        <div className={`recording-orb ${isRecording ? 'active' : ''}`}>
          <AudioLines size={42} />
        </div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {!inFollowup && (mode === 'transcribing' || mode === 'listening' || mode === 'paused' || mode === 'captured') && (
        <section className="live-transcription-card">
          <div>
            <h3>{t('liveTranscription')}</h3>
            <button type="button" aria-label={t('collapseTranscription')}><ChevronUp size={18} /></button>
          </div>
          <p>{transcript || (mode === 'captured' ? t('readyToSend') : t('recordingAudio'))}</p>
          {error && <p className="review-error-message">{error}</p>}
        </section>
      )}
      {inFollowup && (
        <section className="chat-history">
          {/* Stays visible across the whole follow-up conversation --
              gated on inFollowup, NOT on mode, so it survives mode
              switching back to 'listening' when we auto-record the
              spoken answer. Previously this was `mode === 'clarification'`,
              which made the whole section (including the question that
              was just asked) disappear the instant recording resumed. */}
          {history.map((entry, index) => (
            <p key={index} className={`chat-bubble ${entry.role}`}>
              {entry.text}
            </p>
          ))}
          {error && <p className="review-error-message">{error}</p>}

          {showQuickEdit ? (
            <QuickEditForm
              item={currentItem}
              onCancel={onCloseQuickEdit}
              onApply={onApplyQuickEdit}
              disabled={isAnswering}
            />
          ) : (
            <form className="followup-form" onSubmit={onAnswerSubmit}>
              <input
                value={answerText}
                onChange={(event) => onAnswerChange(event.target.value)}
                placeholder={t('followupPlaceholder')}
                disabled={isAnswering}
              />
              {mode === 'clarification' && (
                <>
                  <button
                    type="button"
                    className="followup-mic-button"
                    aria-label={t('answerByVoice')}
                    onClick={onRecordAnswer}
                    disabled={isAnswering}
                  >
                    <AudioLines size={18} />
                  </button>
                  {/* Not the same as answering the question above -- this
                      lets the seller fix something ELSE about the current
                      item (e.g. the item name) while a different field
                      (e.g. price) is what's actually being asked about. */}
                  <button
                    type="button"
                    className="followup-edit-button"
                    aria-label={t('correctSomethingElse')}
                    onClick={onOpenQuickEdit}
                    disabled={isAnswering}
                  >
                    <Pencil size={16} />
                  </button>
                  {/* Adding another item no longer waits for this item to
                      finish -- "milk tea" doesn't need to be fully answered
                      before "also matcha" can be said. Both go through the
                      same merge-and-resolve path either way. */}
                  <button
                    type="button"
                    className="followup-add-item-button"
                    aria-label={t('addAnotherItem')}
                    onClick={onContinueRecording}
                    disabled={isAnswering}
                  >
                    <Plus size={16} />
                  </button>
                  {/* Not the same as completing the sale -- this exits the
                      clarification loop early, on the seller's own call,
                      straight to review. Any field still blank gets fixed
                      there instead of here. */}
                  <button
                    type="button"
                    className="followup-finish-button"
                    aria-label={t('finishForNow')}
                    onClick={onFinishAndReview}
                    disabled={isAnswering}
                  >
                    <Check size={16} />
                  </button>
                </>
              )}
              <button className="primary-action" type="submit" disabled={isAnswering || !answerText.trim()}>
                {isAnswering ? t('sendingAnswer') : t('sendAnswer')}
              </button>
            </form>
          )}
        </section>
      )}
      <section className="voice-control-drawer">
        <div className="voice-timer">{elapsed}</div>
        <Waveform active={isRecording} />
        <div className="voice-primary-actions">
          <button type="button" aria-label={mode === 'paused' ? t('resumeRecording') : t('pauseRecording')} onClick={onPause} disabled={mode === 'captured' || mode === 'transcribing'}>
            {mode === 'paused' ? <Play size={22} fill="currentColor" /> : <Pause size={22} fill="currentColor" />}
          </button>
          <button className="stop" type="button" aria-label={t('stopRecording')} onClick={onStop} disabled={mode === 'captured' || mode === 'transcribing'}>
            <Square size={20} fill="currentColor" />
          </button>
        </div>
        <div className="voice-secondary-actions">
          <button type="button" aria-label={t('rerecord')} onClick={onRestart} disabled={mode === 'transcribing' || isAnswering}>
            <RotateCcw size={24} />
          </button>
          <button className="send" type="button" aria-label={t('sendRecording')} onClick={onSend} disabled={mode !== 'captured'}>
            <Send size={20} fill="currentColor" />
          </button>
        </div>
      </section>
    </section>
  );
}

function QuickEditForm({ item, onCancel, onApply, disabled }) {
  const { t } = useLanguage();
  const [itemName, setItemName] = useLocalState(item?.item || '');
  const [quantity, setQuantity] = useLocalState(item?.quantity ?? '');
  const [price, setPrice] = useLocalState(item?.price ?? '');

  const handleSubmit = (event) => {
    event.preventDefault();
    onApply({
      item: itemName.trim() || null,
      quantity: quantity === '' ? null : Number(quantity),
      price: price === '' ? null : Number(price),
    });
  };

  return (
    <form className="quick-edit-form" onSubmit={handleSubmit}>
      <div className="quick-edit-header">
        <span>{t('correctThisItem')}</span>
        <button type="button" className="plain-icon-button" onClick={onCancel} aria-label={t('close')}>
          <X size={16} />
        </button>
      </div>
      <input
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder={t('product')}
        disabled={disabled}
      />
      <div className="quick-edit-row">
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder={t('qty')}
          disabled={disabled}
        />
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={t('unitPrice')}
          disabled={disabled}
        />
      </div>
      <button className="primary-action" type="submit" disabled={disabled}>
        {t('applyCorrection')}
      </button>
    </form>
  );
}

function AssistantAvatar() {
  return (
    <div className="assistant-avatar-halo">
      <div className="assistant-avatar-inner">
        <div className="assistant-head">
          <div className="assistant-face">
            <span />
            <b />
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}