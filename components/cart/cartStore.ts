import { useSyncExternalStore } from "react";

export interface CartItem {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
  type: string;
}

let cartItems: CartItem[] = [];
if (typeof window !== "undefined") {
  try {
    const stored = window.localStorage.getItem("modparks_cart");
    if (stored) cartItems = JSON.parse(stored);
  } catch (e) {
    console.error(e);
  }
}

const listeners = new Set<() => void>();

export const cartStore = {
  getSnapshot: () => cartItems,
  add: (item: CartItem) => {
    if (cartItems.some((i) => i.id === item.id)) return;
    cartItems = [...cartItems, item];
    cartStore._notify();
  },
  remove: (id: string) => {
    cartItems = cartItems.filter((i) => i.id !== id);
    cartStore._notify();
  },
  clear: () => {
    cartItems = [];
    cartStore._notify();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getServerSnapshot: () => [] as CartItem[],
  _notify: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("modparks_cart", JSON.stringify(cartItems));
      } catch (e) {
        console.error(e);
      }
    }
    listeners.forEach((l) => l());
  }
};

export function useCart() {
  const items = useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot
  );

  return {
    items,
    add: cartStore.add,
    remove: cartStore.remove,
    clear: cartStore.clear,
    has: (id: string) => items.some((i) => i.id === id),
  };
}
