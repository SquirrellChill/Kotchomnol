import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircleQuestion, Send, X, RotateCcw } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { askAssistant } from '../../services/assistantService';
import { getErrorMessage } from '../../services/authService';
import './HelpChat.css';

const STORAGE_KEY = 'kc_help_chat';
// Turns sent back to the backend as context. It trims further itself.
const HISTORY_SENT = 8;

// The recording screen has its own full-screen controls; a floating button
// there would sit on top of them.
const HIDDEN_PATHS = ['/dashboard/voice'];

const loadMessages = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
};

// Replies are plain text; turn bare URLs (e.g. the support Telegram link)
// into tappable links.
const renderText = (text) =>
  text.split(/(https?:\/\/[^\s)]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    ) : (
      part
    )
  );

export default function HelpChat() {
  const { language, t } = useLanguage();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage unavailable (private mode); the chat still works in memory.
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (HIDDEN_PATHS.includes(pathname)) return null;

  // Lift the button above the bottom tab bar on dashboard pages.
  const withTabBar = pathname.startsWith('/dashboard');

  const send = async (text) => {
    const message = text.trim();
    if (!message || loading) return;

    const history = messages
      .filter((m) => !m.error)
      .slice(-HISTORY_SENT)
      .map(({ role, text: turnText }) => ({ role, text: turnText }));

    setMessages((current) => [...current, { role: 'user', text: message }]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await askAssistant({ message, history, language });
      setMessages((current) => [...current, { role: 'assistant', text: data.reply }]);
    } catch (error) {
      const detail = error?.response ? getErrorMessage(error) : t('helpChatError');
      setMessages((current) => [...current, { role: 'assistant', text: detail, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    send(input);
  };

  const suggestions = [t('helpChatSuggestOne'), t('helpChatSuggestTwo'), t('helpChatSuggestThree')];

  return (
    <div className={`help-chat ${withTabBar ? 'with-tab-bar' : ''} ${language === 'km' ? 'font-khmer' : ''}`}>
      {open && (
        <section className="help-chat-panel" role="dialog" aria-label={t('customerSupportAssistant')}>
          <header className="help-chat-header">
            <div className="help-chat-header-icon">
              <MessageCircleQuestion size={18} />
            </div>
            <div className="help-chat-header-text">
              <h2>{t('helpChatTitle')}</h2>
              <p>{t('helpChatSubtitle')}</p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                className="help-chat-icon-btn"
                onClick={() => setMessages([])}
                aria-label={t('helpChatClear')}
                title={t('helpChatClear')}
              >
                <RotateCcw size={16} />
              </button>
            )}
            <button
              type="button"
              className="help-chat-icon-btn"
              onClick={() => setOpen(false)}
              aria-label={t('close')}
            >
              <X size={18} />
            </button>
          </header>

          <div className="help-chat-messages" ref={listRef} aria-live="polite">
            <div className="help-chat-bubble assistant">{t('helpChatGreeting')}</div>

            {messages.length === 0 && (
              <div className="help-chat-suggestions">
                {suggestions.map((question) => (
                  <button key={question} type="button" onClick={() => send(question)}>
                    {question}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, index) => (
              <div key={index} className={`help-chat-bubble ${m.role} ${m.error ? 'error' : ''}`}>
                {renderText(m.text)}
              </div>
            ))}

            {loading && (
              <div className="help-chat-bubble assistant help-chat-typing" aria-label={t('helpChatThinking')}>
                <span /><span /><span />
              </div>
            )}
          </div>

          <form className="help-chat-input" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              maxLength={1000}
              placeholder={t('helpChatPlaceholder')}
              onChange={(event) => setInput(event.target.value)}
              aria-label={t('helpChatPlaceholder')}
            />
            <button type="submit" disabled={!input.trim() || loading} aria-label={t('helpChatSend')}>
              <Send size={17} />
            </button>
          </form>
        </section>
      )}

      {!open && (
        <button
          type="button"
          className="help-chat-fab"
          onClick={() => setOpen(true)}
          aria-label={t('customerSupportAssistant')}
          title={t('customerSupportAssistant')}
        >
          <MessageCircleQuestion size={24} />
        </button>
      )}
    </div>
  );
}
