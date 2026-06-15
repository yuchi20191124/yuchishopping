/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Search, 
  Trash2, 
  Clipboard, 
  CheckCircle, 
  Layers, 
  Package, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { 
  ClientOrder, 
  PreOrder, 
  Shipment, 
  Product, 
  Character, 
  Series, 
  CoItem,
  Customer
} from '../types';

/* ── Levenshtein Distance for fuzzy matching ── */
function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

/* ── HELPERS: Generate Unique Standard ID ── */
const mkId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const EMPTY_CO_ITEM = (): CoItem => ({
  id: mkId(),
  productId: '',
  series: '',
  spec: '',
  character: '',
  qty: 1,
  price: '',
  status: 'pending',
  poId: ''
});

/* ═════ 1. CLIENT ORDER MODAL (CoModal) ═════ */
interface CoModalProps {
  order: ClientOrder | null;
  products: Product[];
  chars: Character[];
  series: Series[];
  customers?: Customer[];
  expandProduct: (p: Product) => string;
  onSave: (co: ClientOrder) => void;
  onClose: () => void;
}

export function CoModal({
  order,
  products,
  chars,
  series,
  customers = [],
  expandProduct,
  onSave,
  onClose
}: CoModalProps) {
  const isEdit = !!order;
  const [form, setForm] = useState<ClientOrder>(() => {
    if (order) {
      return { 
        ...order, 
        customerName: order.customerName || '',
        items: (order.items || []).map(i => ({ ...i })) 
      };
    }
    return {
      id: '',
      customerIG: '',
      customerName: '',
      clientOrdered: false,
      items: [EMPTY_CO_ITEM()],
      notes: '',
      createdAt: ''
    };
  });

  // State for Customer search / matching
  const [focusedField, setFocusedField] = useState<'name' | 'ig' | null>(null);
  const [custSearchVal, setCustSearchVal] = useState('');

  const matchedCustomers = React.useMemo(() => {
    const q = custSearchVal.trim().toLowerCase();
    if (!q) return [];

    const exactMatches: Customer[] = [];
    const startsWithMatches: Customer[] = [];
    const includesMatches: Customer[] = [];
    const fuzzyMatches: Customer[] = [];

    customers.forEach(cust => {
      const name = (cust.name || '').toLowerCase();
      const ig = (cust.customerIG || '').toLowerCase();

      if (name === q || ig === q) {
        exactMatches.push(cust);
      } else if (name.startsWith(q) || ig.startsWith(q)) {
        startsWithMatches.push(cust);
      } else if (name.includes(q) || ig.includes(q)) {
        includesMatches.push(cust);
      } else if (q.length >= 2) {
        const distName = getLevenshteinDistance(name, q);
        const distIg = getLevenshteinDistance(ig, q);
        if (distName <= 2 || distIg <= 2) {
          fuzzyMatches.push(cust);
        }
      }
    });

    const combined = [...exactMatches, ...startsWithMatches, ...includesMatches, ...fuzzyMatches];
    // De-duplicate by id
    const seen = new Set();
    return combined.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).slice(0, 5);
  }, [customers, custSearchVal]);

  // Keep track of keyword searches for each item line index
  const [lineSearch, setLineSearch] = useState<Record<string, string>>({});
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);

  const handleUpdateItem = <K extends keyof CoItem>(itemId: string, key: K, val: CoItem[K]) => {
    setForm(f => ({
      ...f,
      items: f.items.map(i => i.id === itemId ? { ...i, [key]: val } : i)
    }));
  };

  const handleAddItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, EMPTY_CO_ITEM()]
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setForm(f => ({
      ...f,
      items: f.items.filter(i => i.id !== itemId)
    }));
  };

  // When auto-filling matching items
  const handleSelectProduct = (itemId: string, prod: Product) => {
    const sName = series.find(s => s.id === prod.seriesId)?.name || '';
    const cName = chars.find(c => c.id === prod.characterId)?.name || '';
    
    setForm(f => ({
      ...f,
      items: f.items.map(i => i.id === itemId ? {
        ...i,
        productId: prod.id,
        series: sName,
        spec: prod.spec,
        character: cName,
        price: prod.price
      } : i)
    }));

    // Reset autocomplete searches for this line
    setLineSearch(prev => ({ ...prev, [itemId]: '' }));
    setFocusedLineId(null);
  };

  const handleSave = () => {
    const cleanIG = form.customerIG.trim().replace(/^@/, '');
    const cleanName = (form.customerName || '').trim();
    if (!cleanIG && !cleanName) {
      alert('請填寫客戶名字或 IG 帳號！');
      return;
    }
    onSave({ 
      ...form, 
      customerIG: cleanIG || cleanName, 
      customerName: cleanName || cleanIG 
    });
  };

  return (
    <Overlay onClose={onClose} wide>
      <ModalHeader title={isEdit ? '編輯客戶訂單貨夾' : '新增客戶代購訂單'} onClose={onClose} />
      
      <div className="space-y-4 text-xs">
        {/* Customer Autocomplete Section */}
        <div className="bg-[#ede8de]/50 p-4 border border-[#BEB8AE]/60 rounded-xl space-y-3 relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <label className="text-[10px] text-gray-400 block tracking-wider uppercase font-bold mb-1">
                👥 客人名字 / 暱稱 *
              </label>
              <input
                type="text"
                value={form.customerName || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm(f => ({ ...f, customerName: val }));
                  setCustSearchVal(val);
                  setFocusedField('name');
                }}
                onFocus={() => {
                  setFocusedField('name');
                  setCustSearchVal(form.customerName || '');
                }}
                placeholder="例如：小華 / yuchi"
                className="w-full px-3 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold transition-all"
                id="modal-co-customer-name"
              />
            </div>

            <div className="relative">
              <label className="text-[10px] text-gray-400 block tracking-wider uppercase font-bold mb-1">
                📸 Instagram 帳號 *
              </label>
              <input
                type="text"
                value={form.customerIG}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm(f => ({ ...f, customerIG: val }));
                  setCustSearchVal(val);
                  setFocusedField('ig');
                }}
                onFocus={() => {
                  setFocusedField('ig');
                  setCustSearchVal(form.customerIG || '');
                }}
                placeholder="例如：yuchishopping"
                className="w-full px-3 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold transition-all"
                id="modal-co-customer-ig"
              />
            </div>
          </div>

          {/* Customer Autocomplete Suggestions list panel */}
          {focusedField && matchedCustomers.length > 0 && (
            <div className="absolute top-[100%] left-4 right-4 bg-white border-2 border-[#1E1E1E] rounded-xl shadow-xl z-50 divide-y divide-gray-150 mt-1 max-h-48 overflow-y-auto">
              <div className="p-1.5 bg-gray-50 text-[10px] text-gray-400 font-bold block">
                🔍 系統已匹配到相似客戶主檔 (點選快速帶入) ：
              </div>
              {matchedCustomers.map(cust => (
                <div
                  key={cust.id}
                  onClick={() => {
                    setForm(f => ({
                      ...f,
                      customerName: cust.name,
                      customerIG: cust.customerIG
                    }));
                    setFocusedField(null);
                  }}
                  className="p-2.5 hover:bg-gray-100 flex items-center justify-between text-xs cursor-pointer text-gray-900"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#3A72A0]">👤 {cust.name}</span>
                    <span className="text-gray-400">(@{cust.customerIG})</span>
                  </div>
                  {cust.phone && <span className="text-[10px] bg-gray-150 text-gray-600 px-2 py-0.5 rounded font-mono">{cust.phone}</span>}
                </div>
              ))}
            </div>
          )}

          {focusedField && custSearchVal.trim() && matchedCustomers.length === 0 && (
            <div className="absolute top-[100%] left-4 right-4 bg-amber-50 border border-amber-300 rounded-xl shadow-md z-50 p-2 mt-1 text-[11px] text-amber-700 flex items-center gap-1.5">
              <span className="shrink-0">🆕</span>
              <span>「{custSearchVal}」為新名字，儲存後系統將自動加入客戶主檔！</span>
            </div>
          )}

          {/* Click away block overlay for closing autocomplete */}
          {focusedField && (
            <div className="fixed inset-0 z-30 opacity-0 pointer-events-auto" onClick={() => setFocusedField(null)} />
          )}
        </div>

        {/* Ordered multi items block container */}
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-gray-500 font-mono uppercase tracking-wider">
              ◇ 訂單包含的商品品項列表（共 {form.items.length} 品項）:
            </span>
            <button
              onClick={handleAddItem}
              className="flex items-center gap-1 font-bold text-xs text-[#3A72A0] bg-[#3A72A0]/10 px-3 h-9 rounded-xl border border-[#3A72A0]/15 active:scale-95 cursor-pointer hover:bg-[#3A72A0]/20 select-none"
              id="modal-co-add-line-item"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>加一行商品</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {form.items.map((item, idx) => {
              const query = lineSearch[item.id] || '';
              // Show suggestion menu when there's an active query or focused state
              const isSearching = focusedLineId === item.id;
              
              const suggestions = query.trim().length > 0 
                ? products.filter(p => {
                    const sName = series.find(s => s.id === p.seriesId)?.name || '';
                    const cName = chars.find(c => c.id === p.characterId)?.name || '';
                    return [sName, p.spec, cName].some(text => 
                      text.toLowerCase().includes(query.toLowerCase())
                    );
                  }).slice(0, 5)
                : [];

              const currentTotal = (parseFloat(item.price) || 0) * (item.qty || 1);

              return (
                <div 
                  key={item.id} 
                  className="p-3 border border-[#BEB8AE]/70 rounded-xl bg-gray-50 flex flex-col gap-3 relative"
                >
                  {/* Top quick-suggest inputs block */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 relative">
                      <label className="text-[9px] text-[#3A72A0] block font-bold mb-1">
                        1. 搜尋商品品項模板帶入 (或直接手動打字)
                      </label>
                      <input
                        type="text"
                        value={query || [item.series, item.spec, item.character].filter(Boolean).join(' · ')}
                        onChange={(e) => {
                          setLineSearch(prev => ({ ...prev, [item.id]: e.target.value }));
                          setFocusedLineId(item.id);
                        }}
                        onFocus={() => {
                          setFocusedLineId(item.id);
                          setLineSearch(prev => ({ ...prev, [item.id]: '' }));
                        }}
                        placeholder="搜尋系列、盲盒品名、角色帶入..."
                        className="w-full px-3 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none"
                        id={`inp-modal-co-search-${item.id}`}
                      />

                      {/* Dropdown suggestions map */}
                      {isSearching && suggestions.length > 0 && (
                        <div className="absolute top-[102%] left-0 right-0 max-h-56 overflow-y-auto bg-white border-2 border-[#1E1E1E] rounded-xl shadow-xl z-50 divide-y divide-gray-100">
                          {suggestions.map(p => {
                            const descName = expandProduct(p);
                            return (
                              <div
                                key={p.id}
                                onClick={() => handleSelectProduct(item.id, p)}
                                className="p-2.5 font-medium hover:bg-gray-100 flex items-center justify-between text-xs cursor-pointer text-gray-900"
                              >
                                <span>{descName}</span>
                                <span className="font-bold text-[#3A72A0] font-sans shrink-0">${p.price}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Manual edits fields in case template is not set */}
                    <div className="flex gap-2">
                      <div className="w-24">
                        <label className="text-[9px] text-[#3A72A0] block font-bold mb-1">單價 ($)</label>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => handleUpdateItem(item.id, 'price', e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold text-center"
                          id={`inp-modal-co-price-${item.id}`}
                        />
                      </div>

                      <div className="w-18">
                        <label className="text-[9px] text-[#3A72A0] block font-bold mb-1">數量</label>
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => handleUpdateItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                          className="w-full px-2.5 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold text-center"
                          id={`inp-modal-co-qty-${item.id}`}
                        />
                      </div>
                    </div>

                    <div className="shrink-0 text-right min-w-[56px] pt-4">
                      <span className="text-[10px] text-gray-400 block font-mono">小計</span>
                      <span className="font-mono font-bold text-sm text-[#3A72A0]">
                        ${currentTotal.toLocaleString()}
                      </span>
                    </div>

                    {form.items.length > 1 && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="mt-4 p-2 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-150 cursor-pointer min-w-[42px] h-10 flex items-center justify-center shrink-0"
                        title="移除此行"
                        id={`btn-remove-line-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Manual details overrides inputs */}
                  {!item.productId && (
                    <div className="grid grid-cols-3 gap-2 border-t border-gray-200/50 pt-2.5">
                      <div>
                        <input
                          type="text"
                          value={item.series}
                          onChange={(e) => handleUpdateItem(item.id, 'series', e.target.value)}
                          placeholder="系列偏好 (例: 露營系列)"
                          className="w-full h-8 px-2 border border-gray-200 focus:border-[#3A72A0] rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={item.spec}
                          onChange={(e) => handleUpdateItem(item.id, 'spec', e.target.value)}
                          placeholder="規格 (例: 徽章/立牌)"
                          className="w-full h-8 px-2 border border-gray-200 focus:border-[#3A72A0] rounded-lg text-[11px]"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={item.character}
                          onChange={(e) => handleUpdateItem(item.id, 'character', e.target.value)}
                          placeholder="角色 (例: Mang)"
                          className="w-full h-8 px-2 border border-gray-200 focus:border-[#3A72A0] rounded-lg text-[11px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sum totals */}
        <div className="flex items-center justify-between p-3.5 bg-[#FFFCF7] border-2 border-[#1E1E1E] rounded-xl font-sans">
          <span className="font-bold text-gray-700">🛒 本次訂單預估營業額合計：</span>
          <span className="text-xl font-bold text-[#3A72A0]">
            ${form.items.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (item.qty || 1)), 0).toLocaleString()}
          </span>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] text-gray-400 font-mono tracking-wider block uppercase font-bold mb-1.5">
            備註事項 (例: 寄送地址、滿額贈、包裏特殊拆盒等需求限制)
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="有些客人可能需要特定小禮物或是多盒包裝限制..."
            rows={2}
            className="w-full p-3 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl bg-white text-gray-800 outline-none leading-relaxed resize-y"
            id="modal-co-notes"
          />
        </div>

        {/* Action Button Drawers */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 h-12 bg-[#3A72A0] hover:bg-[#2e5d85] active:scale-95 text-white text-sm font-semibold rounded-xl select-none cursor-pointer flex items-center justify-center gap-1.5"
            id="btn-co-modal-save"
          >
            <CheckCircle className="w-5 h-5" />
            <span>儲存訂單檔案</span>
          </button>
          
          <button
            onClick={onClose}
            className="px-5 h-12 border border-[#BEB8AE] text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-semibold select-none cursor-pointer"
            id="btn-co-modal-close"
          >
            取消
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ═════ 2. PRE-ORDER PURCHASE MODAL (PoModal) ═════ */
interface PoModalProps {
  po: PreOrder | null;
  cos: ClientOrder[];
  expandProduct: (p: Product) => string;
  onSave: (po: PreOrder) => void;
  onClose: () => void;
}

export function PoModal({
  po,
  cos,
  expandProduct,
  onSave,
  onClose
}: PoModalProps) {
  const isEdit = !!po;
  const [form, setForm] = useState<PreOrder>(() => {
    if (po) {
      return { 
        ...po, 
        linkedItems: [...(po.linkedItems || [])] 
      };
    }
    return {
      id: '',
      name: '',
      stage: 'ordered',
      cardAmount: '',
      notes: '',
      linkedItems: [],
      createdAt: ''
    };
  });

  const handleToggleLink = (coId: string, itemId: string) => {
    const isLinked = form.linkedItems.some(li => li.coId === coId && li.itemId === itemId);
    setForm(f => ({
      ...f,
      linkedItems: isLinked
        ? f.linkedItems.filter(li => !(li.coId === coId && li.itemId === itemId))
        : [...f.linkedItems, { coId, itemId }]
    }));
  };

  // Find client orders holding items that are pending (or already bound to this PO edit state)
  const eligibleCos = cos.filter(c => 
    c.items?.some(i => i.status === 'pending' || (isEdit && i.poId === po.id))
  );

  const handleSave = () => {
    if (!form.name.trim()) {
      alert('請填寫此預購採購單名稱！');
      return;
    }
    onSave({ ...form, name: form.name.trim() });
  };

  return (
    <Overlay onClose={onClose} wide>
      <ModalHeader title={isEdit ? '編輯海外採購預購單' : '建立海外拍下/預購單'} onClose={onClose} />

      <div className="space-y-4 text-xs">
        {/* Core specs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="bg-[#ede8de]/40 p-3 border border-[#BEB8AE]/60 rounded-xl">
            <label className="text-[10px] text-gray-400 block tracking-wider uppercase font-bold mb-1.5">
              採購單名稱 *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例：BT21 官網 4月第一批海外下單"
              className="w-full px-3 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold h-11"
              id="modal-po-name"
            />
          </div>

          <div className="bg-[#ede8de]/40 p-3 border border-[#BEB8AE]/60 rounded-xl">
            <label className="text-[10px] text-gray-400 block tracking-wider uppercase font-bold mb-1.5">
              刷卡台幣結算金額 (代購成本)
            </label>
            <input
              type="number"
              value={form.cardAmount}
              onChange={(e) => setForm(f => ({ ...f, cardAmount: e.target.value }))}
              placeholder="0 (包含折扣券與國外手續費後金額)"
              className="w-full px-3 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold h-11"
              id="modal-po-amount"
            />
          </div>
        </div>

        {/* Checklist selection for pending client order item lines */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
          <div>
            <span className="text-[10.5px] font-bold text-gray-500 font-mono uppercase tracking-wider block">
              ◇ 勾選串聯客戶訂購單品（已串聯 {form.linkedItems.length} 件商品）:
            </span>
            <p className="text-[10px] text-gray-400 mt-1">
              打勾即代表將客人的此項委託，歸入本採購包裹中。該單品會同步自動從「待訂購」跳轉至「已訂購」！
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-3.5 pr-1 py-1.5">
            {eligibleCos.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                目前全資料庫中，沒有任何「待訂購」狀態的客戶單品委託。
              </div>
            ) : (
              eligibleCos.map(c => {
                const targetItems = c.items?.filter(i => i.status === 'pending' || (isEdit && i.poId === po.id));
                if (targetItems.length === 0) return null;

                return (
                  <div key={c.id} className="space-y-1.5 border-b border-gray-150 pb-2 bg-white p-2.5 rounded-lg border border-[#BEB8AE]/40">
                    <div className="font-bold text-[#3A72A0]">@{c.customerIG}</div>
                    
                    <div className="space-y-1">
                      {targetItems.map(item => {
                        const isChecked = form.linkedItems?.some(li => li.coId === c.id && li.itemId === item.id);
                        return (
                          <label
                            key={item.id}
                            onClick={() => handleToggleLink(c.id, item.id)}
                            className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer select-none text-[11.5px] ${
                              isChecked 
                                ? 'bg-[#3A72A0]/10 border-[#3A72A0]/60 text-gray-950 font-semibold' 
                                : 'bg-transparent border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                readOnly
                                className="w-4 h-4 shrink-0 rounded text-[#3A72A0] focus:ring-[#3A72A0]/30"
                              />
                              <span>
                                {[item.series, item.spec, item.character].filter(Boolean).join(' · ') || '商品物件'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-gray-400">× {item.qty}</span>
                              <span className="font-mono font-bold text-gray-700">${parseFloat(item.price).toLocaleString()}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PO Notes */}
        <div>
          <label className="text-[10px] text-gray-400 font-mono tracking-wider block uppercase font-bold mb-1.5">
            採購包裹筆記 (例: 哪位客服跟進下單、折價券抵扣明細等)
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="例如官網打折滿額贈送一隻 Mang..."
            rows={2}
            className="w-full p-3 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl bg-white text-gray-800 outline-none leading-relaxed resize-y"
            id="modal-po-notes"
          />
        </div>

        {/* Action Button Drawers */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 h-12 bg-[#3A72A0] hover:bg-[#2e5d85] active:scale-95 text-white text-sm font-semibold rounded-xl select-none cursor-pointer flex items-center justify-center gap-1.5"
            id="btn-po-modal-save"
          >
            <Check className="w-5 h-5" />
            <span>儲存採購單</span>
          </button>
          
          <button
            onClick={onClose}
            className="px-5 h-12 border border-[#BEB8AE] text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-semibold select-none cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ═════ 3. FREIGHT SHIPMENT MODAL (ShipModal) ═════ */
interface ShipModalProps {
  ship: Shipment | null;
  pos: PreOrder[];
  ships: Shipment[];
  cos?: ClientOrder[];
  onSave: (ship: Shipment) => void;
  onClose: () => void;
}

export function ShipModal({
  ship,
  pos,
  ships,
  cos = [],
  onSave,
  onClose
}: ShipModalProps) {
  const isEdit = !!ship;
  const [form, setForm] = useState<Shipment>(() => {
    if (ship) {
      return { 
        ...ship, 
        poIds: [...(ship.poIds || [])] 
      };
    }
    return {
      id: '',
      name: '',
      stage: 'packed',
      shippingCost: '',
      poIds: [],
      notes: '',
      createdAt: ''
    };
  });

  // Calculate purchase orders already bound to another shipment
  const boundPoIds = new Set(
    ships.filter(s => s.id !== (ship ? ship.id : '')).flatMap(s => s.poIds || [])
  );

  const handleTogglePoId = (poId: string) => {
    if (boundPoIds.has(poId)) return; // Locked, bound elsewhere
    
    setForm(f => ({
      ...f,
      poIds: f.poIds.includes(poId)
        ? f.poIds.filter(id => id !== poId)
        : [...f.poIds, poId]
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      alert('請填寫國際運送單名稱！');
      return;
    }
    onSave({ ...form, name: form.name.trim() });
  };

  return (
    <Overlay onClose={onClose} wide>
      <ModalHeader title={isEdit ? '編輯國際集運打包單' : '建立一航批量空運/海運包裹'} onClose={onClose} />

      <div className="space-y-4 text-xs">
        {/* Freight basics specs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="bg-[#ede8de]/40 p-3 border border-[#BEB8AE]/60 rounded-xl">
            <label className="text-[10px] text-gray-400 block tracking-wider uppercase font-bold mb-1.5">
              託運包裹名稱 *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例：BT21 4月第二彈集貨返台袋"
              className="w-full px-3 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold h-11"
              id="modal-ship-name"
            />
          </div>

          <div className="bg-[#ede8de]/40 p-3 border border-[#BEB8AE]/60 rounded-xl">
            <label className="text-[10px] text-gray-400 block tracking-wider uppercase font-bold mb-1.5">
              託運回台總運費 (台幣結算)
            </label>
            <input
              type="number"
              value={form.shippingCost}
              onChange={(e) => setForm(f => ({ ...f, shippingCost: e.target.value }))}
              placeholder="0 (例: 首重、稅金總額)"
              className="w-full px-3 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold h-11"
              id="modal-ship-cost"
            />
          </div>
        </div>

        {/* Current shipping stage radio layout */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-gray-400 font-bold font-mono tracking-wider uppercase">
            包裹當前託運狀態：
          </label>
          <div className="grid grid-cols-4 gap-2 border border-gray-150 p-1.5 bg-gray-50 rounded-xl">
            {[
              { id: 'packed', label: '已打包', emoji: '📦' },
              { id: 'shipped_from', label: '集運寄出', emoji: '✈️' },
              { id: 'in_transit', label: '等待配送', emoji: '🚛' },
              { id: 'arrived', label: '包裹到貨', emoji: '✅' },
            ].map(stage => {
              const active = form.stage === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => setForm(f => ({ ...f, stage: stage.id as any }))}
                  className={`py-2 px-1 text-center font-semibold rounded-lg text-xs cursor-pointer select-none flex flex-col sm:flex-row items-center justify-center gap-1 transition-all border ${
                    active 
                      ? 'bg-[#3A72A0] text-white border-[#3A72A0] shadow-sm' 
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                  id={`btn-modal-ship-stage-${stage.id}`}
                >
                  <span className="text-sm">{stage.emoji}</span>
                  <span className="text-[10px]">{stage.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Check pre orders to bind */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
          <div>
            <span className="text-[10.5px] font-bold text-gray-500 font-mono uppercase tracking-wider block">
              ◇ 勾選本包裏裝箱承載的官網採購單（已裝箱 {form.poIds.length} 箱）:
            </span>
            <p className="text-[10px] text-gray-400 mt-1">
              打勾即代表將此批官網刷單貨物放進本集運箱中。
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 py-1">
            {pos.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                目前全資料庫中，沒有建立任何採購單（預購單）。請先至<b>預購訂單</b>新增。
              </div>
            ) : (
              pos.map(poItem => {
                const isChecked = form.poIds.includes(poItem.id);
                const isLoadedElsewhere = boundPoIds.has(poItem.id);

                const poiInfo = (poItem.linkedItems || []).map(li => {
                  const clientOrder = cos?.find(c => c.id === li.coId);
                  const item = clientOrder?.items?.find(i => i.id === li.itemId);
                  return {
                    customerIG: clientOrder?.customerIG || '',
                    customerName: clientOrder?.customerName || '',
                    series: item?.series || '',
                    spec: item?.spec || '',
                    character: item?.character || '',
                    qty: item?.qty || 1
                  };
                }).filter(info => info.series || info.character || info.spec);

                return (
                  <label
                    key={poItem.id}
                    onClick={() => handleTogglePoId(poItem.id)}
                    className={`flex items-start justify-between p-3.5 rounded-xl border select-none text-[12px] gap-2 ${
                      isLoadedElsewhere 
                        ? 'bg-gray-200/50 border-gray-200 text-gray-400 cursor-not-allowed opacity-60' 
                        : isChecked
                          ? 'bg-[#3A72A0]/10 border-[#3A72A0]/60 text-gray-950 font-semibold cursor-pointer'
                          : 'bg-white border-gray-150 text-gray-600 hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isLoadedElsewhere}
                        readOnly
                        className="w-4 h-4 shrink-0 rounded text-[#3A72A0] cursor-pointer mt-1"
                      />
                      <div className="min-w-0">
                        <span className="font-extrabold text-sm text-gray-800">📋 {poItem.name}</span>
                        {isLoadedElsewhere && (
                          <span className="text-[9.5px] text-[#3A72A0] bg-[#3A72A0]/5 px-2.5 py-0.5 rounded border border-[#3A72A0]/10 shrink-0 inline-block mt-1">
                            已在其他託運包裹中
                          </span>
                        )}
                        {/* Sub-items info display block */}
                        {poiInfo.length > 0 && (
                          <div className="mt-2 space-y-1.5 pl-3 border-l-[3px] border-[#3A72A0]/20 text-[11px] text-gray-600 font-sans">
                            {poiInfo.map((pInfo, pIdx) => (
                              <div key={pIdx} className="flex items-center gap-1.5 flex-wrap">
                                <span className="bg-[#ede8de] text-gray-700 px-1.5 py-0.2 rounded font-bold text-[9.5px]">
                                  👤 {pInfo.customerName || pInfo.customerIG}
                                </span>
                                <span className="font-medium text-gray-700">{pInfo.series} {pInfo.spec} ({pInfo.character})</span>
                                <span className="text-[10px] text-gray-400 font-bold">× {pInfo.qty}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {poiInfo.length === 0 && (
                          <span className="text-[10px] text-gray-400 italic block mt-1 font-mono">（無代購客訂商品綁定）</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <span className="text-[10px] text-gray-400 font-mono font-bold uppercase">{poItem.linkedItems?.length || 0} 件客訂品 </span>
                      <span className="font-mono font-extrabold text-[#3a72a0] text-sm">${parseFloat(poItem.cardAmount || '0').toLocaleString()}</span>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] text-gray-400 font-mono tracking-wider block uppercase font-bold mb-1.5">
            集運筆記 (例: 提貨單號追蹤號、關稅收據碼、重物補差價細項)
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="有些物流可能需要身份證實名認證或是特定的報關注意編號..."
            rows={2}
            className="w-full p-3 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl bg-white text-gray-800 outline-none leading-relaxed resize-y"
            id="modal-ship-notes"
          />
        </div>

        {/* Action Button Drawers */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 h-12 bg-[#3A72A0] hover:bg-[#2e5d85] active:scale-95 text-white text-sm font-semibold rounded-xl select-none cursor-pointer flex items-center justify-center gap-1.5"
            id="btn-ship-modal-save"
          >
            <Check className="w-5 h-5" />
            <span>儲存運送包裹</span>
          </button>
          
          <button
            onClick={onClose}
            className="px-5 h-12 border border-[#BEB8AE] text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-semibold select-none cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ═════ OVERLAY CONTAINER BASE (SHARED) ═════ */
function Overlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 sm:p-6"
    >
      <div 
        onClick={e => e.stopPropagation()} 
        className={`bg-white border-2 border-[#1E1E1E] rounded-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative animate-scale-up ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <div className="overflow-y-auto p-5 sm:p-6 flex-1 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-150 pb-3 h-10">
      <h2 className="text-[#3A72A0] font-sans font-bold text-lg leading-none select-none tracking-tight">
        {title}
      </h2>
      <button 
        onClick={onClose} 
        className="p-2 -mr-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-all cursor-pointer h-10 w-10 flex items-center justify-center"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
