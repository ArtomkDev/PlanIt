import wordmark from "../../assets/branding/document-wordmark.json";

export const DOCUMENT_BRAND_NAME = wordmark.text;

export const getDocumentBranding = (useColor = true) => {
  const base64 = useColor ? wordmark.accent : wordmark.mono;
  return {
    name: wordmark.text,
    color: useColor ? wordmark.accentColor : "000000",
    base64,
    image: `data:image/png;base64,${base64}`,
    width: 44,
    height: 44 * wordmark.height / wordmark.width,
  };
};
