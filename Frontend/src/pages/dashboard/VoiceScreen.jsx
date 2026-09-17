import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Keyboard,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Mic,
  AlertCircle
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import MobileAppShell from '../../components/dashboard/MobileAppShell';
import TransactionSavedView from '../../components/dashboard/TransactionSavedView';
import Waveform from '../../components/dashboard/Waveform';
import { useLanguage } from '../../context/LanguageContext';
import { createSale } from '../../services/transactionService';
import {
  answerSaleFollowup,
  answerSaleFollowupAudio,
  resolveSaleRecord,
  transcribeSaleAudio,
} from '../../services/aiService';
import { formatCurrencyTotals, formatCurrencyValue, getPreferredCurrency, setPreferredCurrency } from '../../utils/currency';
import { normalizeReviewItem, resolveCurrency, resolveSaleDate, resolveUnitPrice, saleToPayload } from '../../utils/sales';
import './VoiceScreen.css';

const DRAFT_KEY = 'kc_add_sale_draft';
const emptyManualItem = { description: '', quantity: '0', unit_price: '', currency: getPreferredCurrency() || 'KHR' };

const extractErrorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((entry) => {
      const path = Array.isArray(entry?.loc) ? entry.loc.join('.') : '';
      return path ? `${path}: ${entry.msg}` : entry?.msg;
    }).filter(Boolean).join('; ');
  }
  return err?.message || fallback;
};

const formatElapsed = (seconds) => {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
};

const normalizeNumberInput = (value, { integer = false } = {}) => {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '');
  const [wholeRaw, ...rest] = cleaned.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || (cleaned.startsWith('0') ? '0' : '');
  if (!rest.length || integer) return whole;
  return `${whole || '0'}.${rest.join('')}`;
};

const parsePositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const voiceItemToDraftItem = (item, index) => normalizeReviewItem({
  id: `voice-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
  description: item.description || item.product || item.item || '',
  quantity: item.quantity ?? 1,
  unit_price: item.unit_price ?? item.price ?? 0,
  currency: item.currency || 'KHR',
  price_basis: item.price_basis || 'unit',
}, index);

// Same product (+ currency) added twice (e.g. "Coca-Cola" said again in a
// follow-up, or added manually a second time) should add up into one draft
// row rather than listing it twice.
const draftItemMatchKey = (item) =>
  `${String(item.description || item.product || '').trim().toLowerCase()}__${resolveCurrency(item)}`;

const mergeDraftItems = (items) => {
  const merged = new Map();
  items.forEach((item) => {
    const key = draftItemMatchKey(item);
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + Number(item.quantity || 0);
    } else {
      merged.set(key, { ...item });
    }
  });
  return Array.from(merged.values());
};

export default function VoiceScreen() {
  const location = useLocation();
  const { language, t } = useLanguage();
  const isKm = language !== 'en';

  const [inputMode, setInputMode] = useState(location.state?.entryMode || 'manual');
  const [saleDate, setSaleDate] = useState(() => resolveSaleDate(location.state?.saleDraft?.sale_date));
  const [draftItems, setDraftItems] = useState(() => {
    const incoming = location.state?.saleDraft?.items;
    if (Array.isArray(incoming) && incoming.length) return incoming.map(normalizeReviewItem);
    try {
      const stored = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      return Array.isArray(stored?.items) ? stored.items.map(normalizeReviewItem) : [];
    } catch {
      return [];
    }
  });

  const [manualItem, setManualItem] = useState(emptyManualItem);
  const [manualErrors, setManualErrors] = useState({});
  const [viewMode, setViewMode] = useState('entry');
  const [saving, setSaving] = useState(false);
  const [savedSaleId, setSavedSaleId] = useState(null);
  const [error, setError] = useState('');

  // Voice recording states
  const [recordingMode, setRecordingMode] = useState('idle');
  const [recordingPurpose, setRecordingPurpose] = useState('sale');
  const [audioBlob, setAudioBlob] = useState(null);
  const [mimeType, setMimeType] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [voiceResult, setVoiceResult] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [history, setHistory] = useState([]);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ sale_date: saleDate, items: draftItems }));
  }, [saleDate, draftItems]);

  useEffect(() => {
    if (recordingMode !== 'recording') return undefined;
    const timer = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recordingMode]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const totals = useMemo(() => {
    const original = draftItems.reduce((sum, item) => {
      const currency = resolveCurrency(item);
      sum[currency] += Number(item.quantity || 0) * resolveUnitPrice(item);
      return sum;
    }, { KHR: 0, USD: 0 });
    return formatCurrencyTotals({ khr: original.KHR, usd: original.USD });
  }, [draftItems]);

  // Handle direct inline typing updates in the draft table
  const handleInlineItemChange = (id, field, value) => {
    setDraftItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        let nextValue = value;
        if (field === 'quantity') {
          nextValue = normalizeNumberInput(value);
        } else if (field === 'unit_price') {
          nextValue = normalizeNumberInput(value);
        }

        const updated = {
          ...item,
          [field]: nextValue,
          ...(field === 'description' ? { product: nextValue } : {}),
        };
        return updated;
      })
    );
  };

  const validateManualItem = () => {
    const next = {};
    const quantity = parsePositiveNumber(manualItem.quantity);
    const price = parsePositiveNumber(manualItem.unit_price);
    if (!manualItem.description.trim()) next.description = t('fieldRequired') || 'Required';
    if (!Number.isFinite(quantity) || quantity <= 0) next.quantity = t('quantityGreaterZero') || 'Must be > 0';
    if (!Number.isFinite(price) || price < 0 || manualItem.unit_price === '') next.unit_price = t('validPriceRequired') || 'Invalid price';
    setManualErrors(next);
    return { valid: !Object.keys(next).length, quantity, price };
  };

  const addManualItem = (event) => {
    event.preventDefault();
    const result = validateManualItem();
    if (!result.valid) return;
    const item = normalizeReviewItem({
      id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      description: manualItem.description.trim(),
      product: manualItem.description.trim(),
      quantity: result.quantity,
      unit_price: result.price,
      currency: manualItem.currency,
      price_basis: 'unit',
    });
    setPreferredCurrency(manualItem.currency);
    setDraftItems((current) => mergeDraftItems([...current, item]));
    setManualItem({ ...emptyManualItem, currency: manualItem.currency });
    setError('');
  };

  const updateManualField = (name, value) => {
    const nextValue = name === 'quantity'
      ? normalizeNumberInput(value, { integer: false })
      : name === 'unit_price'
        ? normalizeNumberInput(value)
        : value;
    setManualItem((current) => ({ ...current, [name]: nextValue }));
    setManualErrors((current) => ({ ...current, [name]: '' }));
  };

  const resetRecording = () => {
    setAudioBlob(null);
    setMimeType('');
    setElapsed(0);
  };

  const appendHistory = (role, text) => {
    if (text) setHistory((current) => [...current, { role, text }]);
  };

  const startRecording = async (purpose = 'sale') => {
    setInputMode('voice');
    setError('');
    setAnswerText('');
    setRecordingPurpose(purpose);
    resetRecording();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      setMimeType(recorder.mimeType || preferredType || 'audio/webm');
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      setRecordingMode('recording');
    } catch {
      setRecordingMode('idle');
      setError(t('micRequired') || 'Microphone access required');
    }
  };

  const pauseRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      setRecordingMode('paused');
    } else if (recorder.state === 'paused') {
      recorder.resume();
      setRecordingMode('recording');
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
    setRecordingMode('captured');
  };

  const restartRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    startRecording(recordingPurpose);
  };

  // Safely appends newly detected items without purging previously saved items,
  // merging quantities when a product (+ currency) is already in the draft.
  const mergeVoiceRecordIntoDraft = (record) => {
    const incomingItems = (record?.items || []).map(voiceItemToDraftItem);
    setDraftItems((current) => mergeDraftItems([...current, ...incomingItems]));
  };

  const handleVoiceResult = (result) => {
    setVoiceResult(result);
    setTranscript(result.transcript || transcript);
    resetRecording();
    if (result.transcript) appendHistory('user', result.transcript);
    if (result.status === 'needs_followup' && result.question) {
      appendHistory('assistant', result.question);
      setRecordingMode('clarification');
      return;
    }
    if (result.record) {
      mergeVoiceRecordIntoDraft(result.record);
      setRecordingMode('idle');
      setViewMode('entry');
      return;
    }
    setRecordingMode('idle');
    setError(t('noSaleExtracted') || 'No sale detected from voice.');
  };

  const sendRecording = async () => {
    if (!audioBlob) {
      setError(t('recordBeforeSend') || 'Please record audio before sending');
      return;
    }
    setRecordingMode('processing');
    setError('');
    try {
      if (recordingPurpose === 'followup' && voiceResult) {
        const response = await answerSaleFollowupAudio({
          audioBlob,
          mimeType,
          transcript: voiceResult.transcript || transcript,
          record: voiceResult.record,
          attempts: voiceResult.attempts || 0,
          asked_index: voiceResult.asked_index || 0,
          asked_field: voiceResult.asked_field || 'item',
          asked_question: voiceResult.question || '',
        });
        handleVoiceResult(response.data);
      } else if (recordingPurpose === 'continue' && voiceResult?.record) {
        const fresh = await transcribeSaleAudio({ audioBlob, mimeType });
        const mergedRecord = {
          ...voiceResult.record,
          items: [...(voiceResult.record.items || []), ...(fresh.data.record?.items || [])],
          date: voiceResult.record.date || fresh.data.record?.date,
        };
        const resolved = await resolveSaleRecord({
          transcript: `${voiceResult.transcript || transcript} ${fresh.data.transcript || ''}`.trim(),
          record: mergedRecord,
          attempts: 0,
          default_method: mergedRecord.payment_method,
        });
        handleVoiceResult(resolved.data);
      } else {
        const response = await transcribeSaleAudio({ audioBlob, mimeType });
        handleVoiceResult(response.data);
      }
    } catch (err) {
      setError(extractErrorMessage(err, t('unableTranscribe') || 'Unable to process voice'));
      setRecordingMode('captured');
    }
  };

  const submitFollowup = async (event) => {
    event.preventDefault();
    if (!answerText.trim() || !voiceResult) return;
    setIsAnswering(true);
    setError('');
    appendHistory('user', answerText.trim());
    try {
      const response = await answerSaleFollowup({
        transcript: voiceResult.transcript || transcript,
        record: voiceResult.record,
        answer_text: answerText.trim(),
        attempts: voiceResult.attempts || 0,
        asked_index: voiceResult.asked_index || 0,
        asked_field: voiceResult.asked_field || 'item',
        asked_question: voiceResult.question || '',
      });
      setAnswerText('');
      handleVoiceResult(response.data);
    } catch (err) {
      setError(extractErrorMessage(err, t('unableTranscribe')));
      setRecordingMode('clarification');
    } finally {
      setIsAnswering(false);
    }
  };

  const deleteItem = (id) => {
    setDraftItems((current) => current.filter((item) => item.id !== id));
  };

  const validateDraft = () => {
    if (!draftItems.length) return t('addOneItem') || 'Add at least one item';
    const invalid = draftItems.some((item) => {
      const quantity = Number(item.quantity);
      const price = resolveUnitPrice(item);
      return !String(item.description || item.product || '').trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0;
    });
    return invalid ? (t('missingSaleDetails') || 'Missing item details') : '';
  };

  const persistSaleLocally = (payload) => {
    const currentStored = JSON.parse(localStorage.getItem('kotchomnol_sales') || '[]');
    const localId = 'sale_' + Date.now();
    currentStored.unshift({
      ...payload,
      saleId: localId,
      createdAt: new Date().toISOString(),
      pendingSync: true,
    });
    localStorage.setItem('kotchomnol_sales', JSON.stringify(currentStored));
    return localId;
  };

  const confirmAndSave = async () => {
    if (saving) return;
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    const payload = saleToPayload(saleDate, draftItems);
    try {
      const response = await createSale(payload);
      setSavedSaleId(response.data?.sale_id || response.data?.saleId || null);
      sessionStorage.removeItem(DRAFT_KEY);
      setViewMode('saved');
    } catch (err) {
      if (err?.response) {
        // The server reached us and rejected the sale (validation, auth, etc.) — surface the
        // real reason instead of silently pretending it saved, so the user can fix and retry.
        setError(extractErrorMessage(err, t('unableSaveSale') || 'Unable to save sale. Please try again.'));
      } else {
        // No response reached us at all (offline/network failure) — keep the sale so it
        // isn't lost, but mark it pending so it's clear it hasn't synced yet.
        const localId = persistSaleLocally(payload);
        sessionStorage.removeItem(DRAFT_KEY);
        setSavedSaleId(localId);
        setViewMode('saved');
      }
    } finally {
      setSaving(false);
    }
  };

  if (viewMode === 'saved') {
    return (
      <MobileAppShell activeTab="add" showBottomNav={false}>
        <TransactionSavedView
          savedSaleId={savedSaleId}
          onNewSale={() => {
            setDraftItems([]);
            setVoiceResult(null);
            setTranscript('');
            setHistory([]);
            setSavedSaleId(null);
            setViewMode('entry');
          }}
        />
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell activeTab="add">
      <div className="add-sale-wrapper font-kantomruy">
        {/* Header Title */}
        <div className="add-sale-header">
          <h1>
            <span className="add-sale-title-icon-badge">
              <Mic size={18} />
            </span>
            {isKm ? 'បន្ថែមការលក់ថ្មី' : 'Add New Sale'}
          </h1>
          <p>{isKm ? 'កត់ត្រាការលក់តាមរយៈសំឡេង ឬបញ្ចូលដោយដៃ' : 'Record sale items via voice recognition or enter them manually.'}</p>
        </div>

        {/* Mode Selector Toggle */}
        <div className="mode-toggle-grid">
          <button
            type="button"
            className={`mode-btn ${inputMode === 'manual' ? 'active' : ''}`}
            onClick={() => { setInputMode('manual'); setError(''); }}
          >
            <div className="mode-btn-icon"><Keyboard size={20} /></div>
            <div>
              <div className="mode-btn-title">{isKm ? 'បញ្ចូលដោយដៃ' : 'Manual Entry'}</div>
              <div className="mode-btn-sub">{isKm ? 'វាយបញ្ចូលព័ត៌មានទំនិញនិងតម្លៃដោយខ្លួនឯង' : 'Type items and prices manually'}</div>
            </div>
          </button>

          <button
            type="button"
            className={`mode-btn ${inputMode === 'voice' ? 'active' : ''}`}
            onClick={() => { setInputMode('voice'); setError(''); }}
          >
            <div className="mode-btn-icon voice"><Mic size={20} /></div>
            <div>
              <div className="mode-btn-title">{isKm ? 'ថតការលក់' : 'Voice Entry'}</div>
              <div className="mode-btn-sub">{isKm ? 'និយាយដើម្បីកត់ត្រាការលក់ដោយស្វ័យប្រវត្តិ' : 'Speak to record sales automatically'}</div>
            </div>
          </button>
        </div>

        {error && (
          <div className="sale-error-banner">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* 2-Column Responsive Workspace */}
        <div className="entry-content-grid">
          {/* LEFT: Manual Form OR Interactive Voice Studio */}
          {inputMode === 'manual' ? (
            <div className="entry-card">
              <h3 className="card-section-title">{isKm ? 'ព័ត៌មានទំនិញ' : 'Item Information'}</h3>

              <form className="manual-form" onSubmit={addManualItem} noValidate>
                <div className="form-group">
                  <label>{isKm ? 'កាលបរិច្ឆេទ' : 'Date'}</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>{isKm ? 'ផលិតផល' : 'Product'}</label>
                    <input
                      type="text"
                      placeholder={isKm ? 'ឈ្មោះទំនិញ (ឧ. កាហ្វេ)' : 'Product name (e.g. Coffee)'}
                      value={manualItem.description}
                      onChange={(e) => updateManualField('description', e.target.value)}
                    />
                    {manualErrors.description && <small className="field-error">{manualErrors.description}</small>}
                  </div>

                  <div className="form-group">
                    <label>{isKm ? 'ចំនួន' : 'Quantity'}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="1"
                      value={manualItem.quantity}
                      onChange={(e) => updateManualField('quantity', e.target.value)}
                    />
                    {manualErrors.quantity && <small className="field-error">{manualErrors.quantity}</small>}
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>{isKm ? 'រូបិយប័ណ្ណ' : 'Currency'}</label>
                    <div className="currency-selector">
                      <button
                        type="button"
                        className={`currency-pill ${manualItem.currency === 'KHR' ? 'active' : ''}`}
                        onClick={() => updateManualField('currency', 'KHR')}
                      >
                        KHR
                      </button>
                      <button
                        type="button"
                        className={`currency-pill ${manualItem.currency === 'USD' ? 'active' : ''}`}
                        onClick={() => updateManualField('currency', 'USD')}
                      >
                        USD
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{isKm ? `តម្លៃឯកតា (${manualItem.currency})` : `Unit Price (${manualItem.currency})`}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={manualItem.unit_price}
                      onChange={(e) => updateManualField('unit_price', e.target.value)}
                    />
                    {manualErrors.unit_price && <small className="field-error">{manualErrors.unit_price}</small>}
                  </div>
                </div>

                <button type="submit" className="add-to-invoice-btn">
                  <Plus size={16} />
                  <span>{isKm ? 'បន្ថែមទៅវិក្កយបត្រ' : 'Add to Invoice'}</span>
                </button>
              </form>
            </div>
          ) : (
            /* Advanced Voice Assistant Studio */
            <div className="voice-card">
              <div className="voice-live-badge">
                <span className={`live-dot ${recordingMode === 'recording' ? 'active' : ''}`} />
                {recordingMode === 'recording'
                  ? (isKm ? 'កំពុងថតសំឡេង...' : 'Recording live...')
                  : recordingMode === 'processing'
                  ? (isKm ? 'កំពុងដំណើរការ AI...' : 'AI Processing...')
                  : recordingMode === 'captured'
                  ? (isKm ? 'ថតបានជោគជ័យ' : 'Audio Captured')
                  : (isKm ? 'រួចរាល់សម្រាប់ថត' : 'Ready to record')}
              </div>

              <div className="voice-card-header">
                <h2>{isKm ? 'កំពុងស្តាប់សំឡេងរបស់អ្នក...' : 'AI Voice Assistant'}</h2>
                <p>{isKm ? 'សូមនិយាយទំនិញ និងចំនួន (ឧ. "កាហ្វេពីរកែវ នំបុ័ងមួយ")' : 'Speak naturally (e.g. "two coffees and one sandwich")'}</p>
              </div>

              {/* Pulsing Mic with Waveform */}
              <div className="voice-mic-container">
                <div className={`pulse-ring ${recordingMode === 'recording' ? 'pulsing' : ''}`} />
                <button
                  type="button"
                  className={`voice-mic-main ${recordingMode === 'recording' ? 'recording' : ''}`}
                  onClick={() => {
                    if (recordingMode === 'recording') stopRecording();
                    else startRecording('sale');
                  }}
                >
                  <Mic size={36} />
                </button>
              </div>

              <div className="voice-timer">{formatElapsed(elapsed)}</div>

              <div className="waveform-box">
                <Waveform active={recordingMode === 'recording' || recordingMode === 'processing'} />
              </div>

              {/* Action Controls */}
              <div className="voice-controls-row">
                {recordingMode === 'recording' && (
                  <>
                    <button type="button" className="voice-btn pause" onClick={pauseRecording}>
                      <Pause size={16} /> {isKm ? 'ផ្អាក' : 'Pause'}
                    </button>
                    <button type="button" className="voice-btn stop" onClick={stopRecording}>
                      <Square size={16} /> {isKm ? 'បញ្ឈប់' : 'Stop'}
                    </button>
                  </>
                )}

                {recordingMode === 'paused' && (
                  <>
                    <button type="button" className="voice-btn play" onClick={pauseRecording}>
                      <Play size={16} /> {isKm ? 'បន្ត' : 'Resume'}
                    </button>
                    <button type="button" className="voice-btn stop" onClick={stopRecording}>
                      <Square size={16} /> {isKm ? 'បញ្ឈប់' : 'Stop'}
                    </button>
                  </>
                )}

                {recordingMode === 'captured' && (
                  <>
                    <button type="button" className="voice-btn reset" onClick={restartRecording}>
                      <RotateCcw size={16} /> {isKm ? 'ថតសាថ្មី' : 'Reset'}
                    </button>
                    <button type="button" className="voice-btn send" onClick={sendRecording}>
                      <Send size={16} /> {isKm ? 'ដំណើរការ AI' : 'Parse AI'}
                    </button>
                  </>
                )}

                {recordingMode === 'idle' && (
                  <button type="button" className="voice-btn start" onClick={() => startRecording('sale')}>
                    <Mic size={16} /> {isKm ? 'ចាប់ផ្តើមថត' : 'Start Recording'}
                  </button>
                )}
              </div>

              {/* Chat & Follow-up History */}
              {(transcript || history.length > 0) && (
                <div className="voice-transcription-box">
                  <div className="transcription-title">{isKm ? 'អត្ថបទដែលបានស្តាប់ឮ៖' : 'Live Transcription:'}</div>
                  {history.map((entry, idx) => (
                    <div key={idx} className={`transcription-entry ${entry.role}`}>
                      <strong>{entry.role === 'user' ? (isKm ? 'អ្នក:' : 'You:') : 'AI:'}</strong> {entry.text}
                    </div>
                  ))}
                  {transcript && !history.length && (
                    <div className="transcription-entry user">{transcript}</div>
                  )}
                </div>
              )}

              {/* Clarification Follow-up Prompt Form */}
              {recordingMode === 'clarification' && (
                <form className="voice-followup-form" onSubmit={submitFollowup}>
                  <input
                    type="text"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder={voiceResult?.question || (isKm ? 'ឆ្លើយតបសំណួរនៅទីនេះ...' : 'Answer question here...')}
                    disabled={isAnswering}
                  />
                  <button type="submit" disabled={isAnswering || !answerText.trim()}>
                    <Send size={15} /> {isAnswering ? '...' : (isKm ? 'ផ្ញើ' : 'Send')}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* RIGHT: Live Draft Invoice Ledger with Direct Inline Editing */}
          <div className="entry-card draft-card">
            <div>
              <div className="draft-header">
                <span className="draft-count-pill">
                  {draftItems.length} {isKm ? 'មុខទំនិញ' : 'items'}
                </span>
              </div>

              <div className="draft-table-head">
                <span>{isKm ? 'ផលិតផល' : 'Product'}</span>
                <span className="text-center">{isKm ? 'ចំនួន' : 'Qty'}</span>
                <span className="text-center">{isKm ? 'តម្លៃ' : 'Price'}</span>
                <span className="text-right">{isKm ? 'សរុប' : 'Total'}</span>
                <span></span>
              </div>

              <div className="draft-table-body">
                {draftItems.length === 0 ? (
                  <div className="draft-empty-state">
                    {isKm ? 'មិនទាន់មានទំនិញក្នុងវិក្កយបត្រព្រាងនៅឡើយទេ។' : 'No reviewed sale items available to save.'}
                  </div>
                ) : (
                  draftItems.map((item) => {
                    const uPrice = resolveUnitPrice(item);
                    const cur = resolveCurrency(item);
                    const lineTotal = Number(item.quantity || 0) * uPrice;

                    return (
                      <div key={item.id} className="draft-table-row">
                        {/* 1. Direct Editable Product Name */}
                        <div className="cell-input-wrap">
                          <input
                            type="text"
                            className="draft-cell-input product-cell"
                            value={item.description || item.product || ''}
                            placeholder={isKm ? 'ឈ្មោះទំនិញ' : 'Item name'}
                            onChange={(e) => handleInlineItemChange(item.id, 'description', e.target.value)}
                          />
                        </div>

                        {/* 2. Direct Editable Quantity */}
                        <div className="cell-input-wrap text-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="draft-cell-input qty-cell"
                            value={item.quantity ?? ''}
                            placeholder="1"
                            onChange={(e) => handleInlineItemChange(item.id, 'quantity', e.target.value)}
                          />
                        </div>

                        {/* 3. Direct Editable Unit Price */}
                        <div className="cell-input-wrap text-center price-wrap">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="draft-cell-input price-cell"
                            value={item.unit_price ?? ''}
                            placeholder="0"
                            onChange={(e) => handleInlineItemChange(item.id, 'unit_price', e.target.value)}
                          />
                          <span className="cell-currency-suffix">{cur}</span>
                        </div>

                        {/* 4. Auto-calculated Total */}
                        <span className="text-right item-total">
                          {formatCurrencyValue(lineTotal, cur)}
                        </span>

                        {/* 5. Delete Button */}
                        <button
                          type="button"
                          className="draft-delete-btn"
                          title={isKm ? 'លុប' : 'Delete item'}
                          onClick={() => deleteItem(item.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Total Balance & Save Confirm */}
            <div className="draft-footer">
              <div className="draft-totals-box">
                <div className="totals-row">
                  <span>{isKm ? 'សរុប (USD)' : 'Total (USD)'}</span>
                  <strong>{totals.usdLabel}</strong>
                </div>
                <div className="totals-row">
                  <span>{isKm ? 'សរុប (KHR)' : 'Total (KHR)'}</span>
                  <strong className="khr-total">{totals.khrLabel}</strong>
                </div>
              </div>

              <button
                type="button"
                className="confirm-sale-btn"
                disabled={draftItems.length === 0 || saving}
                onClick={confirmAndSave}
              >
                <Check size={18} />
                <span>{saving ? (isKm ? 'កំពុងរក្សាទុក...' : 'Saving...') : (isKm ? 'បញ្ជាក់ និងរក្សាទុក' : 'Confirm & Save Sale')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </MobileAppShell>
  );
}
