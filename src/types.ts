export interface Entrada {
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

export interface Resumen {
  total: number;
  conCantidad: number;
  soloTexto: number;
}

export type ListaGuardada = {
  id: string;
  nombre: string;
  fecha: string;
  items: ShoppingItem[];
};
