import { Undo2, Download, Pencil, FolderOpen, Ellipsis, Moon, Sun } from "lucide-react";
import { createPortal } from "react-dom";
import type { Summary } from "../../types";

type Props = {
  summary: Summary;
  shoppingCount: number;
  undoStack: Array<{ description: string }>;
  performUndo: () => void;
  editMode: boolean;
  toggleEditMode: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  downloadJSON: () => void;
  loadDbFromFile: () => void;
  topMenuOpen: boolean;
  topMenuPos: { top: number; left: number };
  setTopMenuPos: (v: { top: number; left: number }) => void;
  setTopMenuOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  topMenuRef: React.RefObject<HTMLButtonElement>;
};

import { computeMenuPosition } from "../../utils/menuPosition";

export function Topbar({
  summary,
  shoppingCount,
  undoStack,
  performUndo,
  editMode,
  toggleEditMode,
  isDark,
  toggleTheme,
  downloadJSON,
  loadDbFromFile,
  topMenuOpen,
  topMenuPos,
  setTopMenuPos,
  setTopMenuOpen,
  topMenuRef,
}: Props) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img src="/logo.svg" alt="" className="topbar-logo" />
        <div>
          <p className="eyebrow">Home ERP</p>
          <h1>Shoplist</h1>
        </div>
      </div>
      <div className="status-strip">
        <span>
          <strong>{summary.total}</strong> entries
        </span>
        <span>
          <strong>{summary.withQuantity}</strong> with quantity
        </span>
        <span>
          <strong>{shoppingCount}</strong> in list
        </span>
      </div>
      <div className="topbar-actions">
        <button
          className="ghost"
          onClick={performUndo}
          disabled={undoStack.length === 0}
          title={
            undoStack.length > 0
              ? `Undo: ${undoStack[undoStack.length - 1].description}`
              : "Nothing to undo"
          }
        >
          <Undo2 size={16} />
        </button>
        <div className="dropdown">
          <button
            ref={topMenuRef}
            className={"dropdown-btn" + (topMenuOpen ? " active" : "")}
            onClick={() => {
              if (topMenuRef.current) {
                const r = topMenuRef.current.getBoundingClientRect();
                setTopMenuPos(computeMenuPosition(r, 200, 240));
              }
              setTopMenuOpen((p) => !p);
            }}
          >
            <Ellipsis size={16} />
          </button>
          {topMenuOpen &&
            createPortal(
              <div
                className="dropdown-menu"
                style={{ position: "fixed", top: topMenuPos.top, left: topMenuPos.left }}
              >
                <button
                  className="dropdown-item"
                  onClick={() => {
                    downloadJSON();
                    setTopMenuOpen(false);
                  }}
                >
                  <Download size={16} /> Export database
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    loadDbFromFile();
                    setTopMenuOpen(false);
                  }}
                >
                  <FolderOpen size={16} /> Import database
                </button>
                <div className="dropdown-sep" />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    toggleEditMode();
                    setTopMenuOpen(false);
                  }}
                >
                  <Pencil size={16} /> Edit mode
                  <span className={"toggle-switch" + (editMode ? " active" : "")} />
                </button>
                <div className="dropdown-sep" />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    toggleTheme();
                    setTopMenuOpen(false);
                  }}
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  {isDark ? " Light mode" : " Dark mode"}
                </button>
              </div>,
              document.body,
            )}
        </div>
      </div>
    </header>
  );
}
