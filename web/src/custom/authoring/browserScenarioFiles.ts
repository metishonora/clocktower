export function downloadScenarioFile(json: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  try {
    link.href = url; link.download = filename;
    document.body.append(link); link.click();
  } finally {
    link.remove();
    // Retain until the browser has consumed the click's download request.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
