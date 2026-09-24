import { t } from '../utils/i18n';

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

export const getPasswordPolicyStatus = (password = '') => {
  const value = String(password);
  const hasLowercase = /[a-z]/.test(value);
  const hasUppercase = /[A-Z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecialCharacter = /[^a-zA-Z0-9]/.test(value);
  const meetsMinLength = value.length >= MIN_PASSWORD_LENGTH;
  const meetsMaxLength = value.length <= MAX_PASSWORD_LENGTH;

  return {
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSpecialCharacter,
    meetsMinLength,
    meetsMaxLength,
    isValid:
      meetsMinLength
      && meetsMaxLength
      && hasLowercase
      && hasUppercase
      && hasNumber,
  };
};

export const isPasswordAllowed = (password) =>
  getPasswordPolicyStatus(password).isValid;

export const getPasswordPolicyMessage = (lang = 'en') => (
  t('auth.password_requirements', lang, { min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })
);

export const getPasswordStrength = (password = '') => {
  const status = getPasswordPolicyStatus(password);
  let score = 0;

  if (status.meetsMinLength) score += 2;
  if (password.length >= 14) score += 1;
  if (status.hasLowercase) score += 1;
  if (status.hasUppercase) score += 1;
  if (status.hasNumber) score += 1;
  if (status.hasSpecialCharacter) score += 1;

  if (!status.meetsMaxLength || !status.meetsMinLength || score <= 3) {
    return { width: '30%', color: '#ef4444' };
  }
  if (score <= 5) {
    return { width: '65%', color: '#f59e0b' };
  }
  return { width: '100%', color: '#10b981' };
};
