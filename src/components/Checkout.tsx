import React, { useState } from 'react';
import { useCart } from '../context/CartContext';

const Checkout: React.FC = () => {
  const { cart, clearCart } = useCart();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const sale = {
      customer: formData,
      items: cart,
      total,
      date: new Date().toISOString(),
    };
    try {
      const response = await fetch('http://localhost:3001/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sale),
      });
      if (response.ok) {
        alert('Compra finalizada com sucesso!');
        clearCart();
      } else {
        alert('Erro ao finalizar compra.');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro de conexão.');
    }
  };

  return (
    <div>
      <h2>Checkout</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Nome"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="address"
          placeholder="Endereço"
          value={formData.address}
          onChange={handleChange}
          required
        />
        <button type="submit">Confirmar Compra</button>
      </form>
    </div>
  );
};

export default Checkout;