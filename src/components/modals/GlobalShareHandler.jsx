import React, { useState, useEffect } from "react";
import * as Linking from "expo-linking";
import ImportScheduleModal from "./ImportScheduleModal";

export default function GlobalShareHandler() {
  const url = Linking.useURL();
  const [modalVisible, setModalVisible] = useState(false);
  const [importCode, setImportCode] = useState("");

  useEffect(() => {
    if (url) {
      let code = null;
      
      if (url.includes("share/")) {
        const parts = url.split("share/");
        code = parts[1]?.split("?")[0]?.replace("/", "");
      }

      if (code && code.length >= 5) {
        setImportCode(code.toUpperCase());
        setModalVisible(true);
      }
    }
  }, [url]);

  const handleClose = () => {
    setModalVisible(false);
    setTimeout(() => setImportCode(""), 500); 
  };

  return (
    <ImportScheduleModal
      visible={modalVisible}
      onClose={handleClose}
      initialCode={importCode}
    />
  );
}