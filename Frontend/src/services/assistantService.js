import { nodeApi } from './api';

// Public endpoint: works before sign-in, so new users can ask how to register.
// The token interceptor still attaches a token when there is one; the
// backend ignores it.
export const askAssistant = ({ message, history, language }) =>
  nodeApi.post('/assistant/chat', { message, history, language }, { timeout: 45000 });
