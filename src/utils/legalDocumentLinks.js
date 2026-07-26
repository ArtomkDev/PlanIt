import { getLegalDocument } from "../config/legalDocuments.generated";

export const getLegalDocumentLocale = (lang) => (
  String(lang || "en").toLowerCase().startsWith("uk") ? "uk" : "en"
);

export const getLegalDocumentBrowserUrl = (documentType, lang) => {
  const document = getLegalDocument(documentType);
  const locale = getLegalDocumentLocale(lang);

  return document.browserUrls?.[locale] || document.browserUrls?.en;
};
