import { useEffect } from 'react';

export default function TelegramLoginButton({ onAuth, onError }) {
  useEffect(() => {
    const clientId = Number(import.meta.env.VITE_TELEGRAM_BOT_ID);

    console.log('Telegram Client ID:', clientId);

    if (!clientId) {
      onError?.('Telegram Client ID is missing.');
      return;
    }

    const loadTelegram = () => {
      if (!window.Telegram?.Login) {
        console.error('Telegram Login SDK not available');
        onError?.('Telegram Login SDK failed to load.');
        return;
      }

      console.log('Telegram Login SDK ready');

      window.Telegram.Login.init(
        {
          client_id: clientId,
          scope: ['profile'],
          lang: 'en',
        },
        (data) => {
          console.log('Telegram auth response:', data);

          if (data?.id_token) {
            onAuth({
              id_token: data.id_token
            });
          } else {
            onError?.(
              data?.error || 'Telegram login was not completed.'
            );
          }
        }
      );

      const button = document.createElement('button');

      button.type = 'button';
      button.textContent = 'Log in with Telegram';

      button.style.width = '100%';
      button.style.height = '48px';
      button.style.border = 'none';
      button.style.borderRadius = '10px';
      button.style.background = '#229ED9';
      button.style.color = 'white';
      button.style.fontSize = '16px';
      button.style.fontWeight = '600';
      button.style.cursor = 'pointer';

      button.onclick = () => {
        window.Telegram.Login.open();
      };

      const container = document.getElementById(
        'telegram-login-button'
      );

      if (container) {
        container.innerHTML = '';
        container.appendChild(button);
      }
    };

    if (window.Telegram?.Login) {
      loadTelegram();
      return;
    }

    const script = document.createElement('script');

    script.src = 'https://oauth.telegram.org/js/telegram-login.js?6';
    script.async = true;

    script.onload = loadTelegram;

    script.onerror = () => {
      console.error('Could not load Telegram Login SDK');
      onError?.('Could not load Telegram Login SDK.');
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <div
      id="telegram-login-button"
      style={{
        width: '100%',
        marginTop: '12px',
        marginBottom: '12px'
      }}
    />
  );
}