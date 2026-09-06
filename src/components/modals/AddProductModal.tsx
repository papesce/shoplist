import { CATEGORIES } from "../../constants/categories";

type Props = {
  show: boolean;
  onClose: () => void;
  newProductName: string;
  setNewProductName: (v: string) => void;
  newProductCategory: string;
  setNewProductCategory: (v: string) => void;
  addNewProduct: () => void;
  addModalCatOpen: boolean;
  setAddModalCatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addModalCatRef: React.RefObject<HTMLButtonElement>;
  addModalCatPos: { top: number; left: number };
  setAddModalCatPos: (v: { top: number; left: number }) => void;
  computeMenuPosition: (r: DOMRect, w: number, h: number) => { top: number; left: number };
};

export function AddProductModal({
  show,
  onClose,
  newProductName,
  setNewProductName,
  newProductCategory,
  setNewProductCategory,
  addNewProduct,
  addModalCatOpen,
  setAddModalCatOpen,
  addModalCatRef,
  addModalCatPos,
  setAddModalCatPos,
  computeMenuPosition,
}: Props) {
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Add new product</h2>
        <input
          type="text"
          className="modal-input"
          placeholder="Product name…"
          value={newProductName}
          onChange={(e) => setNewProductName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") addNewProduct();
          }}
        />
        <div className="dropdown" style={{ position: "relative" }}>
          <button
            ref={addModalCatRef}
            className="modal-select"
            onClick={() => {
              if (addModalCatRef.current)
                setAddModalCatPos(
                  computeMenuPosition(addModalCatRef.current.getBoundingClientRect(), 200, 400),
                );
              setAddModalCatOpen((p) => !p);
            }}
          >
            {newProductCategory || "No category"}
          </button>
          {addModalCatOpen && (
            <div
              className="dropdown-menu"
              style={{
                position: "fixed",
                top: addModalCatPos.top,
                left: addModalCatPos.left,
                zIndex: 301,
              }}
            >
              <button
                className={"dropdown-item" + (!newProductCategory ? " dropdown-item-active" : "")}
                onClick={() => {
                  setNewProductCategory("");
                  setAddModalCatOpen(false);
                }}
              >
                No category
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={
                    "dropdown-item" + (newProductCategory === cat ? " dropdown-item-active" : "")
                  }
                  onClick={() => {
                    setNewProductCategory(cat);
                    setAddModalCatOpen(false);
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button disabled={!newProductName.trim()} onClick={addNewProduct}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
