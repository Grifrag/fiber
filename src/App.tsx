import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Plus,
  Minus,
  Package,
  Search,
  History,
  LogOut,
  User,
  Upload,
  Lock,
} from 'lucide-react';

// === ΡΥΘΜΙΣΕΙΣ SUPABASE ===
// Αντικατάστησε αυτά τα δύο με τα δικά σου από το Supabase -> Settings -> API
const SUPABASE_URL = 'https://pilqekiyosqqxgwwlupe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ap0muWzyjy8TPIN-jW9xxw_yPINMafR';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const InventoryApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState({});
  const [loginStep, setLoginStep] = useState('selectUser');
  const [selectedUsername, setSelectedUsername] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([
    'Κουβίδι',
    'Οπτικές Ίνες',
    'Κανάλια',
    'Εξαρτήματα',
  ]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('inventory');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Καλώδια',
    quantity: 0,
    unit: 'τμχ',
    image: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');

  // 1. ΦΟΡΤΩΣΗ ΔΕΔΟΜΕΝΩΝ ΑΠΟ SUPABASE
  const loadSharedData = async () => {
    setIsLoading(true);
    try {
      // Φόρτωση Προϊόντων
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (prodData) setProducts(prodData);

      // Φόρτωση Ιστορικού
      const { data: histData } = await supabase
        .from('history')
        .select('*')
        .order('timestamp', { ascending: false });
      if (histData) setHistory(histData);

      // Φόρτωση Χρηστών
      const { data: userData } = await supabase.from('users').select('*');
      if (userData) {
        const userMap = {};
        userData.forEach((u) => (userMap[u.username] = u.pin));
        setUsers(userMap);
      }
    } catch (error) {
      console.error('Σφάλμα φόρτωσης:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadSharedData();

    // REAL-TIME: Ακούμε για αλλαγές από άλλους συνεργάτες
    const channel = supabase
      .channel('realtime-inventory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => loadSharedData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'history' },
        () => loadSharedData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. ΛΕΙΤΟΥΡΓΙΕΣ ΧΡΗΣΤΩΝ (PIN & LOGIN)
  const verifyPin = (pin) => {
    if (users[selectedUsername] === pin) {
      setCurrentUser(selectedUsername);
      setPinInput('');
    } else {
      setPinError(true);
      setTimeout(() => {
        setPinInput('');
        setPinError(false);
      }, 1000);
    }
  };

  const addNewUser = async () => {
    if (!newUserName.trim() || newUserPin.length !== 6)
      return alert('Συμπληρώστε όνομα και 6-ψήφιο PIN');

    const { error } = await supabase
      .from('users')
      .insert([{ username: newUserName.trim(), pin: newUserPin }]);
    if (error) return alert('Το όνομα υπάρχει ήδη');

    await loadSharedData();
    setShowAddUserModal(false);
    setNewUserName('');
    setNewUserPin('');
  };

  // 3. ΔΙΑΧΕΙΡΙΣΗ ΑΠΟΘΕΜΑΤΟΣ
  const updateQuantity = async (productId, change) => {
    const product = products.find((p) => p.id === productId);
    const newQty = Math.max(0, product.quantity + change);

    // Update προϊόντος
    await supabase
      .from('products')
      .update({ quantity: newQty })
      .eq('id', productId);

    // Προσθήκη στο Ιστορικό
    await supabase.from('history').insert([
      {
        product: product.name,
        user: currentUser,
        type: change > 0 ? 'add' : 'remove',
        details: `${change > 0 ? '+' : ''}${change} ${
          product.unit
        } → ${newQty} ${product.unit}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    loadSharedData();
  };

  const addProduct = async () => {
    console.log('Ξεκινάει η αποθήκευση...', newProduct);
    if (!newProduct.name.trim()) return alert('Συμπλήρωσε όνομα!');

    try {
      const { data, error: prodError } = await supabase
        .from('products')
        .insert([
          {
            name: newProduct.name,
            category: newProduct.category,
            quantity: Number(newProduct.quantity), // Βεβαιωνόμαστε ότι είναι αριθμός
            unit: newProduct.unit,
            image: newProduct.image,
            createdBy: currentUser,
          },
        ])
        .select();

      if (prodError) {
        console.error('Σφάλμα Supabase:', prodError);
        alert(
          'Σφάλμα Βάσης: ' + prodError.message + ' | Code: ' + prodError.code
        );
        return;
      }

      const { error: histError } = await supabase.from('history').insert([
        {
          product: newProduct.name,
          user: currentUser,
          type: 'create',
          details: `Νέο προϊόν: ${newProduct.quantity} ${newProduct.unit}`,
        },
      ]);

      if (histError) console.error('Σφάλμα Ιστορικού:', histError);

      alert('Επιτυχία! Όλα αποθηκεύτηκαν.');
      loadSharedData();
      setShowAddProduct(false);
      setNewProduct({
        name: '',
        category: 'Καλώδια',
        quantity: 0,
        unit: 'τμχ',
        image: '',
      });
    } catch (err) {
      console.error('Γενικό Σφάλμα:', err);
      alert('Κάτι πήγε πολύ στραβά: ' + err.message);
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm('Διαγραφή;')) return;
    const product = products.find((p) => p.id === productId);

    await supabase.from('products').delete().eq('id', productId);
    await supabase.from('history').insert([
      {
        product: product.name,
        user: currentUser,
        type: 'delete',
        details: 'Διαγραφή προϊόντος',
      },
    ]);
    loadSharedData();
  };
  // --- ΣΥΝΕΧΕΙΑ ΚΩΔΙΚΑ ---
  const handlePinInput = (digit) => {
    if (pinInput.length < 6) {
      const newPin = pinInput + digit;
      setPinInput(newPin);
      if (newPin.length === 6) {
        setTimeout(() => verifyPin(newPin), 100);
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 200000) {
        // Μείωση ορίου για δωρεάν βάση
        alert('Η εικόνα πρέπει να είναι κάτω από 200KB για εξοικονόμηση χώρου');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () =>
        setNewProduct({ ...newProduct, image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('el-GR');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Package className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Inventory Cloud
            </h1>
            <p className="text-gray-600">
              {loginStep === 'selectUser'
                ? 'Επιλέξτε Χρήστη'
                : `Εισάγετε PIN για ${selectedUsername}`}
            </p>
          </div>

          {loginStep === 'selectUser' ? (
            <div className="space-y-4">
              {Object.keys(users).map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setSelectedUsername(name);
                    setLoginStep('enterPin');
                  }}
                  className="w-full px-6 py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-3 font-medium transition-all"
                >
                  <User className="w-5 h-5" /> {name}
                </button>
              ))}
              <button
                onClick={() => setShowAddUserModal(true)}
                className="w-full px-6 py-3 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                + Νέος Συνεργάτης
              </button>
            </div>
          ) : (
            <div>
              <div className="flex justify-center gap-2 mb-8">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-10 h-12 border-2 rounded-lg flex items-center justify-center text-xl font-bold ${
                      pinError
                        ? 'border-red-500 bg-red-50'
                        : pinInput.length > i
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-300'
                    }`}
                  >
                    {pinInput.length > i ? '•' : ''}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'Back', 0, '⌫'].map((val) => (
                  <button
                    key={val}
                    onClick={() => {
                      if (val === 'Back') {
                        setLoginStep('selectUser');
                        setPinInput('');
                      } else if (val === '⌫')
                        setPinInput(pinInput.slice(0, -1));
                      else handlePinInput(val.toString());
                    }}
                    className="h-12 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold"
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {showAddUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm">
              <h2 className="text-xl font-bold mb-4">Εγγραφή Συνεργάτη</h2>
              <input
                type="text"
                placeholder="Όνομα"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="w-full p-3 border rounded-lg mb-3"
              />
              <input
                type="text"
                placeholder="PIN (6 ψηφία)"
                maxLength={6}
                value={newUserPin}
                onChange={(e) =>
                  setNewUserPin(e.target.value.replace(/\D/g, ''))
                }
                className="w-full p-3 border rounded-lg mb-4 text-center tracking-widest font-bold"
              />
              <div className="flex gap-2">
                <button
                  onClick={addNewUser}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-lg"
                >
                  Προσθήκη
                </button>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 py-3 bg-gray-200 rounded-lg"
                >
                  Ακύρωση
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Package className="text-indigo-600 w-6 h-6" />
          <span className="font-bold text-gray-800">Inventory Cloud</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium">
            ● {currentUser}
          </span>
          <button
            onClick={() => setCurrentUser(null)}
            className="text-gray-500"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4">
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-3 px-2 font-medium ${
              activeTab === 'inventory'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-400'
            }`}
          >
            Απόθεμα
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-2 font-medium ${
              activeTab === 'history'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-400'
            }`}
          >
            Ιστορικό
          </button>
        </div>

        {activeTab === 'inventory' ? (
          <>
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Αναζήτηση..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="p-2 border rounded-lg bg-white"
              >
                <option value="all">Όλες οι κατηγορίες</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowAddProduct(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 justify-center"
              >
                <Plus className="w-4 h-4" /> Νέο Προϊόν
              </button>
            </div>

            {showAddProduct && (
              <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border-2 border-indigo-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Όνομα προϊόντος"
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, name: e.target.value })
                    }
                    className="p-2 border rounded"
                  />
                  <select
                    value={newProduct.category}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, category: e.target.value })
                    }
                    className="p-2 border rounded"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Ποσότητα"
                    value={newProduct.quantity}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        quantity: parseInt(e.target.value) || 0,
                      })
                    }
                    className="p-2 border rounded"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addProduct}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg"
                  >
                    Αποθήκευση
                  </button>
                  <button
                    onClick={() => setShowAddProduct(false)}
                    className="bg-gray-100 px-6 py-2 rounded-lg"
                  >
                    Ακύρωση
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl shadow-sm border overflow-hidden"
                >
                  <div className="h-32 bg-gray-100 flex items-center justify-center">
                    {p.image ? (
                      <img
                        src={p.image}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-800">{p.name}</h3>
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-2xl font-black text-indigo-600 mb-4">
                      {p.quantity}{' '}
                      <span className="text-xs text-gray-400 font-normal">
                        {p.unit}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateQuantity(p.id, -1)}
                        className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100"
                      >
                        -1
                      </button>
                      <button
                        onClick={() => updateQuantity(p.id, 1)}
                        className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg font-bold hover:bg-green-100"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border divide-y">
            {history.map((h) => (
              <div
                key={h.id}
                className="p-4 flex justify-between items-center hover:bg-gray-50"
              >
                <div>
                  <div className="font-bold text-gray-800">{h.product}</div>
                  <div className="text-xs text-gray-500">
                    {h.user} • {formatDate(h.timestamp || h.created_at)}
                  </div>
                </div>
                <div className="text-sm font-medium text-indigo-600">
                  {h.details}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryApp;
