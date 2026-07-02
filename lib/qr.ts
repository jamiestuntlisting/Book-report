import QRCode from "qrcode";

// Renders a URL to a QR code as a data URI (PNG). Used in the book/PDF to make
// links scannable from the printed page.
export async function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
    color: { dark: "#0f0f0f", light: "#ffffff" },
  });
}
