import { describe, expect, it } from "vitest";
import { isDriveTextExtractable } from "./googleDriveIngestion";

describe("Google Drive text extraction", () => {
  it("extracts native Google workspace documents", () => {
    expect(isDriveTextExtractable({ mimeType: "application/vnd.google-apps.document" })).toBe(true);
    expect(isDriveTextExtractable({ mimeType: "application/vnd.google-apps.spreadsheet" })).toBe(true);
    expect(isDriveTextExtractable({ mimeType: "application/vnd.google-apps.presentation" })).toBe(true);
  });

  it("extracts bounded text files and excludes binary files", () => {
    expect(isDriveTextExtractable({ mimeType: "text/markdown", size: "1200" })).toBe(true);
    expect(isDriveTextExtractable({ mimeType: "application/json", size: "4000" })).toBe(true);
    expect(isDriveTextExtractable({ mimeType: "application/pdf", size: "4000" })).toBe(false);
    expect(isDriveTextExtractable({ mimeType: "text/plain", size: "6000000" })).toBe(false);
  });
});
