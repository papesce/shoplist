import { getCategoryColors } from "../../constants/categories";

export function CategoryChips({
  activeCategories,
  sortedCategories,
  categoryFilter,
  setCategoryFilter,
  isDark,
}: {
  activeCategories: string[];
  sortedCategories: string[];
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  isDark: boolean;
}) {
  if (activeCategories.length === 0) return null;
  return (
    <div className="cat-chips">
      <button
        className={"cat-chip" + (!categoryFilter ? " active" : "")}
        onClick={() => setCategoryFilter("")}
      >
        All
      </button>
      {sortedCategories.map((cat) => (
        <button
          key={cat}
          className={"cat-chip" + (categoryFilter === cat ? " active" : "")}
          style={
            categoryFilter !== cat && getCategoryColors(isDark)[cat]
              ? {
                  background: getCategoryColors(isDark)[cat].bg,
                  color: getCategoryColors(isDark)[cat].text,
                }
              : undefined
          }
          onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
