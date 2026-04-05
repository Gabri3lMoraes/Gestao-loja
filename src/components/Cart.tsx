import React from 'react';
import { useCart } from '../context/CartContext';

const Cart: React.FC = () => {
  const { cart, removeFromCart, clearCart } = useCart();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div>
      <h2>Carrinho</h2>
      {cart.length === 0 ? (
        <p>Carrinho vazio</p>
      ) : (
        <div>
          {cart.map(item => (
            <div key={item.id}>
              <p>{item.name} - R$ {item.price} x {item.quantity}</p>
              <button onClick={() => removeFromCart(item.id)}>Remover</button>
            </div>
          ))}
          <p>Total: R$ {total}</p>
          <button onClick={clearCart}>Limpar Carrinho</button>
          <button>Finalizar Compra</button>
        </div>
      )}
    </div>
  );
};

export default Cart;