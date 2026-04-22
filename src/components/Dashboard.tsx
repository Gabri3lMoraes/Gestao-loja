import { useState, useMemo, useEffect } from 'react';
import Database from "@tauri-apps/plugin-sql";

const weekLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const initialProducts = [
  { id: 1, name: 'Conjunto Rendado Paris', category: 'Lingerie', sizes: ['P: 8', 'M: 10', 'G: 6'], colors: 'Preto, Vermelho', total: 24, price: 'R$ 189,90' },
  { id: 2, name: 'Biquíni Tropicália', category: 'Praia', sizes: ['P: 5', 'M: 7', 'G: 4', 'GG: 2'], colors: 'Azul, Rosa', total: 18, price: 'R$ 149,90' },
];

type Product = {
  id: number;
  name: string;
  category: string;
  sizes: string[];
  colors: string;
  total: number;
  price: string;
};

type CartSize = { size: string; quantity: number; };
type CartItem = Omit<Product, 'sizes'> & { quantity: number; sizes: CartSize[]; };
type ProductForm = { name: string; category: string; price: string; colors: string; hasSize: boolean; qtyP: string; qtyM: string; qtyG: string; qtyGG: string; qtyUnique: string; };
type SizeKey = 'qtyP' | 'qtyM' | 'qtyG' | 'qtyGG';
type PaymentMethod = 'Dinheiro' | 'Crédito' | 'Débito' | 'PIX';
type TransactionType = 'entrada' | 'saida';

type FinanceTransaction = {
  id: number;
  type: TransactionType;
  title: string;
  category: string;
  amount: number;
  date: string;
  note?: string;
};

const Dashboard: React.FC = () => {
  const [activePage, setActivePage] = useState<'overview' | 'stock' | 'pdv' | 'finance' | 'history'>('overview');
  const [historyPeriod, setHistoryPeriod] = useState<string>(() => {
    const today = new Date();
    return `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  });
  
  const [products, setProducts] = useState<Product[]>([]);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stockSearch, setStockSearch] = useState('');
  const [pdvSearch, setPdvSearch] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  
  const [lastSaleNote, setLastSaleNote] = useState<{
    title: string;
    date: string;
    time: string;
    total: number;
    payment: string;
    items: Array<{ name: string; quantity: number; price: string; lineTotal: number }>;
  } | null>(null);
  
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ title: '', amount: '', category: 'Geral', note: '' });
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  
  const [newProduct, setNewProduct] = useState<ProductForm>({
    name: '', category: 'Lingerie', price: '', colors: '', hasSize: false, qtyP: '0', qtyM: '0', qtyG: '0', qtyGG: '0', qtyUnique: '0',
  });
  
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [selectedProductForSize, setSelectedProductForSize] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');

  useEffect(() => {
    const carregarBancoDeDados = async () => {
      try {
        const db = await Database.load("sqlite:preta_sexy.db");
        
        const dbProdutos = await db.select<any[]>("SELECT * FROM produtos");
        if (dbProdutos.length > 0) {
          const produtosFormatados: Product[] = dbProdutos.map(p => ({
            id: p.id,
            name: p.nome,
            category: p.categoria,
            sizes: p.tamanho ? p.tamanho.split(',') : ['Único: ' + p.quantidade],
            colors: p.cor || '-',
            total: p.quantidade,
            price: `R$ ${p.preco_venda.toFixed(2).replace('.', ',')}`
          }));
          setProducts(produtosFormatados);
        } else {
          setProducts(initialProducts); 
        }

        const dbFinanceiro = await db.select<any[]>("SELECT * FROM financeiro");
        if (dbFinanceiro.length > 0) {
          const financeiroFormatado: FinanceTransaction[] = dbFinanceiro.map(f => ({
            id: f.id,
            type: f.tipo as TransactionType,
            title: f.descricao,
            category: 'Geral', 
            amount: f.valor,
            date: f.data,
            note: ''
          }));
          setFinanceTransactions(financeiroFormatado);
        }
      } catch (error) {
        console.error("Erro ao carregar o banco de dados:", error);
      }
    };
    
    carregarBancoDeDados();
  }, []);

  const parseSizeMap = (sizes: string[]) => {
    const map: Record<string, number> = {};
    sizes.forEach((size) => {
      const [label, qty] = size.split(': ');
      map[label] = Number(qty);
    });
    return map;
  };

  const getLast7Days = () => {
    const days: Date[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      date.setHours(0, 0, 0, 0);
      days.push(date);
    }
    return days;
  };

  const weeklySales = useMemo(() => getLast7Days().map((date) => {
    const value = financeTransactions
      .filter((entry) => entry.type === 'entrada')
      .filter((entry) => entry.date === date.toLocaleDateString('pt-BR'))
      .reduce((sum, entry) => sum + entry.amount, 0);
    return { day: weekLabels[date.getDay()], value };
  }), [financeTransactions]);

  const maxValue = useMemo(() => Math.max(...weeklySales.map((item) => item.value), 0), [weeklySales]);
  const chartTicks = useMemo(() => maxValue > 0
    ? [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0]
    : [700, 525, 350, 175, 0], [maxValue]);

  const handleProductChange = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setNewProduct((current) => ({ ...current, [key]: value }));
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setIsEditingProduct(false);
    setEditingProductId(null);
    setNewProduct({ name: '', category: 'Lingerie', price: '', colors: '', hasSize: false, qtyP: '0', qtyM: '0', qtyG: '0', qtyGG: '0', qtyUnique: '0' });
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  const parseCurrency = (value: string) => {
    return Number(value.replace(/[R$\s\.]/g, '').replace(',', '.'));
  };

  const calculateTotal = (items: CartItem[]) => {
    return items.reduce((sum, item) => {
      const price = Number(item.price.replace(/[R$\.\s]/g, '').replace(',', '.'));
      return sum + price * item.quantity;
    }, 0);
  };

  const addToCart = (product: Product, size: string, quantity: number) => {
    const availableQty = parseSizeMap(product.sizes)[size] || 0;
    if (quantity > availableQty) {
      alert(`Quantidade indisponível. Disponível: ${availableQty}`);
      return;
    }
    setProducts((current) =>
      current.map((p) => {
        if (p.id !== product.id) return p;
        const sizeMap = parseSizeMap(p.sizes);
        sizeMap[size] = Math.max(0, sizeMap[size] - quantity);
        const newSizes = Object.entries(sizeMap).map(([label, qty]) => `${label}: ${qty}`);
        const newTotal = Object.values(sizeMap).reduce((sum, qty) => sum + qty, 0);
        return { ...p, sizes: newSizes, total: newTotal };
      })
    );
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => {
          if (item.id !== product.id) return item;
          const existingSize = item.sizes.find((entry) => entry.size === size);
          const updatedSizes = existingSize
            ? item.sizes.map((entry) => entry.size === size ? { ...entry, quantity: entry.quantity + quantity } : entry)
            : [...item.sizes, { size, quantity }];
          return { ...item, sizes: updatedSizes, quantity: item.quantity + quantity };
        });
      }
      return [...current, { ...product, quantity, sizes: [{ size, quantity }] }];
    });
  };

  const removeFromCart = (item: CartItem) => {
    setProducts((current) =>
      current.map((p) => {
        if (p.id !== item.id) return p;
        const sizeMap = parseSizeMap(p.sizes);
        item.sizes.forEach((entry) => { sizeMap[entry.size] = (sizeMap[entry.size] || 0) + entry.quantity; });
        const newSizes = Object.entries(sizeMap).map(([label, qty]) => `${label}: ${qty}`);
        const newTotal = Object.values(sizeMap).reduce((sum, qty) => sum + qty, 0);
        return { ...p, sizes: newSizes, total: newTotal };
      })
    );
    setCart((current) => current.filter((cartItem) => cartItem.id !== item.id));
  };

  const finalizeSale = async () => {
    if (cart.length === 0) return;

    const totalSale = Math.max(0, totalCart * (1 - Number(discount || '0') / 100));
    const saleTitle = `Venda - ${cart.reduce((sum, item) => sum + item.quantity, 0)} itens`;
    const date = new Date().toLocaleDateString('pt-BR');
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    try {
      const db = await Database.load("sqlite:preta_sexy.db");
      await db.execute(
        "INSERT INTO financeiro (descricao, tipo, valor, data) VALUES ($1, $2, $3, $4)",
        [saleTitle, 'entrada', totalSale, date]
      );
    } catch (e) {
      console.error("Erro ao salvar venda no banco", e);
    }

    const saleNote = cart.map((item) => {
      const sizesText = item.sizes.map((entry) => `${entry.size} x ${entry.quantity}`).join(', ');
      return `${item.name}${sizesText ? ` (${sizesText})` : ''}`;
    }).join(' • ');

    const noteItems = cart.map((item) => {
      const parsedPrice = parseCurrency(item.price);
      const sizesText = item.sizes.map((entry) => `${entry.size} x ${entry.quantity}`).join(' • ');
      return {
        name: `${item.name}${sizesText ? ` (${sizesText})` : ''}`,
        quantity: item.quantity,
        price: item.price,
        lineTotal: parsedPrice * item.quantity,
      };
    });

    setFinanceTransactions((current) => [
      { id: Date.now(), type: 'entrada', title: saleTitle, category: paymentMethod, amount: totalSale, date, note: saleNote },
      ...current,
    ]);

    setLastSaleNote({ title: saleTitle, date, time, total: totalSale, payment: paymentMethod, items: noteItems });
    setIsNoteOpen(true);
    setCart([]);
    setDiscount('0');
    setPaymentMethod('PIX');
  };

  const stockFilteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(stockSearch.toLowerCase()) || product.category.toLowerCase().includes(stockSearch.toLowerCase())
  );

  const pdvFilteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(pdvSearch.toLowerCase()) || product.category.toLowerCase().includes(pdvSearch.toLowerCase())
  );

  const totalCart = calculateTotal(cart);
  const discountedValue = Math.max(0, totalCart * (1 - Number(discount || '0') / 100));
  const today = new Date().toLocaleDateString('pt-BR');
  const [, currentMonth, currentYear] = today.split('/').map(Number);

  const todayRevenue = financeTransactions
    .filter((entry) => entry.type === 'entrada' && entry.date === today)
    .reduce((sum, entry) => sum + entry.amount, 0);

  const monthRevenue = financeTransactions
    .filter((entry) => {
      const [, month, year] = entry.date.split('/').map(Number);
      return entry.type === 'entrada' && month === currentMonth && year === currentYear;
    })
    .reduce((sum, entry) => sum + entry.amount, 0);

  const lowStockCount = products.filter((product) => product.total <= 3).length;

  const overviewCards = [
    { title: 'Faturamento do Dia', value: formatCurrency(todayRevenue), subtitle: `${financeTransactions.filter((entry) => entry.type === 'entrada' && entry.date === today).length} recebimentos hoje`, status: 'normal' },
    { title: 'Baixo Estoque', value: `${lowStockCount} produtos`, subtitle: lowStockCount > 0 ? 'Atenção necessária' : 'Estoque saudável', status: lowStockCount > 0 ? 'alert' : 'normal' },
    { title: 'Vendas do Mês', value: formatCurrency(monthRevenue), subtitle: `${monthRevenue > 0 ? 'Baseado em vendas reais' : 'Sem vendas ainda neste mês'}`, status: 'normal' },
  ];

  const saveProduct = async () => {
    const sizeEntries: Array<{ key: SizeKey; label: string }> = [
      { key: 'qtyP', label: 'P' }, { key: 'qtyM', label: 'M' }, { key: 'qtyG', label: 'G' }, { key: 'qtyGG', label: 'GG' },
    ];

    const total = newProduct.hasSize
      ? sizeEntries.reduce((sum, size) => sum + Number(newProduct[size.key]), 0)
      : Number(newProduct.qtyUnique);

    const price = Number(newProduct.price.replace(',', '.')) || 0;
    const arraySizes = newProduct.hasSize ? sizeEntries.map((size) => `${size.label}: ${newProduct[size.key]}`) : [`Único: ${newProduct.qtyUnique}`];

    try {
      const db = await Database.load("sqlite:preta_sexy.db");
      
      if (isEditingProduct && editingProductId !== null) {
        await db.execute(
          "UPDATE produtos SET nome = $1, categoria = $2, tamanho = $3, cor = $4, quantidade = $5, preco_venda = $6 WHERE id = $7",
          [newProduct.name || 'Produto sem nome', newProduct.category, arraySizes.join(','), newProduct.colors || '-', total, price, editingProductId]
        );
        
        setProducts((current) =>
          current.map((item) => item.id === editingProductId ? { ...item, name: newProduct.name || 'Produto sem nome', category: newProduct.category, colors: newProduct.colors || '-', price: formatCurrency(price), total, sizes: arraySizes } : item)
        );
      } else {
        await db.execute(
          "INSERT INTO produtos (nome, categoria, tamanho, cor, quantidade, preco_venda) VALUES ($1, $2, $3, $4, $5, $6)",
          [newProduct.name || 'Produto sem nome', newProduct.category, arraySizes.join(','), newProduct.colors || '-', total, price]
        );
        
        const product: Product = { id: Date.now(), name: newProduct.name || 'Produto sem nome', category: newProduct.category, sizes: arraySizes, colors: newProduct.colors || '-', total, price: formatCurrency(price) };
        setProducts((current) => [product, ...current]);
      }
    } catch (e) {
      console.error("Erro ao salvar produto no banco", e);
    }
    
    closeProductModal();
  };

  const openEditProduct = (product: Product) => {
    const sizes: Record<string, string> = {};
    product.sizes.forEach((size) => {
      const [label, qty] = size.split(': ');
      if (label === 'Único') { sizes['qtyUnique'] = qty; } else { sizes[`qty${label}`] = qty; }
    });

    setNewProduct({
      name: product.name, category: product.category, price: product.price.replace(/[R$\s]/g, '').replace('.', '').replace(',', '.'), colors: product.colors, hasSize: !product.sizes[0].startsWith('Único'), qtyP: sizes['qtyP'] || '0', qtyM: sizes['qtyM'] || '0', qtyG: sizes['qtyG'] || '0', qtyGG: sizes['qtyGG'] || '0', qtyUnique: sizes['qtyUnique'] || '0',
    });
    setEditingProductId(product.id);
    setIsEditingProduct(true);
    setIsProductModalOpen(true);
  };

  const saveExpense = async () => {
    const amount = Number(newExpense.amount.replace(',', '.')) || 0;
    if (!newExpense.title.trim() || amount <= 0) {
      alert('Preencha o título e o valor da despesa.');
      return;
    }

    const todayDate = new Date().toLocaleDateString('pt-BR');

    try {
      const db = await Database.load("sqlite:preta_sexy.db");
      await db.execute(
        "INSERT INTO financeiro (descricao, tipo, valor, data) VALUES ($1, $2, $3, $4)",
        [newExpense.title, 'saida', amount, todayDate]
      );
    } catch (e) {
      console.error("Erro ao salvar despesa no banco", e);
    }

    setFinanceTransactions((current) => [
      { id: Date.now(), type: 'saida', title: newExpense.title, category: newExpense.category, amount, date: todayDate, note: newExpense.note.trim() || undefined },
      ...current,
    ]);

    setNewExpense({ title: '', amount: '', category: 'Geral', note: '' });
    setIsExpenseModalOpen(false);
  };

  const totalEntries = financeTransactions.filter((item) => item.type === 'entrada').reduce((sum, item) => sum + item.amount, 0);
  const totalExits = financeTransactions.filter((item) => item.type === 'saida').reduce((sum, item) => sum + item.amount, 0);
  const balance = totalEntries - totalExits;

  // --- LÓGICA DO HISTÓRICO ---
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    financeTransactions.forEach(t => {
      if (t.type === 'entrada') {
        const parts = t.date.split('/');
        if (parts.length === 3) months.add(`${parts[1]}/${parts[2]}`);
      }
    });
    const today = new Date();
    months.add(`${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`);
    return Array.from(months).sort((a, b) => {
      const [mA, yA] = a.split('/').map(Number);
      const [mB, yB] = b.split('/').map(Number);
      return yB !== yA ? yB - yA : mB - mA;
    });
  }, [financeTransactions]);

  const historyData = useMemo(() => {
    const sales = financeTransactions.filter(t => t.type === 'entrada' && t.date.endsWith(historyPeriod));
    const faturamento = sales.reduce((sum, s) => sum + s.amount, 0);
    const ticketMedio = sales.length > 0 ? faturamento / sales.length : 0;
    const itensVendidos = sales.reduce((sum, s) => {
      const match = s.title.match(/Venda - (\d+) itens?/);
      return sum + (match ? parseInt(match[1], 10) : 0);
    }, 0);
    return { sales, faturamento, ticketMedio, itensVendidos };
  }, [financeTransactions, historyPeriod]);

  const monthlyChartData = useMemo(() => {
    const data = [];
    for(let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const yStr = d.getFullYear();
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const monthSales = financeTransactions.filter(t => t.type === 'entrada' && t.date.endsWith(`${mStr}/${yStr}`));
      data.push({ label, value: monthSales.reduce((sum, s) => sum + s.amount, 0) });
    }
    return data;
  }, [financeTransactions]);

  const renderOverview = () => (
    <>
      <section className="metrics-grid">
        {overviewCards.map((card) => (
          <div key={card.title} className={`metric-card ${card.status}`}>
            <span className="metric-title">{card.title}</span>
            <strong className="metric-value">{card.value}</strong>
            <span className="metric-subtitle">{card.subtitle}</span>
          </div>
        ))}
      </section>

      <section className="sales-panel">
        <div className="panel-header"><h2>Vendas da Semana</h2></div>
        <div className="sales-chart">
          <div className="chart-yaxis">{chartTicks.map((tick, index) => (<span key={`${tick}-${index}`}>{formatCurrency(tick)}</span>))}</div>
          <div className="chart-bars">
            {weeklySales.map((item) => {
              const heightPx = maxValue > 0 ? (item.value / maxValue) * 200 : 0;
              return (
                <div key={item.day} className="chart-bar">
                  <span className="bar-value">{formatCurrency(item.value)}</span>
                  <div className="bar-fill" style={{ height: `${heightPx}px` }} />
                  <span className="bar-tooltip">{formatCurrency(item.value)} vendidos</span>
                  <span>{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );

  const renderStock = () => (
    <>
      <div className="stock-topbar">
        <div><p>{products.length} produtos cadastrados</p></div>
        <button className="primary-button" onClick={() => setIsProductModalOpen(true)}>
          <ion-icon name="add"></ion-icon> Adicionar Novo Produto
        </button>
      </div>

      <div className="stock-panel">
        <div className="stock-search-wrapper">
          <input type="text" placeholder="Buscar produto ou categoria..." value={stockSearch} onChange={(event) => setStockSearch(event.target.value)} />
        </div>
        <div className="stock-table-wrapper">
          <table className="stock-table">
            <thead>
              <tr><th>Produto</th><th>Categoria</th><th>Estoque por Tamanho</th><th>Cores</th><th>Total</th><th>Preço</th><th>Ação</th></tr>
            </thead>
            <tbody>
              {stockFilteredProducts.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td><span className="category-pill">{item.category}</span></td>
                  <td><div className="size-pill-group">{item.sizes.map((size) => (<span key={size} className="size-pill">{size}</span>))}</div></td>
                  <td>{item.colors}</td>
                  <td className={item.total <= 3 ? 'stock-low' : ''}>{item.total}</td>
                  <td>{item.price}</td>
                  <td>
                    <button type="button" className="edit-button" onClick={() => openEditProduct(item)} title="Editar produto">
                      <ion-icon name="pencil"></ion-icon>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isProductModalOpen && (
        <div className="modal-overlay" onClick={closeProductModal}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><h3>{isEditingProduct ? 'Editar Produto' : 'Novo Produto'}</h3></div>
              <button className="modal-close" onClick={closeProductModal}><ion-icon name="close"></ion-icon></button>
            </div>
            <div className="modal-body">
              <label>Nome do Produto<input type="text" placeholder="Ex: Conjunto Rendado" value={newProduct.name} onChange={(event) => handleProductChange('name', event.target.value)} /></label>
              <div className="modal-row">
                <label>Categoria
                  <select value={newProduct.category} onChange={(event) => handleProductChange('category', event.target.value)}>
                    <option value="Lingerie">Lingerie</option><option value="Praia">Praia</option><option value="Sex Shop">Sex Shop</option>
                  </select>
                </label>
                <label>Preço (R$)
                  <div className="price-input-wrapper"><span className="price-prefix">R$</span>
                    <input type="text" placeholder="0,00" value={newProduct.price} onChange={(event) => {
                      const value = event.target.value.replace(/[^0-9]/g, '');
                      if (value.length === 0) { handleProductChange('price', ''); } else if (value.length <= 2) { handleProductChange('price', '0,' + value.padStart(2, '0')); } else { const integerPart = String(parseInt(value.slice(0, -2), 10)); const decimalPart = value.slice(-2); handleProductChange('price', integerPart + ',' + decimalPart); }
                    }} />
                  </div>
                </label>
              </div>
              <label>Cores (separadas por vírgula)<input type="text" placeholder="Preto" value={newProduct.colors} onChange={(event) => handleProductChange('colors', event.target.value)} /></label>
              <div className="modal-row toggle-row">
                <span>Produto tem variação de tamanho?</span>
                <div className="toggle-group">
                  <button type="button" className={`toggle-button ${newProduct.hasSize ? '' : 'toggle-active'}`} onClick={() => handleProductChange('hasSize', false)}>Não</button>
                  <button type="button" className={`toggle-button ${newProduct.hasSize ? 'toggle-active' : ''}`} onClick={() => handleProductChange('hasSize', true)}>Sim</button>
                </div>
              </div>
              {!newProduct.hasSize && (
                <label>Quantidade em Estoque
                  <div className="qty-unique-box">
                    <button type="button" onClick={() => handleProductChange('qtyUnique', String(Math.max(0, Number(newProduct.qtyUnique) - 1)))}>-</button>
                    <input type="text" value={newProduct.qtyUnique} readOnly />
                    <button type="button" onClick={() => handleProductChange('qtyUnique', String(Number(newProduct.qtyUnique) + 1))}>+</button>
                  </div>
                </label>
              )}
              {newProduct.hasSize && (
                <div className="qty-grid">
                  {(['P', 'M', 'G', 'GG'] as const).map((size) => {
                    const qtyKey = `qty${size}` as SizeKey;
                    return (
                      <div key={size} className="qty-box">
                        <span>{size}</span>
                        <div className="qty-controls">
                          <button type="button" onClick={() => handleProductChange(qtyKey, String(Math.max(0, Number(newProduct[qtyKey]) - 1)))}>-</button>
                          <input type="text" value={newProduct[qtyKey] as string} readOnly />
                          <button type="button" onClick={() => handleProductChange(qtyKey, String(Number(newProduct[qtyKey]) + 1))}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button className="modal-submit" type="button" onClick={saveProduct}>{isEditingProduct ? 'Atualizar Produto' : 'Salvar Produto'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderPDV = () => (
    <>
      <div className="pdv-grid">
        <section className="pdv-products">
          <div className="pdv-header">
            <div><h2>PDV - Caixa</h2><p>Registrar vendas</p></div>
            <div className="pdv-search-wrapper"><input type="text" placeholder="Buscar produto..." value={pdvSearch} onChange={(event) => setPdvSearch(event.target.value)} /></div>
          </div>
          <div className="pdv-product-list">
            {pdvFilteredProducts.map((product) => (
              <div key={product.id} className="pdv-product-row">
                <div className='pdv-product-info'>
                  <strong>{product.name}</strong>
                  <div className="product-meta-row"><span className="small-pill">{product.category}</span><span className="small-pill">{product.sizes.join(' • ')}</span></div>
                </div>
                <div className="pdv-product-actions">
                  <span className="product-price">{product.price}</span>
                  <button className="icon-button" type="button" onClick={() => { setSelectedProductForSize(product); setSelectedSize(''); setSelectedQty('1'); setIsSizeModalOpen(true); }}><ion-icon name="bag-add"></ion-icon></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="cart-panel">
          <div className="cart-panel-card">
            <div className="cart-panel-title"><span>Carrinho</span></div>
            {cart.length === 0 ? (<div className="cart-empty">Carrinho vazio</div>) : (
              <div className="cart-items">
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className='cart-item-info'>
                      <strong style={{textAlign: "center"}}>{item.name}</strong>
                      <span className="size-summary">{item.sizes.map((entry) => `${entry.size}: ${entry.quantity}`).join(' • ')}</span>
                      <p>{item.quantity} x {item.price}</p>
                    </div>
                    <button type="button" className="cart-remove" onClick={() => removeFromCart(item)} title="Remover do carrinho"><ion-icon name="trash"></ion-icon></button>
                  </div>
                ))}
              </div>
            )}
            <div className="cart-form-row">
              <label>Desconto (%)<div className="discount-input-wrapper"><input type="number" min="0" max="100" value={discount} onChange={(event) => setDiscount(Math.min(100, Math.max(0, Number(event.target.value) || 0)).toString())} /><span className="discount-symbol">%</span></div></label>
            </div>
            <div className="payment-method-group">
              {([{ method: 'Dinheiro', icon: 'cash' }, { method: 'Crédito', icon: 'card' }, { method: 'Débito', icon: 'card-outline' }, { method: 'PIX', icon: 'qr-code' },] as Array<{ method: PaymentMethod; icon: string }>).map(({ method, icon }) => (
                <button key={method} type="button" className={paymentMethod === method ? 'payment-active' : ''} onClick={() => setPaymentMethod(method)}><ion-icon name={icon}></ion-icon> {method}</button>
              ))}
            </div>
            <div className="cart-summary">
              <div><span>Subtotal</span><span>{formatCurrency(totalCart)}</span></div>
              {Number(discount) > 0 && (<div><span>Desconto ({discount}%)</span><span>-{formatCurrency(totalCart * Number(discount) / 100)}</span></div>)}
              <div><span>Total</span><strong>{formatCurrency(discountedValue)}</strong></div>
            </div>
            <button className="modal-submit" type="button" onClick={finalizeSale}>Finalizar Venda</button>
          </div>
        </aside>
      </div>
      
      {isSizeModalOpen && selectedProductForSize && (
        <div className="modal-overlay" onClick={() => setIsSizeModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><h3>Selecionar Tamanho</h3><p>{selectedProductForSize.name}</p></div>
              <button className="modal-close" onClick={() => setIsSizeModalOpen(false)}><ion-icon name="close"></ion-icon></button>
            </div>
            <div className="modal-body">
              <div className="size-selection">
                {Object.entries(parseSizeMap(selectedProductForSize.sizes)).map(([size, qty]) => (
                  <button key={size} type="button" className={`size-button ${selectedSize === size ? 'selected' : ''}`} onClick={() => setSelectedSize(size)} disabled={qty === 0}>{size} ({qty} disponível)</button>
                ))}
              </div>
              <label>Quantidade
                <div className="qty-unique-box">
                  <button type="button" onClick={() => { const newQty = Math.max(1, Number(selectedQty) - 1); setSelectedQty(String(newQty)); }}>-</button>
                  <input type="text" value={selectedQty} readOnly />
                  <button type="button" onClick={() => { const maxQty = selectedSize ? parseSizeMap(selectedProductForSize.sizes)[selectedSize] : 1; const newQty = Math.min(maxQty, Number(selectedQty) + 1); setSelectedQty(String(newQty)); }}>+</button>
                </div>
              </label>
              <button className="modal-submit" type="button" onClick={() => { if (selectedSize && Number(selectedQty) > 0) { addToCart(selectedProductForSize, selectedSize, Number(selectedQty)); setIsSizeModalOpen(false); } }} disabled={!selectedSize || Number(selectedQty) <= 0}>Adicionar ao Carrinho</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderFinance = () => (
    <>
      <div className="finance-header-row"><button className="primary-button" onClick={() => setIsExpenseModalOpen(true)}><ion-icon name="receipt"></ion-icon> Cadastrar Despesa / Gastos</button></div>
      <div className="metrics-grid finance-metrics">
        <div className="metric-card normal"><span className="metric-title">Entradas</span><strong className="metric-value">{formatCurrency(totalEntries)}</strong><span className="metric-subtitle">Total recebido</span></div>
        <div className="metric-card alert"><span className="metric-title">Saídas</span><strong className="metric-value">{formatCurrency(totalExits)}</strong><span className="metric-subtitle">Total gasto</span></div>
        <div className="metric-card"><span className="metric-title">Saldo Atual</span><strong className="metric-value">{formatCurrency(balance)}</strong><span className="metric-subtitle">Balanço do caixa</span></div>
      </div>
      <div className="finance-panel">
        <h2>Transações Recentes</h2>
        <div className="transaction-list">
          {financeTransactions.length === 0 ? (<div className="transaction-empty">Nenhuma transação cadastrada ainda.</div>) : (
            financeTransactions.map((transaction) => (
              <div key={transaction.id} className={`transaction-item ${transaction.type}`}>
                <div><strong>{transaction.title}</strong><p>{transaction.date} • {transaction.category}</p>{transaction.note && <small>{transaction.note}</small>}</div>
                <span>{transaction.type === 'entrada' ? '+' : '-'} {formatCurrency(transaction.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
      
      {isExpenseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsExpenseModalOpen(false)}>
          <div className="modal-card expense-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><h3>Cadastrar Despesa / Gasto</h3></div>
              <button className="modal-close" onClick={() => setIsExpenseModalOpen(false)}><ion-icon name="close"></ion-icon></button>
            </div>
            <div className="modal-body">
              <label>Título da Despesa<input type="text" value={newExpense.title} onChange={(event) => setNewExpense((current) => ({ ...current, title: event.target.value }))} placeholder="Ex: Conta de luz" /></label>
              <label>Valor
                <div className="price-input-wrapper"><span className="price-prefix">R$</span>
                  <input type="text" value={newExpense.amount} onChange={(event) => { const value = event.target.value.replace(/[^0-9]/g, ''); if (value.length === 0) { setNewExpense((current) => ({ ...current, amount: '' })); } else if (value.length <= 2) { setNewExpense((current) => ({ ...current, amount: '0,' + value.padStart(2, '0') })); } else { const integerPart = String(parseInt(value.slice(0, -2), 10)); const decimalPart = value.slice(-2); setNewExpense((current) => ({ ...current, amount: integerPart + ',' + decimalPart })); } }} placeholder="0,00" />
                </div>
              </label>
              <label>Categoria<input type="text" value={newExpense.category} onChange={(event) => setNewExpense((current) => ({ ...current, category: event.target.value }))} placeholder="Ex: Aluguel" /></label>
              <label>Observação<input type="text" value={newExpense.note} onChange={(event) => setNewExpense((current) => ({ ...current, note: event.target.value }))} placeholder="Opcional" /></label>
              <button className="modal-submit" type="button" onClick={saveExpense}>Salvar Despesa</button>
            </div>
          </div>
        </div>
      )}
      
      {isNoteOpen && lastSaleNote && (
        <div className="modal-overlay" onClick={() => setIsNoteOpen(false)}>
          <div className="modal-card expense-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><h3>Preta Sexy</h3><span>Comprovante de Venda</span></div>
              <button className="modal-close" onClick={() => setIsNoteOpen(false)}><ion-icon name="close"></ion-icon></button>
            </div>
            <div className="modal-body note-body">
              <div className="note-items">
                {lastSaleNote.items.map((item) => (
                  <div key={`${item.name}-${item.quantity}`} className="note-item">
                    <span>{item.quantity}x {item.name}</span><strong>{formatCurrency(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="note-summary"><span>Total</span><strong>{formatCurrency(lastSaleNote.total)}</strong></div>
              <div className="note-meta"><span>Pagamento: {lastSaleNote.payment}</span><span>{lastSaleNote.date} {lastSaleNote.time}</span></div>
              <div className="note-actions">
                <button className="modal-submit" type="button" onClick={() => window.print()}>Imprimir Nota</button>
                <button className="secondary-button" type="button" onClick={() => setIsNoteOpen(false)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderHistory = () => {
    const maxChartValue = Math.max(...monthlyChartData.map(d => d.value), 100);

    return (
      <div className="history-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Histórico de Vendas</h2>
            <p style={{ color: '#888', fontSize: '0.9rem' }}>Consulte vendas de meses anteriores e acompanhe a evolução</p>
          </div>
          <select 
            value={historyPeriod} 
            onChange={(e) => setHistoryPeriod(e.target.value)}
            style={{ padding: '10px 16px', borderRadius: '8px', backgroundColor: '#111', color: '#eab308', border: '1px solid #333', outline: 'none', fontWeight: 'bold' }}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="metrics-grid">
          <div className="metric-card normal" style={{ backgroundColor: '#111', border: '1px solid #222' }}>
            <span className="metric-title">Faturamento do Mês</span>
            <strong className="metric-value">{formatCurrency(historyData.faturamento)}</strong>
            <span className="metric-subtitle">{historyData.sales.length} vendas registradas</span>
          </div>
          <div className="metric-card normal" style={{ backgroundColor: '#111', border: '1px solid #222' }}>
            <span className="metric-title">Ticket Médio</span>
            <strong className="metric-value">{formatCurrency(historyData.ticketMedio)}</strong>
            <span className="metric-subtitle">por venda</span>
          </div>
          <div className="metric-card normal" style={{ backgroundColor: '#111', border: '1px solid #222' }}>
            <span className="metric-title">Itens Vendidos</span>
            <strong className="metric-value">{historyData.itensVendidos}</strong>
            <span className="metric-subtitle">peças no mês</span>
          </div>
        </div>

        <section className="sales-panel" style={{ backgroundColor: '#111', border: '1px solid #222' }}>
          <div className="panel-header">
            <h2>Comparativo Mensal</h2>
          </div>
          <div className="sales-chart" style={{ height: '220px', marginTop: '20px' }}>
            <div className="chart-yaxis" style={{ color: '#666', fontSize: '0.8rem' }}>
              <span>{formatCurrency(maxChartValue)}</span>
              <span>{formatCurrency(maxChartValue * 0.5)}</span>
              <span>R$ 0,00</span>
            </div>
            <div className="chart-bars">
              {monthlyChartData.map((item) => {
                const heightPx = maxChartValue > 0 ? (item.value / maxChartValue) * 180 : 0;
                return (
                  <div key={item.label} className="chart-bar">
                    <span className="bar-value" style={{ fontSize: '0.75rem', opacity: 0 }}>{formatCurrency(item.value)}</span>
                    <div className="bar-fill" style={{ height: `${heightPx}px`, backgroundColor: '#eab308', width: '40px', borderRadius: '4px 4px 0 0' }} />
                    <span style={{ color: '#888', marginTop: '8px', textTransform: 'capitalize' }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section style={{ backgroundColor: '#111', padding: '24px', borderRadius: '12px', border: '1px solid #222' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '1.1rem', color: '#ccc' }}>Vendas — {historyPeriod}</h3>
          <div className="stock-table-wrapper">
            <table className="stock-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', color: '#888', fontSize: '0.9rem' }}>
                  <th style={{ paddingBottom: '12px' }}>Nº Venda</th>
                  <th style={{ paddingBottom: '12px' }}>Data / Hora</th>
                  <th style={{ paddingBottom: '12px' }}>Itens</th>
                  <th style={{ paddingBottom: '12px' }}>Pagamento</th>
                  <th style={{ paddingBottom: '12px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {historyData.sales.map((sale) => {
                  const match = sale.title.match(/Venda - (\d+) itens?/);
                  const itens = match ? match[1] : '1';
                  return (
                    <tr key={sale.id} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '16px 0', color: '#ccc' }}>V{sale.id.toString().slice(-4)}</td>
                      <td style={{ color: '#ccc' }}>{sale.date}</td>
                      <td style={{ color: '#ccc' }}>{itens} itens</td>
                      <td style={{ color: '#ccc' }}>{sale.category}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#eab308' }}>{formatCurrency(sale.amount)}</td>
                    </tr>
                  )
                })}
                {historyData.sales.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#666' }}>Nenhuma venda registrada neste mês.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  };

  const getPageTitle = () => {
    switch (activePage) {
      case 'stock': return 'Estoque';
      case 'pdv': return 'PDV - Caixa';
      case 'finance': return 'Financeiro';
      case 'history': return 'Histórico';
      default: return 'Visão Geral';
    }
  };

  const getPageSubtitle = () => {
    switch (activePage) {
      case 'stock': return 'Confira o estoque disponível e o status dos produtos.';
      case 'pdv': return 'Registro rápido de vendas e fechamento de caixa.';
      case 'finance': return 'Indicadores financeiros da loja.';
      case 'history': return 'Consulte vendas de meses anteriores.';
      default: return 'Bem-vinda de volta, Gerente.';
    }
  };

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><img style={{width: "55px", borderRadius: "20%"}} src="../assets/logo.jpeg" alt="Preta Sexy" /></div>
          <div><strong>Preta Sexy</strong><span>Gestão da Loja</span></div>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activePage === 'overview' ? 'active' : ''}`} onClick={() => setActivePage('overview')}>Visão Geral</button>
          <button className={`nav-item ${activePage === 'stock' ? 'active' : ''}`} onClick={() => setActivePage('stock')}>Estoque</button>
          <button className={`nav-item ${activePage === 'pdv' ? 'active' : ''}`} onClick={() => setActivePage('pdv')}>PDV (Caixa)</button>
          <button className={`nav-item ${activePage === 'finance' ? 'active' : ''}`} onClick={() => setActivePage('finance')}>Financeiro</button>
          <button className={`nav-item ${activePage === 'history' ? 'active' : ''}`} onClick={() => setActivePage('history')}><ion-icon name="time-outline"></ion-icon> Histórico</button>
        </nav>
      </aside>

      <main className="dashboard-content">
        <header className="dashboard-header">
          <div><h1>{getPageTitle()}</h1><p>{getPageSubtitle()}</p></div>
        </header>
        {activePage === 'overview' && renderOverview()}
        {activePage === 'stock' && renderStock()}
        {activePage === 'pdv' && renderPDV()}
        {activePage === 'finance' && renderFinance()}
        {activePage === 'history' && renderHistory()}
      </main>
    </div>
  );
};

export default Dashboard;