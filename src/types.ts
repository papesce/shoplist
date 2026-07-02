export interface Entry {
  original: string;
  linea: number;
  categoria?: string;
}

export interface ShoppingItem {
  id: string;
  original: string;
  linea: number;
  checked: boolean;
  categoria?: string;
}

export interface Summary {
  total: number;
  withQuantity: number;
  textOnly: number;
}

export type SavedList = {
  id: string;
  name: string;
  date: string;
  items: ShoppingItem[];
};
