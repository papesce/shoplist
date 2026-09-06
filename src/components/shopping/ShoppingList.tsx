import { GripVertical, X } from "lucide-react";
import { getCategoryColors } from "../../constants/categories";
import type { ShoppingItem } from "../../types";

type Props = {
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
};

export function ShoppingList({
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
}: Props) {
  if (shoppingList.length === 0) {
    return (
      <div className="empty small">
        <p>Search for products in the database and add them</p>
      </div>
    );
  }
  if (shoppingGrouped) {
    return (
      <>
        {shoppingGrouped.map(([cat, items]) => (
          <div key={cat} className="group-section">
            <div className="group-header">
              {cat} <span className="group-count">{items.length}</span>
            </div>
            {items.map((item) => (
              <article key={item.id} className={"entry" + (item.checked ? " entry-tachado" : "")}>
                <input
                  type="checkbox"
                  className="entry-check"
                  checked={item.checked}
                  onChange={() => toggleShoppingItem(item.id)}
                />
                <span className="entry-text">{item.original}</span>
                <button
                  className="entry-remove"
                  onClick={() => removeShoppingItem(item.id)}
                  title="Remove from list"
                >
                  <X size={14} />
                </button>
              </article>
            ))}
          </div>
        ))}
      </>
    );
  }
  return (
    <>
      {shoppingList.map((item, idx) => (
        <article
          key={item.id}
          draggable
          className={
            "entry" +
            (item.checked ? " entry-tachado" : "") +
            (dragOverIndex === idx ? " entry-drag-over" : "")
          }
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
        >
          <span className="drag-handle">
            <GripVertical size={16} />
          </span>
          <input
            type="checkbox"
            className="entry-check"
            checked={item.checked}
            onChange={() => toggleShoppingItem(item.id)}
          />
          <span className="entry-text">{item.original}</span>
          {item.categoria && (
            <span
              className="cat-tag"
              style={
                getCategoryColors(isDark)[item.categoria]
                  ? {
                      background: getCategoryColors(isDark)[item.categoria].bg,
                      color: getCategoryColors(isDark)[item.categoria].text,
                    }
                  : undefined
              }
            >
              {item.categoria}
            </span>
          )}
          <button
            className="entry-remove"
            onClick={() => removeShoppingItem(item.id)}
            title="Remove from list"
          >
            <X size={14} />
          </button>
        </article>
      ))}
    </>
  );
}
