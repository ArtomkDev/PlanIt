import { getLegalDocument } from "../config/legalDocuments.generated";
import { WEBSITE_URL } from "../config/website.cjs";

import { normalizeLanguage } from "./i18n";

export const getLegalDocumentLocale = normalizeLanguage;

export const getLegalDocumentBrowserUrl = (documentType, lang) => {
  const document = getLegalDocument(documentType);
  const locale = getLegalDocumentLocale(lang);

  return `${WEBSITE_URL}/${locale}/wiki/${document.slug}`;
};
