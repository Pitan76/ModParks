import { useSyncExternalStore } from "react";

export interface CartItem {
  id: string;
  slug: string;
  title: string;
  iconUrl: string | null;
  type: string;
}

let cartItems: CartItem[] = [];

function reloadFromStorage() {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("modparks_cart");
      cartItems = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error(e);
    }
  }
}
reloadFromStorage();

const listeners = new Set<() => void>();

const EMPTY_ARRAY: CartItem[] = [];

export const cartStore = {
  getSnapshot: () => cartItems,
  add: (item: CartItem) => {
    reloadFromStorage();
    if (cartItems.some((i) => i.id === item.id)) return;
    cartItems = [...cartItems, item];
    cartStore._notify();
  },
  /**
   * 複数アイテムをまとめて追加する。
   * 既にカートにあるものと、引数内の重複は除外する。
   * @returns 実際に追加された件数
   */
  addMany: (items: CartItem[]) => {
    reloadFromStorage();
    const seen = new Set(cartItems.map((i) => i.id));
    const fresh: CartItem[] = [];
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      fresh.push(item);
    }
    if (fresh.length === 0) return 0;
    cartItems = [...cartItems, ...fresh];
    // 1件ずつ add するとその都度 localStorage 書き込みと再描画が走るため、まとめて通知する
    cartStore._notify();
    return fresh.length;
  },
  remove: (id: string) => {
    reloadFromStorage();
    cartItems = cartItems.filter((i) => i.id !== id);
    cartStore._notify();
  },
  clear: () => {
    reloadFromStorage();
    cartItems = [];
    cartStore._notify();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getServerSnapshot: () => EMPTY_ARRAY,
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

/** カート機能そのもののオン/オフ（設定 > テーマから切り替え） */
const CART_DISABLED_KEY = "disable_cart";

let cartEnabled = true;
if (typeof window !== "undefined") {
  try {
    cartEnabled = window.localStorage.getItem(CART_DISABLED_KEY) !== "true";
  } catch (e) {
    console.error(e);
  }
}

const enabledListeners = new Set<() => void>();

export const cartEnabledStore = {
  getSnapshot: () => cartEnabled,
  getServerSnapshot: () => true,
  set: (enabled: boolean) => {
    cartEnabled = enabled;
    try {
      window.localStorage.setItem(CART_DISABLED_KEY, enabled ? "false" : "true");
    } catch (e) {
      console.error(e);
    }
    enabledListeners.forEach((l) => l());
  },
  subscribe: (listener: () => void) => {
    enabledListeners.add(listener);
    return () => {
      enabledListeners.delete(listener);
    };
  },
};

/** カート機能が有効か。無効ならカートUIは一切出さない */
export function useCartEnabled() {
  return useSyncExternalStore(
    cartEnabledStore.subscribe,
    cartEnabledStore.getSnapshot,
    cartEnabledStore.getServerSnapshot
  );
}

export function useCart() {
  const items = useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot
  );

  return {
    items,
    add: cartStore.add,
    addMany: cartStore.addMany,
    remove: cartStore.remove,
    clear: cartStore.clear,
    has: (id: string) => items.some((i) => i.id === id),
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "modparks_cart") {
      try {
        cartItems = e.newValue ? JSON.parse(e.newValue) : [];
        listeners.forEach((l) => l());
      } catch (err) {
        console.error(err);
      }
    } else if (e.key === CART_DISABLED_KEY) {
      cartEnabled = e.newValue !== "true";
      enabledListeners.forEach((l) => l());
    }
  });
}
