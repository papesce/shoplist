import { createPortal } from "react-dom";
import {
  Download,
  ClipboardCopy,
  Check,
  List,
  LayoutGrid,
  FolderOpen,
  Trash2,
  Save,
} from "lucide-react";
import { ShoppingList } from "./ShoppingList";
import type { ShoppingItem } from "../../types";

type Props = {
  pending: number;
  shoppingList: ShoppingItem[];
  shoppingGrouped: [string, ShoppingItem[]][] | null;
  dragOverIndex: number | null;
  isDark: boolean;
  toggleShoppingItem: (id: string) => void;
  removeShoppingItem: (id: string) => void;
  handleDragStart: (e: React.DragEvent, idx: number) => void;
  handleDragOver: (e: React.DragEvent, idx: number) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, idx: number) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  openSaveModal: () => void;
  setHistoryOpen: (v: boolean) => void;
  historyLength: number;
  copyShoppingList: () => void;
  copied: boolean;
  groupByCategory: boolean;
  setGroupByCategory: (v: boolean) => void;
  shoppingMenuOpen: boolean;
  setShoppingMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  shoppingMenuRef: React.RefObject<HTMLButtonElement>;
  shoppingMenuPos: { top: number; left: number };
  setShoppingMenuPos: (v: { top: number; left: number }) => void;
  clearCheckedItems: () => void;
  clearAllItems: () => void;
  downloadList: () => void;
  loadListFromFile: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileLoad: () => void;
  computeMenuPosition: (r: DOMRect, w: number, h: number) => { top: number; left: number };
};

export function ShoppingPanel({
  pending,
  shoppingList,
  shoppingGrouped,
  dragOverIndex,
  isDark,
  toggleShoppingItem,
  removeShoppingItem,
  handleDragStart,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleDragEnd,
  openSaveModal,
  setHistoryOpen,
  historyLength,
  copyShoppingList,
  copied,
  groupByCategory,
  setGroupByCategory,
  shoppingMenuOpen,
  setShoppingMenuOpen,
  shoppingMenuRef,
  shoppingMenuPos,
  setShoppingMenuPos,
  clearCheckedItems,
  clearAllItems,
  downloadList,
  loadListFromFile,
  fileInputRef,
  handleFileLoad,
  computeMenuPosition,
}: Props) {
  return (
    <>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Shopping list</p>
          <h2>{pending} pending items</h2>
        </div>
        <div className="panel-header-actions">
          <button
            className="ghost"
            onClick={openSaveModal}
            disabled={shoppingList.length === 0}
            title="Save to history"
          >
            <Save size={16} /> Save
          </button>
          <button
            className="ghost"
            onClick={() => setHistoryOpen(true)}
            title={`History (${historyLength})`}
          >
            History {historyLength > 0 && <span className="history-badge">{historyLength}</span>}
          </button>
          <button className="btn-primary" onClick={copyShoppingList} disabled={pending === 0}>
            {copied ? (
              <>
                <Check size={16} /> Copied
              </>
            ) : (
              <>
                <ClipboardCopy size={16} /> Copy list
              </>
            )}
          </button>
          <div className="dropdown">
            <button
              ref={shoppingMenuRef}
              className={"dropdown-btn" + (shoppingMenuOpen ? " active" : "")}
              onClick={() => {
                if (shoppingMenuRef.current)
                  setShoppingMenuPos(
                    computeMenuPosition(shoppingMenuRef.current.getBoundingClientRect(), 220, 260),
                  );
                setShoppingMenuOpen((p) => !p);
              }}
              disabled={shoppingList.length === 0}
            >
              ⋯
            </button>
            {shoppingMenuOpen &&
              createPortal(
                <div
                  className="dropdown-menu"
                  style={{
                    position: "fixed",
                    top: shoppingMenuPos.top,
                    left: shoppingMenuPos.left,
                  }}
                >
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setGroupByCategory(!groupByCategory);
                      setShoppingMenuOpen(false);
                    }}
                  >
                    {groupByCategory ? (
                      <>
                        <List size={16} /> Free list
                      </>
                    ) : (
                      <>
                        <LayoutGrid size={16} /> Group by category
                      </>
                    )}
                  </button>
                  <div className="dropdown-sep" />
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      clearCheckedItems();
                      setShoppingMenuOpen(false);
                    }}
                    disabled={shoppingList.filter((i) => i.checked).length === 0}
                  >
                    <Trash2 size={16} /> Remove checked
                  </button>
                  <button
                    className="dropdown-item dropdown-item-danger"
                    onClick={() => {
                      clearAllItems();
                      setShoppingMenuOpen(false);
                    }}
                    disabled={shoppingList.length === 0}
                  >
                    <Trash2 size={16} /> Clear all
                  </button>
                  <div className="dropdown-sep" />
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      downloadList();
                      setShoppingMenuOpen(false);
                    }}
                    disabled={shoppingList.length === 0}
                  >
                    <Download size={16} /> Download list
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      loadListFromFile();
                      setShoppingMenuOpen(false);
                    }}
                  >
                    <FolderOpen size={16} /> Load list
                  </button>
                </div>,
                document.body,
              )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileLoad}
          />
        </div>
      </div>
      <div className="entry-list">
        <ShoppingList
          shoppingList={shoppingList}
          shoppingGrouped={shoppingGrouped}
          dragOverIndex={dragOverIndex}
          isDark={isDark}
          toggleShoppingItem={toggleShoppingItem}
          removeShoppingItem={removeShoppingItem}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          handleDragEnd={handleDragEnd}
        />
      </div>
    </>
  );
}
