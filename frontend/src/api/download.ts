const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = localStorage.getItem("transitops_token");
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
