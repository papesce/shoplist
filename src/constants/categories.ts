export const CATEGORIES = [
  "Almacén",
  "Bebidas",
  "Carnicería",
  "Congelados",
  "Fiambrería",
  "Higiene",
  "Lácteos",
  "Limpieza",
  "Mascotas",
  "Otros",
  "Panadería",
  "Snacks",
  "Verdulería",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Almacén: { bg: "#fef3c7", text: "#92400e" },
  Bebidas: { bg: "#dbeafe", text: "#1e40af" },
  Carnicería: { bg: "#fee2e2", text: "#991b1b" },
  Congelados: { bg: "#e0e7ff", text: "#3730a3" },
  Fiambrería: { bg: "#fce7f3", text: "#9d174d" },
  Higiene: { bg: "#d1fae5", text: "#065f46" },
  Lácteos: { bg: "#ede9fe", text: "#5b21b6" },
  Limpieza: { bg: "#ccfbf1", text: "#134e4a" },
  Mascotas: { bg: "#fed7aa", text: "#9a3412" },
  Otros: { bg: "#f3f4f6", text: "#374151" },
  Panadería: { bg: "#fef9c3", text: "#854d0e" },
  Snacks: { bg: "#f5d0fe", text: "#701a75" },
  Verdulería: { bg: "#dcfce7", text: "#166534" },
};

export const CATEGORY_COLORS_DARK: Record<string, { bg: string; text: string }> = {
  Almacén: { bg: "#78350f", text: "#fef3c7" },
  Bebidas: { bg: "#1e3a8a", text: "#dbeafe" },
  Carnicería: { bg: "#7f1d1d", text: "#fee2e2" },
  Congelados: { bg: "#3730a3", text: "#e0e7ff" },
  Fiambrería: { bg: "#831843", text: "#fce7f3" },
  Higiene: { bg: "#064e3b", text: "#d1fae5" },
  Lácteos: { bg: "#4c1d95", text: "#ede9fe" },
  Limpieza: { bg: "#134e4a", text: "#ccfbf1" },
  Mascotas: { bg: "#7c2d12", text: "#fed7aa" },
  Otros: { bg: "#374151", text: "#f3f4f6" },
  Panadería: { bg: "#713f12", text: "#fef9c3" },
  Snacks: { bg: "#701a75", text: "#f5d0fe" },
  Verdulería: { bg: "#14532d", text: "#dcfce7" },
};

export function getCategoryColors(isDark: boolean) {
  return isDark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS;
}
