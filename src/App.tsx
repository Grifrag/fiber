import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Minus, Package, History, LogOut, Lock, Edit2, Trash2, ShieldCheck, RefreshCw, ArrowRightLeft, Truck } from 'lucide-react';

// --- CONFIG ---
const SUPABASE_URL = 'https://pilqekiyosqqxgwwlupe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ap0muWzyjy8TPIN-jW9xxw_yPINMafR';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const InventoryApp = () => {
  // Αποθήκες
  const [products, setProducts] = useState<any[]>([]);       // Κεντρική (Admin)
  const [techStock, setTechStock] = useState<any[]>([]);     // Βανάκια (Users)
  
  // Γενικά
  const [history, setHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'inventory' | 'history'>('login');
  const [pin, setPin] = useState('');

  // Admin Tools
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

  // --- ADMIN: ΔΙΝΕΙ Ή ΠΑΙΡΝΕΙ (Επηρεάζει και τους 2 πίνακες) ---
  const handleAdminTransfer = async (productName: string, change: number, techName: string, type: 'give' | 'take') => {
    if (change <= 0 || !techName) return alert("Λάθος στοιχεία");
    
    // 1. Ενημέρωση Κεντρικής (Products)
    const adminProd = products.find(p => p.name === productName);
    if (!adminProd) return;
    
    // Αν ΔΙΝΩ: -change, Αν ΠΑΙΡΝΩ: +change
    const centralNewQty = type === 'give' ? adminProd.quantity - change : adminProd.quantity + change;
    
    const { error: mainErr } = await supabase.from('products')
      .update({ quantity: centralNewQty })
      .eq('id', adminProd.id);

    if (mainErr) return alert("Error Update Admin Stock");

    // 2. Ενημέρωση Τεχνικού (Tech Stock)
    const techItem = techStock.find(t => t.tech_name === techName && t.product_name === productName);
    
    if (techItem) {
      // Υπάρχει -> Update
      const techNewQty = type === 'give' ? techItem.quantity + change : techItem.quantity - change;
      await supabase.from('tech_stock').update({ quantity: techNewQty }).eq('id', techItem.id);
    } else {
      // Δεν υπάρχει -> Insert (Μόνο αν δίνουμε)
      if (type === 'give') {
        await supabase.from('tech_stock').insert([{ tech_name: techName, product_name: productName, quantity: change }]);
      } else {
        return alert("Ο τεχνικός δεν έχει καθόλου από αυτό το υλικό!");
      }
    }

    // 3. Ιστορικό
    const msg = type === 'give' ? `Παραλαβή από Admin (${change})` : `Επιστροφή σε Admin (${change})`;
    await supabase.from('history').insert([{ 
      product: productName, 
      user_name: techName, // Το βλέπει ο τεχνικός
      type: type === 'give' ? 'add' : 'remove', 
      details: msg 
    }]);

    loadData();
    alert("Η μεταφορά έγινε!");
    setTransferQty(0);
  };

  // --- USER: ΚΑΤΑΝΑΛΩΣΗ (Επηρεάζει ΜΟΝΟ τον πίνακα tech_stock) ---
  const handleTechUsage = async (item: any) => {
    await supabase.from('tech_stock')
      .update({ quantity: item.quantity - 1 })
      .eq('id', item.id);

    await supabase.from('history').insert([{
      product: item.product_name,
      user_name: currentUser.username,
      type: 'remove',
      details: 'Χρήση σε έργο (1)'
    }]);
    
    loadData();
  };

  // Helpers
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

  const isAdmin = currentUser?.role === 'admin';
  const filteredHistory = isAdmin ? history : history.filter(h => h.user_name === currentUser?.username);
  const myVanStock = techStock.filter(t => t.tech_name === currentUser?.username && t.quantity > 0);

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl w-full max-w-md text-center">
          <div className="bg-blue-600 p-4 rounded-full mb-4 inline-block"><Lock className="text-white" size={32} /></div>
          <h1 className="text-2xl font-black mb-6 text-gray-800">BFB SYSTEM</h1>
          <input type="password" placeholder="PIN" className="w-full p-4 bg-gray-100 rounded-2xl text-center text-3xl font-bold text-gray-900" maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value); if (e.target.value.length === 6) handleLogin(e.target.value); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-28 font-sans">
      <div className="bg-white p-4 shadow-sm sticky top-0 z-20 flex justify-between items-center border-b">
        <div className="flex items-center gap-2 font-black text-blue-600 text-xs">
          <ShieldCheck size={18}/> <span>{currentUser.username.toUpperCase()} ({isAdmin ? 'HQ' : 'VAN'})</span>
        </div>
        <div className="flex gap-2">
           <button onClick={loadData} className="p-2 text-blue-500 bg-blue-50 rounded-full"><RefreshCw size={20}/></button>
           <button onClick={() => setView('login')} className="p-2 text-red-500 bg-red-50 rounded-full"><LogOut size={20}/></button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-5">
        {isAdmin && view === 'inventory' && (
          <button onClick={() => setShowAddProduct(true)} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2">
            <Plus size={20}/> ΝΕΟ ΥΛΙΚΟ (ΚΕΝΤΡΙΚΗ)
          </button>
        )}

        {view === 'inventory' && (
          <>
            {/* --- ADMIN VIEW: ΚΕΝΤΡΙΚΗ ΑΠΟΘΗΚΗ --- */}
            {isAdmin ? products.map(p => (
              <div key={p.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{p.name}</h3>
                    <span className="text-[10px] bg-gray-100 px-2 py-1 rounded font-bold text-gray-500 uppercase">{p.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-gray-800">{p.quantity}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">{p.unit}</div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1"><ArrowRightLeft size={12}/> Μεταφορα σε Τεχνικο</p>
                  <div className="flex gap-2">
                    <select className="flex-1 p-3 bg-white rounded-xl text-sm font-medium text-gray-900" onChange={(e) => setSelectedTech(e.target.value)}>
                      <option value="">Τεχνικός...</option>
                      {users.filter(u => u.role !== 'admin').map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
                    </select>
                    <input type="number" placeholder="0" className="w-16 p-3 bg-white rounded-xl text-center font-bold text-sm text-gray-900" onChange={(e) => setTransferQty(Number(e.target.value))} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAdminTransfer(p.name, transferQty, selectedTech, 'give')} className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold text-xs shadow-md">ΔΩΣΕ</button>
                    <button onClick={() => handleAdminTransfer(p.name, transferQty, selectedTech, 'take')} className="flex-1 bg-orange-500 text-white p-3 rounded-xl font-bold text-xs shadow-md">ΠΑΡΕ</button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center px-1 mt-4 border-t pt-2">
                   <button onClick={() => setEditingProduct(p)} className="text-blue-500 font-bold text-[10px] uppercase flex gap-1"><Edit2 size={12}/> EDIT</button>
                   <button onClick={async () => { if(window.confirm("Διαγραφή;")) { await supabase.from('products').delete().eq('id', p.id); loadData(); } }} className="text-gray-300 font-bold text-[10px] uppercase"><Trash2 size={12}/></button>
                </div>
              </div>
            )) : (
              /* --- USER VIEW: VAN STOCK --- */
              myVanStock.length > 0 ? myVanStock.map(item => (
                <div key={item.id} className="bg-white rounded-3xl shadow-sm border border-blue-100 p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{item.product_name}</h3>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold uppercase flex w-fit items-center gap-1"><Truck size={10}/> VAN STOCK</span>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-blue-600">{item.quantity}</div>
                    </div>
                  </div>
                  <button onClick={() => handleTechUsage(item)} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm active:bg-red-100 transition">
                    <Minus size={20}/> ΚΑΤΑΝΑΛΩΣΗ (1)
                  </button>
                </div>
              )) : <div className="text-center py-20 text-gray-400 font-bold">Το Βανάκι σου είναι άδειο.<br/><span className="text-xs font-normal">Ζήτα υλικά από τον Admin.</span></div>
            )}
          </>
        )}

        {/* --- HISTORY VIEW --- */}
        {view === 'history' && (
          <div className="space-y-3">
            {filteredHistory.map((h: any) => (
              <div key={h.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 text-gray-900">
                <div className={`w-1.5 h-10 rounded-full ${h.type === 'remove' ? 'bg-red-400' : h.type === 'add' ? 'bg-green-400' : 'bg-blue-400'}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="font-bold truncate text-sm">{h.product}</span>
                    <span className="text-[9px] text-gray-400 font-black">{new Date(h.created_at).toLocaleDateString('el-GR')}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 font-medium">{h.details}</div>
                  <div className="text-[9px] font-black text-blue-500 mt-1 uppercase border-t border-gray-50 pt-1">USER: {h.user_name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALS */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-black">Edit</h2>
            <input type="text" className="w-full p-3 bg-gray-50 rounded-xl font-bold" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
            <input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold" value={editingProduct.quantity} onChange={e => setEditingProduct({...editingProduct, quantity: Number(e.target.value)})} />
            <div className="flex gap-2"><button onClick={saveEdit} className="flex-1 bg-blue-600 text-white p-4 rounded-xl font-bold">SAVE</button><button onClick={() => setEditingProduct(null)} className="flex-1 bg-gray-100 text-gray-500 p-4 rounded-xl font-bold">CANCEL</button></div>
          </div>
        </div>
      )}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-black">New Product</h2>
            <input type="text" placeholder="Name" className="w-full p-4 bg-gray-50 rounded-xl font-bold" onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
            <input type="number" placeholder="Qty" className="w-full p-4 bg-gray-50 rounded-xl font-bold" onChange={e => setNewProduct({...newProduct, quantity: Number(e.target.value)})} />
            <button onClick={handleAddNewProduct} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold">ADD</button><button onClick={() => setShowAddProduct(false)} className="w-full text-gray-400 font-bold py-2">CANCEL</button>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-10 py-5 rounded-full shadow-2xl border border-gray-200 flex gap-16 z-40">
        <button onClick={() => setView('inventory')} className={view === 'inventory' ? 'text-blue-600 scale-110' : 'text-gray-300'}><Package size={28}/></button>
        <button onClick={() => setView('history')} className={view === 'history' ? 'text-blue-600 scale-110' : 'text-gray-300'}><History size={28}/></button>
      </div>
    </div>
  );
};

export default InventoryApp;