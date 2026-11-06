import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLegalDocument } from '../config/legalDocuments.generated';
import { normalizeLanguage } from '../utils/i18n';

const KEY = 'planit_legal_acceptance_v1';
const ENTRY_LIFETIME = 24 * 60 * 60 * 1000;
const versions = () => ({ terms: getLegalDocument('terms').version, privacy: getLegalDocument('privacy').version });

const readAcceptance = async (scope) => {
  const raw = await AsyncStorage.getItem(`${KEY}:${scope}`);
  if (!raw) return null;
  let receipt;
  try { receipt = JSON.parse(raw); } catch { return null; }
  const current = versions();
  const valid = receipt?.terms === current.terms && receipt?.privacy === current.privacy
    && Number.isFinite(receipt.acceptedAt) && receipt.acceptedAt <= Date.now()
    && (scope !== 'entry' || Date.now() - receipt.acceptedAt < ENTRY_LIFETIME);
  return valid ? receipt : null;
};

export const hasLegalAcceptance = async (scope) => !!await readAcceptance(scope);

export const recordLegalAcceptance = async (lang, scope = 'entry') => {
  await AsyncStorage.setItem(`${KEY}:${scope}`, JSON.stringify({ ...versions(), acceptedAt: Date.now(), language: normalizeLanguage(lang) }));
};

export const claimEntryLegalAcceptance = async (userId) => {
  const receipt = await readAcceptance('entry');
  if (!receipt) return;
  await AsyncStorage.setItem(`${KEY}:user:${userId}`, JSON.stringify(receipt));
  await AsyncStorage.removeItem(`${KEY}:entry`);
};

export const clearLegalAcceptance = async (userId) => {
  await AsyncStorage.multiRemove([`${KEY}:user:${userId}`, `${KEY}:entry`]);
};
