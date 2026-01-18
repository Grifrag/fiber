import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Minus, Package, History, LogOut, Lock, Edit2, Trash2, ShieldCheck, RefreshCw, ArrowRightLeft, Truck } from 'lucide-react';

// --- CONFIG ---
const SUPABASE_URL = 'https://pilqekiyosqqxgwwlupe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ap0muWzyjy8TPIN-jW9xxw_yPINMafR';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const InventoryApp = () => {
  // DATA STATES
  const [products, setProducts] = useState<any[]>([]);
  const [techStock, setTechStock] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // UI STATES
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'inventory' | 'history'>('login');
  const [pin, setPin] = useState('');
  
  // MODAL & ACTION STATES
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({ name: '', category: 'Ίνες', quantity: 0, unit: 'τμχ' });
  const [selectedTech, setSelectedTech] = useState('');
  const [transferQty, setTransferQty] = useState<number>(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: p } = await supabase.from('products').select('*').order('name');
      if (p) setProducts(p);

      const { data: t } = await supabase.from('tech_stock').select('*');
      if (t) setTechStock(t);
      
      const { data: h } = await supabase.from('history').select('*').order('created_at', { ascending: false });
      if (h) setHistory(h);

      const { data: u } = await supabase.from('users').select('*');
      if (u) setUsers(u);
    } catch (err) { console.error(err); }
  };

  const handleLogin = (val: string) => {
    const user = users.find(u => u.pin === val);
    if (user) {
      setCurrentUser(user);
      setView('inventory');
      setPin('');
    }
  };

  // --- ACTIONS ---
  const handleAdminTransfer = async (productName: string, change: number, techName: string, type: 'give' | 'take') => {
    if (change <= 0 || !techName) return alert("Λάθος στοιχεία");
    const adminProd = products.find(p => p.name === productName);
    if (!adminProd) return;
    
    const centralNewQty = type === 'give' ? adminProd.quantity - change : adminProd.quantity + change;
    const { error: mainErr } = await supabase.from('products').update({ quantity: centralNewQty }).eq('id', adminProd.id);
    if (mainErr) return alert("Error Update Admin Stock");

    const techItem = techStock.find(t => t.tech_name === techName && t.product_name === productName);
    if (techItem) {
      const techNewQty = type === 'give' ? techItem.quantity + change : techItem.quantity - change;
      await supabase.from('tech_stock').update({ quantity: techNewQty }).eq('id', techItem.id);
    } else {
      if (type === 'give') {
        await supabase.from('tech_stock').insert([{ tech_name: techName, product_name: productName, quantity: change }]);
      } else {
        return alert("Ο τεχνικός δεν έχει καθόλου από αυτό το υλικό!");
      }
    }

    const msg = type === 'give' ? `Παραλαβή από Admin (${change})` : `Επιστροφή σε Admin (${change})`;
    await supabase.from('history').insert([{ product: productName, user_name: techName, type: type === 'give' ? 'add' : 'remove', details: msg }]);
    loadData(); setTransferQty(0); alert("ΟΚ!");
  };

  const handleTechUsage = async (item: any) => {
    await supabase.from('tech_stock').update({ quantity: item.quantity - 1 }).eq('id', item.id);
    await supabase.from('history').insert([{ product: item.product_name, user_name: currentUser.username, type: 'remove', details: 'Χρήση σε έργο (1)' }]);
    loadData();
  };

  const handleAddNewProduct = async () => {
    await supabase.from('products').insert([newProduct]);
    loadData(); setShowAddProduct(false);
  };

  const saveEdit = async () => {
    const old = products.find(p => p.id === editingProduct.id);
    await supabase.from('products').update({ name: editingProduct.name, quantity: editingProduct.quantity }).eq('id', editingProduct.id);
    await supabase.from('history').insert([{ product: editingProduct.name, user: 'admin', type: 'edit', details: `Admin Edit: ${old.quantity}->${editingProduct.quantity}` }]);
    setEditingProduct(null); loadData();
  };

  // --- VIEWS ---
  const isAdmin = currentUser?.role === 'admin';
  const filteredHistory = isAdmin ? history : history.filter(h => h.user_name === currentUser?.username);
  const myVanStock = techStock.filter(t => t.tech_name === currentUser?.username && t.quantity > 0);

  // LOGIN SCREEN (Μένει κεντραρισμένη)
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center shadow-2xl">
          <div className="bg-blue-600 p-4 rounded-full mb-4 inline-block"><Lock className="text-white" size={32} /></div>
          <h1 className="text-2xl font-black mb-6 text-gray-800">BFB SYSTEM</h1>
          <input type="password" placeholder="PIN" className="w-full p-4 bg-gray-100 rounded-2xl text-center text-3xl font-bold text-gray-900" maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value); if (e.target.value.length === 6) handleLogin(e.target.value); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-28 font-sans">
      {/* HEADER: Πιάνει όλο το πλάτος τώρα */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-20 border-b">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 font-black text-blue-600 text-sm md:text-base">
            <ShieldCheck size={20}/> <span>{currentUser.username.toUpperCase()} ({isAdmin ? 'HQ' : 'VAN'})</span>
          </div>
          <div className="flex gap-2">
             <button onClick={loadData} className="p-2 text-blue-500 bg-blue-50 rounded-full hover:bg-blue-100"><RefreshCw size={20}/></button>
             <button onClick={() => setView('login')} className="p-2 text-red-500 bg-red-50 rounded-full hover:bg-red-100"><LogOut size={20}/></button>
          </div>
        </div>
      </div>

      {/* CONTAINER: Μεγαλώνει σε μεγάλες οθόνες (max-w-7xl) */}
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        
        {isAdmin && view === 'inventory' && (
          <div className="flex justify-end">
            <button onClick={() => setShowAddProduct(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg flex items-center gap-2 hover:bg-blue-700 transition">
              <Plus size={20}/> ΝΕΟ ΥΛΙΚΟ
            </button>
          </div>
        )}

        {view === 'inventory' && (
          // GRID SYSTEM: 1 στήλη σε κινητό, 2 σε tablet, 3 σε PC
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isAdmin ? products.map(p => (
              <div key={p.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between h-full hover:shadow-md transition">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 line-clamp-1" title={p.name}>{p.name}</h3>
                      <span className="text-[10px] bg-gray-100 px-2 py-1 rounded font-bold text-gray-500 uppercase">{p.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-gray-800">{p.quantity}</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase">{p.unit}</div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><ArrowRightLeft size={12}/> Μεταφορα</p>
                    <div className="flex gap-2">
                      <select className="flex-1 p-2 bg-white rounded-xl text-sm font-medium text-gray-900 border-none shadow-sm" onChange={(e) => setSelectedTech(e.target.value)}>
                        <option value="">Τεχνικός...</option>
                        {users.filter(u => u.role !== 'admin').map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                      </select>
                      <input type="number" placeholder="0" className="w-14 p-2 bg-white rounded-xl text-center font-bold text-sm text-gray-900 shadow-sm" onChange={(e) => setTransferQty(Number(e.target.value))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAdminTransfer(p.name, transferQty, selectedTech, 'give')} className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-bold text-xs shadow-md hover:bg-blue-700">ΔΩΣΕ</button>
                      <button onClick={() => handleAdminTransfer(p.name, transferQty, selectedTech, 'take')} className="flex-1 bg-orange-500 text-white py-2 rounded-xl font-bold text-xs shadow-md hover:bg-orange-600">ΠΑΡΕ</button>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center px-1 mt-4 border-t pt-3">
                   <button onClick={() => setEditingProduct(p)} className="text-blue-500 font-bold text-[10px] uppercase flex gap-1 hover:text-blue-700"><Edit2 size={12}/> EDIT</button>
                   <button onClick={async () => { if(window.confirm("Διαγραφή;")) { await supabase.from('products').delete().eq('id', p.id); loadData(); } }} className="text-gray-300 font-bold text-[10px] uppercase hover:text-red-500"><Trash2 size={12}/></button>
                </div>
              </div>
            )) : (
              myVanStock.length > 0 ? myVanStock.map(item => (
                <div key={item.id} className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 line-clamp-2">{item.product_name}</h3>
                      <span className="mt-1 text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold uppercase flex w-fit items-center gap-1"><Truck size={10}/> VAN STOCK</span>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-blue-600">{item.quantity}</div>
                    </div>
                  </div>
                  <button onClick={() => handleTechUsage(item)} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm active:bg-red-100 hover:bg-red-50 transition">
                    <Minus size={20}/> ΚΑΤΑΝΑΛΩΣΗ (1)
                  </button>
                </div>
              )) : <div className="col-span-full text-center py-20 text-gray-400 font-bold">Το Βανάκι σου είναι άδειο.</div>
            )}
          </div>
        )}

        {view === 'history' && (
          // GRID ΓΙΑ ΙΣΤΟΡΙΚΟ: 1 στήλη κινητό, 2 PC
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHistory.map((h: any) => (
              <div key={h.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 text-gray-900 hover:shadow-md transition">
                <div className={`w-1.5 h-10 rounded-full ${h.type === 'remove' ? 'bg-red-400' : h.type === 'add' ? 'bg-green-400' : 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold truncate text-sm" title={h.product}>{h.product}</span>
                    <span className="text-[9px] text-gray-400 font-black">{new Date(h.created_at).toLocaleDateString('el-GR')}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 font-medium line-clamp-2" title={h.details}>{h.details}</div>
                  <div className="text-[9px] font-black text-blue-500 mt-2 uppercase border-t border-gray-50 pt-1">USER: {h.user_name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALS (Μένουν κεντραρισμένα και μικρά) */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-xl font-black text-gray-900">Edit Product</h2>
            <input type="text" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-900" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
            <input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold text-gray-900" value={editingProduct.quantity} onChange={e => setEditingProduct({...editingProduct, quantity: Number(e.target.value)})} />
            <div className="flex gap-2"><button onClick={saveEdit} className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold">SAVE</button><button onClick={() => setEditingProduct(null)} className="flex-1 bg-gray-100 text-gray-500 p-4 rounded-xl font-bold">CANCEL</button></div>
          </div>
        </div>
      )}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-xl font-black text-gray-900">New Product</h2>
            <input type="text" placeholder="Name" className="w-full p-4 bg-gray-50 rounded-xl font-bold text-gray-900" onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
            <input type="number" placeholder="Qty" className="w-full p-4 bg-gray-50 rounded-xl font-bold text-gray-900" onChange={e => setNewProduct({...newProduct, quantity: Number(e.target.value)})} />
            <button onClick={handleAddNewProduct} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">ADD</button><button onClick={() => setShowAddProduct(false)} className="w-full text-gray-400 font-bold py-2">CANCEL</button>
          </div>
        </div>
      )}

      {/* FOOTER NAV */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-10 py-5 rounded-full shadow-2xl border border-gray-200 flex gap-16 z-40 transition-transform hover:scale-105">
        <button onClick={() => setView('inventory')} className={view === 'inventory' ? 'text-blue-600 scale-125 transition' : 'text-gray-300 hover:text-gray-500 transition'}><Package size={28}/></button>
        <button onClick={() => setView('history')} className={view === 'history' ? 'text-blue-600 scale-125 transition' : 'text-gray-300 hover:text-gray-500 transition'}><History size={28}/></button>
      </div>
    </div>
  );
};

export default InventoryApp;