import { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [stallId, setStallId] = useState(null);
  const [lines, setLines] = useState([]); // { menu_item_id, name, price, quantity }

  function addItem(item) {
    if (stallId != null && stallId !== item.stallId) {
      // switching stalls clears the cart
      setLines([]);
    }
    setStallId(item.stallId);
    setLines((prev) => {
      const existing = prev.find((l) => l.menu_item_id === item.menu_item_id);
      if (existing) {
        return prev.map((l) =>
          l.menu_item_id === item.menu_item_id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { menu_item_id: item.menu_item_id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function decrementItem(menu_item_id) {
    setLines((prev) =>
      prev
        .map((l) => (l.menu_item_id === menu_item_id ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function removeItem(menu_item_id) {
    setLines((prev) => prev.filter((l) => l.menu_item_id !== menu_item_id));
  }

  function clearCart() {
    setLines([]);
    setStallId(null);
  }

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.price * l.quantity, 0), [lines]);
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  return (
    <CartContext.Provider
      value={{ stallId, lines, addItem, decrementItem, removeItem, clearCart, total, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
