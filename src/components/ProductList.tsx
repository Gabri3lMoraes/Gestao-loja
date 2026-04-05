import React from 'react';
import { useCart } from '../context/CartContext';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
}

const products: Product[] = [
  { id: 1, name: 'Camiseta', price: 50, image: '/placeholder.jpg' },
  { id: 2, name: 'Calça', price: 100, image: '/placeholder.jpg' },
  // Adicionar mais produtos mock
];

const ProductList: React.FC = () => {
  const { addToCart } = useCart();

  return (
    <div>
      <h2>Produtos</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {products.map(product => (
          <div key={product.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
            <img src={product.image} alt={product.name} style={{ width: '100px' }} />
            <h3>{product.name}</h3>
            <p>R$ {product.price}</p>
            <button onClick={() => addToCart(product)}>Adicionar ao Carrinho</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductList;