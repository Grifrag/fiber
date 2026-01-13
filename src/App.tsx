import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Minus, Package, Search, History, LogOut, User, Upload, Lock, Trash2 } from 'lucide-react';

// --- ΡΥΘΜΙΣΕΙΣ SUPABASE ---
// ΒΑΛΕ ΤΑ ΔΙΚΑ ΣΟΥ ΣΤΟΙΧΕΙΑ ΕΔΩ:
const SUPABASE_URL = 'https://pilqekiyosqqxgwwlupe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ap0muWzyjy8TPIN-jW9xxw_yPINMafR';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const InventoryApp = () => {
  // States με "any" για να μην γκρινιάζει το Vercel
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<any>({});
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'inventory' | 'history' | 'admin'>('login');
  
  // Login States
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  
  // Admin/Add States
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newProduct, setNewProduct] = useState<any>({
    name: '',
    category: 'Καλώδια',
    quantity: 0,
    unit: 'τμχ',
    image: ''
  });

  const categories = ['Καλώδια', 'Συνδέσεις', 'Όργανα', 'Αναλώσιμα', 'Εργαλεία'];

  useEffect(() => {
    loadSharedData();
  }, []);

  const loadSharedData = async () => {
    const { data: prodData } = await supabase.from('products').select('*').order('name');
    if (prodData) setProducts(prodData);

    const { data: histData } = await supabase.from('history').select('*').order('timestamp', { ascending: false });
    if (histData) setHistory(histData);

    const { data: userData } = await supabase.from('users').select('*');
    if (userData) {
      const userMap: any = {};
      userData.forEach((u: any) => { userMap[u.username] = u.pin; });
      setUsers(userMap);
    }
  };

  const handleLogin = () => {
    if (users[username] === pin) {
      setCurrentUser(username);
      setView('inventory');
    } else {
      alert('Λάθος Όνομα ή PIN');
    }
  };

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setNewProduct({ ...newProduct, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const addProduct = async () => {
    if (!newProduct.name.trim()) return;
    
    const { data, error } = await supabase.from('products').insert([{
      name: newProduct.name,
      category: newProduct.category,
      quantity: Number(newProduct.quantity),
      unit: newProduct.unit,
      image: newProduct.image,
      createdBy: currentUser
    }]).select();

    if (!error) {
      await supabase.from('history').insert([{
        product: newProduct.name,
        user: currentUser,
        type: 'create',
        details: `Νέο προϊόν: ${newProduct.quantity} ${newProduct.unit}`
      }]);
      loadSharedData();
      setShowAddProduct(false);
      setNewProduct({ name: '', category: 'Καλώδια', quantity: 0, unit: 'τμχ', image: '' });
    }
  };

  const updateQuantity = async (id: any, name: any, currentQty: any, change: any) => {
    const newQty = Math.max(0, currentQty + change);
    const { error } = await supabase.from('products').update({ quantity: newQty }).eq('id', id);
    
    if (!error) {
      await supabase.from('history').insert([{
        product: name,
        user: currentUser,
        type: change > 0 ? 'add' : 'remove',
        details: `${change > 0 ? '+' : ''}${change} ${newQty}`
      }]);
      loadSharedData();
    }
  };

  const addNewUser = async () => {
    if (!newUserName || newUserPin.length !== 6) return;
    const { error } = await supabase.from('users').insert([{ username: newUserName, pin: newUserPin }]);
    if (!error) {
      loadSharedData();
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserPin('');
    }
  };

  const formatDate = (isoString: any) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('el-GR');
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-blue-600 p-4 rounded-full mb-4">
              <Package className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Inventory Cloud</h1>
            <p className="text-gray-500">Είσοδος Συνεργατών</p>
          </div>
          <div className="space-y-4">
            <select 
              className="w-full p-3 border rounded-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            >
              <option value="">Επιλέξτε Όνομα</option>
              {Object.keys(users).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input 
              type="password" 
              placeholder="6-ψήφιο PIN"
              className="w-full p-3 border rounded-lg text-center tracking-widest"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <button 
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition"
            >
              Είσοδος
            </button>
            <button 
              onClick={() => setShowAddUserModal(true)}
              className="w-full text-blue-600 text-sm font-medium hover:underline"
            >
              + Νέος Συνεργάτης
            </button>
          </div>
        </div>

        {showAddUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-sm">
              <h2 className="text-xl font-bold mb-4">Προσθήκη Χρήστη</h2>
              <input 
                type="text" placeholder="Όνομα"
                className="w-full p-2 border rounded mb-3"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
              <input 
                type="password" placeholder="6-ψήφιο PIN"
                className="w-full p-2 border rounded mb-4 text-center"
                maxLength={6}
                value={newUserPin}
                onChange={(e) => setNewUserPin(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={addNewUser} className="flex-1 bg-green-600 text-white p-2 rounded">Δημιουργία</button>
                <button onClick={() => setShowAddUserModal(false)} className="flex-1 bg-gray-200 p-2 rounded">Άκυρο</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Package className="text-blue-600" />
            <span className="font-bold text-gray-800">Inventory</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600 flex items-center gap-1">
              <User size={16}/> {currentUser}
            </span>
            <button onClick={() => setView('login')} className="text-red-500">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {view === 'inventory' ? (
          <>
            <div className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                <input 
                  type="text" placeholder="Αναζήτηση..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setShowAddProduct(true)}
                className="bg-blue-600 text-white p-2 rounded-xl shadow-lg hover:bg-blue-700"
              >
                <Plus size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products
                .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(p => (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
                  <div className="h-48 bg-gray-200 relative">
                    {p.image ? (
                      <img src={p.image} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="text-gray-400" size={40}/></div>
                    )}
                    <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded-lg text-xs">
                      {p.category}
                    </div>
                  </div>
                  <div className="p-4 flex-1">
                    <h3 className="font-bold text-gray-800 text-lg mb-1">{p.name}</h3>
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-2xl font-black text-blue-600">
                        {p.quantity} <span className="text-sm font-normal text-gray-500">{p.unit}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => updateQuantity(p.id, p.name, p.quantity, -1)}
                          className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:bg-red-50 hover:border-red-200"
                        >
                          <Minus size={20} />
                        </button>
                        <button 
                          onClick={() => updateQuantity(p.id, p.name, p.quantity, 1)}
                          className="w-10 h-10 rounded-full border-2 border-blue-600 flex items-center justify-center text-blue-600 hover:bg-blue-50"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xl font-bold mb-4">Ιστορικό Κινήσεων</h2>
            {history.map((h: any) => (
              <div key={h.id} className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4">
                <div className={`w-2 h-12 rounded-full ${h.type === 'add' ? 'bg-green-500' : h.type === 'remove' ? 'bg-red-500' : 'bg-blue-500'}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-gray-800">{h.product}</span>
                    <span className="text-[10px] text-gray-400">{formatDate(h.timestamp || h.created_at)}</span>
                  </div>
                  <div className="text-sm text-gray-600">{h.details}</div>
                  <div className="text-[10px] text-blue-500 font-bold uppercase mt-1">ΑΠΟ: {h.user}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-10">
        <button onClick={() => setView('inventory')} className={`flex flex-col items-center ${view === 'inventory' ? 'text-blue-600' : 'text-gray-400'}`}>
          <Package size={24} />
          <span className="text-[10px] font-bold">Αποθήκη</span>
        </button>
        <button onClick={() => setView('history')} className={`flex flex-col items-center ${view === 'history' ? 'text-blue-600' : 'text-gray-400'}`}>
          <History size={24} />
          <span className="text-[10px] font-bold">Ιστορικό</span>
        </button>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-6">Νέο Προϊόν</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Φωτογραφία</label>
                <div className="flex items-center justify-center w-full">
                  <label className="w-full flex flex-col items-center px-4 py-6 bg-gray-50 text-blue rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100">
                    {newProduct.image ? (
                      <img src={newProduct.image} className="h-32 object-contain" alt="" />
                    ) : (
                      <Upload className="w-8 h-8 text-gray-400" />
                    )}
                    <span className="mt-2 text-sm text-gray-500">Επιλογή εικόνας</span>
                    <input type='file' className="hidden" onChange={handleFileUpload} accept="image/*" />
                  </label>
                </div>
              </div>
              <input 
                type="text" placeholder="Όνομα Προϊόντος"
                className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500"
                value={newProduct.name}
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-3">
                <select 
                  className="w-full p-3 bg-gray-50 border-none rounded-xl"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                  className="w-full p-3 bg-gray-50 border-none rounded-xl"
                  value={newProduct.unit}
                  onChange={(e) => setNewProduct({...newProduct, unit: e.target.value})}
                >
                  <option value="τμχ">Τεμάχια</option>
                  <option value="μέτρα">Μέτρα</option>
                  <option value="σετ">Σετ</option>
                </select>
              </div>
              <input 
                type="number" placeholder="Αρχική Ποσότητα"
                className="w-full p-3 bg-gray-50 border-none rounded-xl"
                value={newProduct.quantity}
                onChange={(e) => setNewProduct({...newProduct, quantity: e.target.value})}
              />
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={addProduct}
                  className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg"
                >
                  Αποθήκευση
                </button>
                <button 
                  onClick={() => setShowAddProduct(false)}
                  className="flex-1 bg-gray-100 text-gray-600 p-4 rounded-xl font-bold"
                >
                  Άκυρο
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryApp;