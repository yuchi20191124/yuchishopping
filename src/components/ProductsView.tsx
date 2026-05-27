/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Check, 
  Tag, 
  User, 
  Layers, 
  FileText 
} from 'lucide-react';
import { Character, Series, Product } from '../types';

interface ProductsViewProps {
  chars: Character[];
  series: Series[];
  products: Product[];
  saveChars: (chars: Character[]) => void;
  saveSeries: (series: Series[]) => void;
  saveProducts: (products: Product[]) => void;
  expandProduct: (product: Product) => string;
}

export default function ProductsView({
  chars,
  series,
  products,
  saveChars,
  saveSeries,
  saveProducts,
  expandProduct
}: ProductsViewProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'chars' | 'series'>('products');

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div>
        <h1 className="font-sans font-bold text-2xl text-gray-900 tracking-tight">
          商品品項管理
        </h1>
        <p className="text-gray-500 text-xs mt-1">
          維護您的常用角色名單、盲盒與商品系列庫。在這裡整合配置好，客戶下單與預購串聯時一鍵帶入，省下大量手打字時間！
        </p>
      </div>

      {/* Styled tabs row */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-5 py-3 text-xs font-semibold tracking-wider border-b-2 select-none cursor-pointer transition-all ${
            activeTab === 'products'
              ? 'border-[#3A72A0] text-[#3A72A0] font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
          id="tab-btn-products"
        >
          ◇ 商品組合
        </button>
        <button
          onClick={() => setActiveTab('chars')}
          className={`px-5 py-3 text-xs font-semibold tracking-wider border-b-2 select-none cursor-pointer transition-all ${
            activeTab === 'chars'
              ? 'border-[#3A72A0] text-[#3A72A0] font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
          id="tab-btn-chars"
        >
          ◇ 角色名單庫
        </button>
        <button
          onClick={() => setActiveTab('series')}
          className={`px-5 py-3 text-[#3A72A0] text-xs font-semibold tracking-wider border-b-2 select-none cursor-pointer transition-all ${
            activeTab === 'series'
              ? 'border-[#3A72A0] text-[#3A72A0] font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
          id="tab-btn-series"
        >
          ◇ 系列庫
        </button>
      </div>

      {/* Sub-panels */}
      {activeTab === 'chars' && (
        <LibraryEditor 
          title="角色" 
          items={chars} 
          onSave={saveChars} 
          placeholder="例如：RJ, Koya, Shooky, Tata..." 
        />
      )}

      {activeTab === 'series' && (
        <LibraryEditor 
          title="系列" 
          items={series} 
          onSave={saveSeries} 
          placeholder="例如：BT21 2025櫻花季, BT21 露營系列..." 
        />
      )}

      {activeTab === 'products' && (
        <ProductsEditor 
          chars={chars} 
          series={series} 
          products={products} 
          onSave={saveProducts} 
          expandProduct={expandProduct} 
        />
      )}
    </div>
  );
}

/* Reusable Library Editor for chars / series with batch uploads */
interface LibraryEditorProps {
  title: string;
  items: { id: string; name: string }[];
  onSave: (items: { id: string; name: string }[]) => void;
  placeholder: string;
}

function LibraryEditor({ title, items, onSave, placeholder }: LibraryEditorProps) {
  const [mode, setMode] = useState<'single' | 'batch' | null>(null);
  const [name, setName] = useState('');
  const [batchText, setBatchText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCancel = () => {
    setMode(null);
    setName('');
    setBatchText('');
    setEditingId(null);
  };

  const handleSaveSingle = () => {
    if (!name.trim()) return;
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    onSave([...items, { id: newId, name: name.trim() }]);
    setName(''); // keep input open for consecutive entries
  };

  const handleSaveBatch = () => {
    const rawNames = batchText.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
    if (rawNames.length === 0) return;
    
    // Skip duplicate names already in database
    const duplicates = rawNames.filter(n => items.some(i => i.name.toLowerCase() === n.toLowerCase()));
    const unique = rawNames.filter(n => !items.some(i => i.name.toLowerCase() === n.toLowerCase()));

    const news = unique.map((n, idx) => ({
      id: (Date.now() + idx).toString(36) + Math.random().toString(36).slice(2, 6),
      name: n
    }));

    onSave([...items, ...news]);
    setBatchText('');
    setMode(null);

    if (duplicates.length > 0) {
      alert(`已自動跳過 ${duplicates.length} 筆重複的名單: ${duplicates.join(', ')}`);
    }
  };

  const startEdit = (id: string, currentVal: string) => {
    setEditingId(id);
    setEditName(currentVal);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    onSave(items.map(i => i.id === editingId ? { ...i, name: editName.trim() } : i));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm(`確定要刪除此 ${title} 嗎？此操作無法還原。`)) {
      onSave(items.filter(i => i.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-sans">
          已登錄 {items.length} 筆{title}數據
        </span>
        
        <div className="flex gap-2">
          <button
            onClick={() => setMode(mode === 'single' ? null : 'single')}
            className={`px-3.5 h-10 text-xs font-semibold rounded-xl border select-none transition-all cursor-pointer ${
              mode === 'single' ? 'bg-[#3A72A0] text-white border-[#3A72A0]' : 'bg-white text-gray-600 border-[#BEB8AE]'
            }`}
            id={`btn-add-mode-single-${title}`}
          >
            + 單筆新增
          </button>
          <button
            onClick={() => setMode(mode === 'batch' ? null : 'batch')}
            className={`px-3.5 h-10 text-xs font-semibold rounded-xl border select-none transition-all cursor-pointer ${
              mode === 'batch' ? 'bg-[#3A72A0] text-white border-[#3A72A0]' : 'bg-white text-gray-600 border-[#BEB8AE]'
            }`}
            id={`btn-add-mode-batch-${title}`}
          >
            + 批次匯入
          </button>
        </div>
      </div>

      {/* Forms Single */}
      {mode === 'single' && (
        <div className="bg-white border border-[#BEB8AE] p-4 rounded-xl space-y-3 shadow-sm animate-fade-in">
          <label className="text-[10px] text-gray-400 font-mono tracking-wider block uppercase font-bold">
            新增單筆{title}（按下 Enter 可以連續快存物件）
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="輸入名稱..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveSingle();
                if (e.key === 'Escape') handleCancel();
              }}
              className="flex-1 px-3.5 h-10 border border-[#BEB8AE]/80 focus:border-[#3A72A0] rounded-xl text-xs outline-none"
              autoFocus
              id={`inp-single-name-${title}`}
            />
            <button
              onClick={handleSaveSingle}
              className="px-4 bg-[#3A72A0] text-white rounded-xl text-xs font-semibold cursor-pointer active:scale-95"
              id={`btn-save-single-${title}`}
            >
              儲存
            </button>
            <button
              onClick={handleCancel}
              className="px-3 border border-[#BEB8AE] text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer"
              id={`btn-cancel-single-${title}`}
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* Forms Batch */}
      {mode === 'batch' && (
        <div className="bg-white border border-[#BEB8AE] p-4 rounded-xl space-y-3.5 shadow-sm animate-fade-in">
          <div>
            <label className="text-[10px] text-gray-400 font-mono tracking-wider block uppercase font-bold">
              批次新增{title}（用逗號或換行字元切隔開即可）
            </label>
            <p className="text-[10px] text-gray-400 mt-1">例如複製：RJ , Chimmy , Shooky</p>
          </div>
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder={placeholder}
            rows={5}
            className="w-full p-3 border border-[#BEB8AE]/80 focus:border-[#3A72A0] rounded-xl text-xs outline-none resize-y font-sans leading-relaxed"
            autoFocus
            id={`inp-batch-text-${title}`}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveBatch}
              className="px-4 h-10 bg-[#3A72A0] text-white rounded-xl text-xs font-semibold cursor-pointer active:scale-95"
              id={`btn-save-batch-${title}`}
            >
              完成批次存檔
            </button>
            <button
              onClick={handleCancel}
              className="px-3 h-10 border border-[#BEB8AE] text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer"
              id={`btn-cancel-batch-${title}`}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Table Index List */}
      <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            您尚未登錄任何{title}數據資料。
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
            {items.map((it) => {
              const isEditing = editingId === it.id;
              
              return (
                <div key={it.id} className="p-3 flex items-center justify-between gap-4 bg-[#FFFCF7]/30 hover:bg-[#EDE8DE]/10 transition-colors">
                  {isEditing ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 px-3 h-9 border border-[#3A72A0] bg-white rounded-lg text-xs outline-none"
                        autoFocus
                      />
                      <button
                        onClick={saveEdit}
                        className="h-9 px-3 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        儲存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="h-9 px-3.5 border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {title === '角色' ? (
                          <User className="w-4 h-4 text-amber-600/70" />
                        ) : (
                          <Layers className="w-4 h-4 text-indigo-600/70" />
                        )}
                        <span className="text-gray-950 text-xs font-semibold font-sans">{it.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 h-8">
                        <button
                          onClick={() => startEdit(it.id, it.name)}
                          className="h-full px-2.5 hover:bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                          id={`btn-library-edit-${it.id}`}
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleDelete(it.id)}
                          className="h-full px-2 hover:bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                          id={`btn-library-delete-${it.id}`}
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* Products List combination with Permutations Creator */
interface ProductsEditorProps {
  chars: Character[];
  series: Series[];
  products: Product[];
  onSave: (prods: Product[]) => void;
  expandProduct: (p: Product) => string;
}

function ProductsEditor({ chars, series, products, onSave, expandProduct }: ProductsEditorProps) {
  const [mode, setMode] = useState<'single' | 'combo' | null>(null);
  const [search, setSearch] = useState('');
  
  // Single edit form
  const [singleForm, setSingleForm] = useState<Omit<Product, 'id'>>({
    seriesId: '',
    characterId: '',
    spec: '',
    price: ''
  });

  // Combo permutation form
  const [comboForm, setComboForm] = useState<{
    seriesIds: string[];
    charIds: string[];
    spec: string;
    price: string;
  }>({
    seriesIds: [],
    charIds: [],
    spec: '',
    price: ''
  });

  const handleCancel = () => {
    setMode(null);
    setSingleForm({ seriesId: '', characterId: '', spec: '', price: '' });
    setComboForm({ seriesIds: [], charIds: [], spec: '', price: '' });
  };

  const handleSaveSingle = () => {
    if (!singleForm.seriesId) {
      alert('請先選擇一個系列！');
      return;
    }
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    onSave([...products, { id: newId, ...singleForm }]);
    // clean input values or stay open
    setSingleForm(prev => ({ ...prev, characterId: '', price: '' }));
  };

  const handleSaveCombo = () => {
    if (comboForm.seriesIds.length === 0) {
      alert('請至少勾選一個系列項目！');
      return;
    }
    
    const newProducts: Product[] = [];
    comboForm.seriesIds.forEach((sId, sIdx) => {
      // If characters are unselected, build set with empty character tag
      if (comboForm.charIds.length === 0) {
        newProducts.push({
          id: (Date.now() + sIdx).toString(36) + Math.random().toString(36).slice(2, 6),
          seriesId: sId,
          characterId: '',
          spec: comboForm.spec.trim(),
          price: comboForm.price
        });
      } else {
        comboForm.charIds.forEach((cId, cIdx) => {
          newProducts.push({
            id: (Date.now() + sIdx * 50 + cIdx).toString(36) + Math.random().toString(36).slice(2, 6),
            seriesId: sId,
            characterId: cId,
            spec: comboForm.spec.trim(),
            price: comboForm.price
          });
        });
      }
    });

    onSave([...products, ...newProducts]);
    handleCancel();
  };

  const handleDeleteProduct = (id: string) => {
    if (window.confirm('確定要永久刪除此商品品項？一旦刪除將無法在客戶下單時選用！')) {
      onSave(products.filter(p => p.id !== id));
    }
  };

  const toggleComboSeries = (id: string) => {
    setComboForm(prev => ({
      ...prev,
      seriesIds: prev.seriesIds.includes(id)
        ? prev.seriesIds.filter(x => x !== id)
        : [...prev.seriesIds, id]
    }));
  };

  const toggleComboCharacter = (id: string) => {
    setComboForm(prev => ({
      ...prev,
      charIds: prev.charIds.includes(id)
        ? prev.charIds.filter(x => x !== id)
        : [...prev.charIds, id]
    }));
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!search) return true;
      const sName = series.find((s) => s.id === p.seriesId)?.name || '';
      const cName = chars.find((c) => c.id === p.characterId)?.name || '';
      return (
        sName.toLowerCase().includes(search.toLowerCase()) ||
        cName.toLowerCase().includes(search.toLowerCase()) ||
        p.spec?.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [products, chars, series, search]);

  const previewCount = comboForm.seriesIds.length * (comboForm.charIds.length || 1);

  return (
    <div className="space-y-4">
      {/* Product controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋商品/系列/角色..."
            className="w-full pl-11 pr-4 h-11 border border-[#BEB8AE] focus:border-[#3A72A0] bg-white rounded-xl text-xs outline-none"
            id="product-combo-search"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMode(mode === 'single' ? null : 'single')}
            className={`px-3.5 h-10 text-xs font-semibold rounded-xl border select-none transition-all cursor-pointer hover:bg-gray-50 h-11 ${
              mode === 'single' ? 'bg-[#3A72A0] text-white border-[#3A72A0]' : 'bg-white text-gray-600 border-[#BEB8AE]'
            }`}
            id="btn-single-product-mode"
          >
            + 單筆新增
          </button>
          <button
            onClick={() => setMode(mode === 'combo' ? null : 'combo')}
            className={`px-3.5 h-10 text-xs font-semibold rounded-xl border select-none transition-all cursor-pointer hover:bg-gray-50 h-11 ${
              mode === 'combo' ? 'bg-[#3A72A0] text-white border-[#3A72A0]' : 'bg-white text-gray-600 border-[#BEB8AE]'
            }`}
            id="btn-combo-product-mode"
            title="盲盒成套快速生成器"
          >
            🧩 組合批量生成
          </button>
        </div>
      </div>

      {/* SINGLE FORM ADD */}
      {mode === 'single' && (
        <div className="bg-[#FFFCF7] border border-[#BEB8AE] p-4 rounded-xl shadow-sm space-y-4 animate-fade-in">
          <h4 className="text-xs font-semibold text-[#3A72A0]">🧩 新增單筆商品品項</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div>
              <label className="text-[10px] text-gray-400 block font-bold mb-1.5 font-mono">1. 選擇系列 *</label>
              <select
                value={singleForm.seriesId}
                onChange={(e) => setSingleForm(prev => ({ ...prev, seriesId: e.target.value }))}
                className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl text-xs bg-white text-gray-800"
                id="select-single-series"
              >
                <option value="">選擇系列...</option>
                {series.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block font-bold mb-1.5 font-mono">2. 規格/品名成分</label>
              <input
                type="text"
                value={singleForm.spec}
                onChange={(e) => setSingleForm(prev => ({ ...prev, spec: e.target.value }))}
                placeholder="例如：公仔, 盲盒"
                className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl text-xs bg-white text-gray-800 outline-none"
                id="inp-single-spec"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block font-bold mb-1.5 font-mono">3. 選擇特定角色</label>
              <select
                value={singleForm.characterId}
                onChange={(e) => setSingleForm(prev => ({ ...prev, characterId: e.target.value }))}
                className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl text-xs bg-white text-gray-800"
                id="select-single-char"
              >
                <option value="">不指定角色 (通用/團體)</option>
                {chars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block font-bold mb-1.5 font-mono">4. 代理零售價 / 售價</label>
              <input
                type="number"
                value={singleForm.price}
                onChange={(e) => setSingleForm(prev => ({ ...prev, price: e.target.value }))}
                placeholder="0"
                className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl text-xs bg-white text-gray-800 outline-none"
                id="inp-single-price"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleSaveSingle}
              className="px-4 h-10 bg-[#3A72A0] text-white rounded-xl text-xs font-semibold cursor-pointer active:scale-95"
              id="btn-save-single-product"
            >
              儲存新增
            </button>
            <button
              onClick={handleCancel}
              className="px-3 border border-[#BEB8AE] text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer h-10"
              id="btn-close-single-product"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* DETAILED COMBO BATCH PERMUTATIONS GENERATOR */}
      {mode === 'combo' && (
        <div className="bg-[#FFFCF7] border border-[#BEB8AE] p-4 rounded-xl shadow-sm space-y-4 animate-fade-in text-xs">
          <div>
            <h4 className="text-sm font-semibold text-[#3A72A0] flex items-center gap-1.5">
              <span>🧩 組合式批量商品快速生成器</span>
            </h4>
            <p className="text-gray-500 text-[10px] mt-1 leading-relaxed">
              購物代購通常需要一次建立大量商品（例如一次為櫻花季新增 RJ/Koya/Shooky 等所有角色的鑰匙圈）。
              勾選的多個系列與名單會自動做 <b>交叉乘積</b> 一秒成套產生完畢！
            </p>
          </div>

          {/* 1. Series multiple checkboxes */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 font-bold font-mono tracking-wider uppercase">
              1. 勾選多個商品系列 (必選) :
            </label>
            {series.length === 0 ? (
              <p className="text-rose-500 text-[11px]">您還沒有登錄任何系列物件，請先前往 <b>系列庫</b> 新增！</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50">
                {series.map(s => {
                  const hasSelected = comboForm.seriesIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleComboSeries(s.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer select-none transition-all ${
                        hasSelected 
                          ? 'bg-[#3A72A0] text-white border-[#3A72A0]' 
                          : 'bg-white text-gray-500 border-[#BEB8AE] hover:text-gray-800'
                      }`}
                    >
                      {hasSelected && '✓ '} {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Character multiple checkboxes */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-400 font-bold font-mono tracking-wider uppercase">
              2. 勾選包含的角色名單 (可不選，不選即為無特定角色的通用款) :
            </label>
            {chars.length === 0 ? (
              <p className="text-yellow-600 text-[11px]">無角色。亦可直接於下方設定規格與定價後批量生成系列商品款。</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50">
                {chars.map(c => {
                  const hasSelected = comboForm.charIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleComboCharacter(c.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer select-none transition-all ${
                        hasSelected 
                          ? 'bg-[#3A72A0] text-white border-[#3A72A0]' 
                          : 'bg-white text-gray-500 border-[#BEB8AE] hover:text-gray-800'
                      }`}
                    >
                      {hasSelected && '✓ '} {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Specs and prices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-gray-400 block font-bold mb-1.5">3. 共通規格說明</label>
              <input
                type="text"
                value={comboForm.spec}
                onChange={(e) => setComboForm(p => ({ ...p, spec: e.target.value }))}
                placeholder="例如：鑰匙圈, 盲盒公仔"
                className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl outline-none bg-white font-sans text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block font-bold mb-1.5">4. 共通預設定價</label>
              <input
                type="number"
                value={comboForm.price}
                onChange={(e) => setComboForm(p => ({ ...p, price: e.target.value }))}
                placeholder="例如: 350"
                className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl outline-none bg-white font-sans text-xs"
              />
            </div>
          </div>

          {/* Previews metrics */}
          {comboForm.seriesIds.length > 0 && (
            <div className="p-3 bg-[#EDE8DE] border border-[#BEB8AE]/60 rounded-xl flex items-center justify-between font-sans">
              <span className="font-semibold text-gray-800">
                🧩 本次組合預計一秒生成： <b>{previewCount}</b> 筆商品規格卡檔
              </span>
              <span className="text-gray-400 text-[10px]">
                ({comboForm.seriesIds.length}系列 × {comboForm.charIds.length || 1}角色)
              </span>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleSaveCombo}
              className="px-4 h-10 bg-[#3A72A0] text-white rounded-xl text-xs font-semibold cursor-pointer active:scale-95"
              id="btn-combo-permutation-save"
            >
              一鍵交叉生成
            </button>
            <button
              onClick={handleCancel}
              className="px-3 border border-[#BEB8AE] text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer h-10"
              id="btn-combo-permutation-close"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* PRODUCTS INDEX GRID LIST */}
      <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm">
        {filteredProducts.length === 0 ? (
          <div className="p-16 text-center text-gray-300 text-xs">
            <div className="text-3xl mb-2">◈</div>
            <span>找不到符合條件的商品</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 divide-pink-100/10">
            {filteredProducts.map((p) => {
              const serObj = series.find(s => s.id === p.seriesId);
              const charObj = chars.find(c => c.id === p.characterId);

              return (
                <div key={p.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-[#EDE8DE]/15 transition-colors">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-[#3A72A0] bg-[#3A72A0]/5 px-2 py-0.5 rounded border border-[#3A72A0]/10 shrink-0">
                        {serObj?.name || '未知系列'}
                      </span>
                      {p.spec && (
                        <span className="text-gray-800 font-semibold text-xs py-0.5 px-1 bg-gray-50 border border-gray-100 rounded">
                          {p.spec}
                        </span>
                      )}
                      {charObj?.name && (
                        <span className="text-amber-800 font-bold text-xs py-0.5 px-2 bg-amber-50 border border-amber-100 rounded">
                          {charObj.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-gray-400 font-sans block text-[9px] uppercase tracking-wider">預設售價</span>
                      <span className="font-sans font-bold text-[#3A72A0] text-sm">
                        ${p.price ? parseFloat(p.price).toLocaleString() : '—'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg active:scale-95 transition-all cursor-pointer min-w-[34px] flex items-center justify-center border border-transparent hover:border-rose-100"
                      title="刪除此品項"
                      id={`btn-delete-product-${p.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
