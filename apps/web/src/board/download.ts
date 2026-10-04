export function download(bytes: Uint8Array<ArrayBuffer>, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Safari starts the download after click() returns: the URL must outlive this call.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
