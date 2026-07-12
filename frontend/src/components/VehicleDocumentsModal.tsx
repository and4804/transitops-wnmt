import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { downloadFile } from "../api/download";
import type { Vehicle, VehicleDocument, VehicleDocumentType } from "../api/types";

const DOCUMENT_TYPES: VehicleDocumentType[] = ["Insurance", "Registration", "Permit", "PUC", "Fitness", "Other"];

export default function VehicleDocumentsModal({
  vehicle,
  canManage,
  onClose,
}: {
  vehicle: Vehicle;
  canManage: boolean;
  onClose: () => void;
}) {
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<VehicleDocumentType>("Insurance");
  const [expiryDate, setExpiryDate] = useState("");
  const [uploading, setUploading] = useState(false);

  function load() {
    api
      .get<VehicleDocument[]>(`/vehicles/${vehicle.id}/documents`)
      .then(setDocuments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load documents"));
  }

  useEffect(load, [vehicle.id]);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      if (expiryDate) formData.append("expiryDate", expiryDate);
      await api.postForm(`/vehicles/${vehicle.id}/documents`, formData);
      setFile(null);
      setExpiryDate("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: VehicleDocument) {
    try {
      await downloadFile(`/vehicles/${vehicle.id}/documents/${doc.id}/download`, doc.fileName);
    } catch {
      setError("Failed to download document");
    }
  }

  async function handleDelete(doc: VehicleDocument) {
    if (!confirm(`Delete document '${doc.fileName}'?`)) return;
    try {
      await api.delete(`/vehicles/${vehicle.id}/documents/${doc.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete document");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <h3>Documents — {vehicle.regNumber}</h3>
        {error && <div className="error-banner">{error}</div>}

        {documents.length === 0 ? (
          <div className="empty-state">No documents uploaded.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>File</th>
                <th>Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>{d.type}</td>
                  <td>{d.fileName}</td>
                  <td style={{ color: d.expired ? "var(--danger)" : d.expiringSoon ? "var(--warn)" : undefined }}>
                    {d.expiryDate ? d.expiryDate.slice(0, 10) : "—"}
                    {d.expired ? " (expired)" : d.expiringSoon ? " (expiring soon)" : ""}
                  </td>
                  <td>
                    <div className="actions-row">
                      <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(d)}>
                        Download
                      </button>
                      {canManage && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canManage && (
          <form onSubmit={handleUpload} style={{ marginTop: 16 }}>
            <div className="form-grid">
              <div className="form-field">
                <label>File</label>
                <input required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="form-field">
                <label>Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as VehicleDocumentType)}>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Expiry Date (optional)</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </div>
            <div className="actions-row">
              <button className="btn" type="submit" disabled={uploading || !file}>
                {uploading ? "Uploading…" : "Upload"}
              </button>
              <button className="btn btn-secondary" type="button" onClick={onClose}>
                Close
              </button>
            </div>
          </form>
        )}
        {!canManage && (
          <div className="actions-row" style={{ marginTop: 16 }}>
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
