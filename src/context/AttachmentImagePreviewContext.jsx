import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import AttachmentImagePreview from "../components/attachments/AttachmentImagePreview";

const AttachmentImagePreviewContext = createContext(null);

export function AttachmentImagePreviewProvider({ children }) {
  const requestRef = useRef(null);
  const [request, setRequest] = useState(null);

  const openImagePreview = useCallback((nextRequest) => {
    if (!nextRequest?.attachment) return;

    requestRef.current = nextRequest;
    setRequest(nextRequest);
  }, []);

  const closeImagePreview = useCallback(() => {
    const currentRequest = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    currentRequest?.onClose?.();
  }, []);

  const value = useMemo(() => ({ openImagePreview }), [openImagePreview]);

  return (
    <AttachmentImagePreviewContext.Provider value={value}>
      {children}
      <AttachmentImagePreview
        visible={!!request?.attachment}
        attachment={request?.attachment || null}
        attachments={request?.attachments || []}
        onClose={closeImagePreview}
        onCacheStateChange={request?.onCacheStateChange}
        themeColors={request?.themeColors}
        lang={request?.lang}
      />
    </AttachmentImagePreviewContext.Provider>
  );
}

export function useAttachmentImagePreview() {
  const context = useContext(AttachmentImagePreviewContext);
  if (!context) {
    throw new Error("useAttachmentImagePreview must be used within AttachmentImagePreviewProvider");
  }
  return context;
}
