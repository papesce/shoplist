import { createPortal } from "react-dom";
import { X, Search, ArchiveRestore, Plus, Download, Pencil, Trash2, History } from "lucide-react";
import type { SavedList } from "../../types";

type Props = {
  open: boolean;
  onClose: () => void;
  history: SavedList[];
  filteredHistory: SavedList[];
  historyQuery: string;
  setHistoryQuery: (v: string) => void;
  renamingId: string | null;
  renamingValue: string;
  setRenamingId: (v: string | null) => void;
  setRenamingValue: (v: string) => void;
  renameHistoryEntry: (id: string, v: string) => void;
  deleteHistoryConfirm: string | null;
  setDeleteHistoryConfirm: (v: string | null) => void;
  loadFromHistory: (id: string, mode: "replace" | "append") => void;
  downloadHistoryEntry: (id: string) => void;
  deleteHistoryEntry: (id: string) => void;
};

export function HistoryDrawer({
  open,
  onClose,
  history,
  filteredHistory,
  historyQuery,
  setHistoryQuery,
  renamingId,
  renamingValue,
  setRenamingId,
  setRenamingValue,
  renameHistoryEntry,
  setDeleteHistoryConfirm,
  loadFromHistory,
  downloadHistoryEntry,
}: Props) {
  if (!open) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="history-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <div>
            <h2 className="modal-title">
              <History size={16} style={{ verticalAlign: "middle" }} /> Purchase history
            </h2>
            <p className="history-subtitle">
              {history.length} saved list{history.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button className="ghost" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="history-search">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search history…"
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
          />
        </div>
        <div className="history-list">
          {filteredHistory.length === 0 ? (
            <div className="empty small">
              <p>
                {history.length === 0
                  ? "No saved purchases yet. Use Save to store your current list."
                  : `No results for "${historyQuery}"`}
              </p>
            </div>
          ) : (
            filteredHistory.map((h) => (
              <div key={h.id} className="history-card">
                <div className="history-card-head">
                  {renamingId === h.id ? (
                    <input
                      className="modal-input"
                      value={renamingValue}
                      onChange={(e) => setRenamingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameHistoryEntry(h.id, renamingValue);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={() => renameHistoryEntry(h.id, renamingValue)}
                      autoFocus
                    />
                  ) : (
                    <strong className="history-card-name" title={h.name}>
                      {h.name}
                    </strong>
                  )}
                  <span className="history-card-date">{new Date(h.date).toLocaleString()}</span>
                </div>
                <div className="history-card-meta">
                  {h.items.length} items
                  {h.items.filter((i) => i.checked).length > 0
                    ? ` · ${h.items.filter((i) => i.checked).length} checked`
                    : ""}
                </div>
                <div className="history-card-preview">
                  {h.items
                    .slice(0, 3)
                    .map((i) => i.original)
                    .join(" · ")}
                  {h.items.length > 3 ? ` +${h.items.length - 3} more` : ""}
                </div>
                <div className="history-card-actions">
                  <button onClick={() => loadFromHistory(h.id, "replace")}>
                    <ArchiveRestore size={14} /> Load
                  </button>
                  <button className="ghost" onClick={() => loadFromHistory(h.id, "append")}>
                    <Plus size={14} /> Append
                  </button>
                  <button className="ghost" onClick={() => downloadHistoryEntry(h.id)}>
                    <Download size={14} />
                  </button>
                  {renamingId !== h.id && (
                    <button
                      className="ghost"
                      onClick={() => {
                        setRenamingId(h.id);
                        setRenamingValue(h.name);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    className="ghost btn-danger"
                    onClick={() => setDeleteHistoryConfirm(h.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
