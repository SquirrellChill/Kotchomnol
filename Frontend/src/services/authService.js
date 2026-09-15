import { AUTH_BOOTSTRAP_TIMEOUT_MS, nodeApi } from './api';

export const register = ({ firstName, lastName, phoneNumber, email, password }) =>
  nodeApi.post('/auth/register', {
    first_name: firstName,
    last_name: lastName,
    phone_number: phoneNumber,
    email,
    password,
  });

export const login = ({ email, password }) =>
  nodeApi.post('/auth/login', { email, password });

export const logout = () => nodeApi.post('/auth/logout');

export const getMe = () =>
  nodeApi.get('/auth/me', { timeout: AUTH_BOOTSTRAP_TIMEOUT_MS });

export const updateMe = (data) => {
  const firstName = data.firstName ?? data.first_name;
  const lastName = data.lastName ?? data.last_name;
  const phoneNumber = data.phoneNumber ?? data.phone_number;
  const profilePicture = data.profilePicture ?? data.profile_picture;

  return nodeApi.put('/auth/me', {
    first_name: firstName,
    last_name: lastName,
    phone_number: phoneNumber,
    email: data.email || null,
    profile_picture: profilePicture ?? null,
  });
};

export const uploadAvatar = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return nodeApi.post('/auth/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const changePassword = ({ currentPassword, newPassword }) =>
  nodeApi.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });

export const verifyEmail = ({ email, code }) =>
  nodeApi.post('/auth/verify-email', { email, code });

export const resendVerification = ({ email }) =>
  nodeApi.post('/auth/resend-verification', { email });

export const forgotPassword = ({ email }) =>
  nodeApi.post('/auth/forgot-password', { email });

export const resetPassword = ({ token, password }) =>
  nodeApi.post('/auth/reset-password', { token, password });

export const getErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((entry) => entry?.msg || entry?.message).filter(Boolean).join(' ');
  }
  return error?.message || 'Something went wrong. Please try again.';
};
