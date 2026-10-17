import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { scheduleExportToHtml } from "../utils/scheduleExport";
import { shareLocalFile } from "./fileSharingService";

export const exportSchedulePdf = async (document, fileName) => {
  if (!(await Sharing.isAvailableAsync())) throw new Error("sharing_unavailable");
  const { settings } = document;
  const result = await Print.printToFileAsync({
    html: scheduleExportToHtml(document), width: Math.round(settings.width), height: Math.round(settings.height), orientation: settings.orientation,
  });
  try {
    await shareLocalFile({ uri: result.uri, name: fileName, mimeType: "application/pdf", uti: "com.adobe.pdf" });
  } finally {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
  }
};
