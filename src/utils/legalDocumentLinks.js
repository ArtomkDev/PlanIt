import { getLegalDocument } from "../config/legalDocuments.generated";

import { normalizeLanguage } from "./i18n";

export const getLegalDocumentLocale = normalizeLanguage;

export const getLegalDocumentBrowserUrl = (documentType, lang) => {
  const document = getLegalDocument(documentType);
  const locale = getLegalDocumentLocale(lang);

  return document.browserUrls?.[locale] || document.browserUrls?.en;
};
