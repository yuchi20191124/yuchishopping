/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import React from 'react';
import { 
  User, 
  Calendar, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Check, 
  CheckSquare, 
  Square, 
  Clipboard, 
  ShoppingBag, 
  TrendingUp, 
  Clock,
  Sparkles,
  Layers,
  Wand2,
  Gift,
  Phone,
  FileText,
  Bookmark,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  X
} from 'lucide-react';
import { ClientOrder, PreOrder, CoItem, Customer, Product, Character, Series, WishItem } from '../types';

interface ClientOrdersViewProps {
  cos: ClientOrder[];
  pos: PreOrder[];
  onToggleOrdered: (co: ClientOrder) => void;
  onMarkSent: (coId: string, itemId: string) => void;
  onEdit: (co: ClientOrder) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onMergeSelectedOrders?: (masterId: string, duplicateIds: string[]) => Promise<void>;
  
  // Direct Customer Management injected properties
  customers: Customer[];
  onSaveCustomer: (cust: Customer) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  products?: Product[];
  expandProduct?: (p: Product) => string;
  onSaveCo?: (co: ClientOrder) => Promise<void>;
  chars?: Character[];
  series?: Series[];
}

export default function ClientOrdersView({
  cos,
  pos,
  onToggleOrdered,
  onMarkSent,
  onEdit,
  onDelete,
  onNew,
  onMergeSelectedOrders,
  customers = [],
  onSaveCustomer,
  onDeleteCustomer,
  products = [],
  expandProduct,
  onSaveCo,
  chars = [],
  series = []
}: ClientOrdersViewProps) {
  // Navigation sub-tabs inside parent view
  const [subTab, setSubTab] = useState<'orders' | 'parser' | 'customers'>('orders');
  
  // Shared search state
  const [search, setSearch] = useState('');
  
  // Compact state toggle
  const [isCompact, setIsCompact] = useState(() => {
    return localStorage.getItem('of_cos_compact') === 'true';
  });

  const toggleCompact = () => {
    setIsCompact(prev => {
      localStorage.setItem('of_cos_compact', String(!prev));
      return !prev;
    });
  };

  const ITEM_STATUS: Record<string, { label: string; color: string; bg: string }> = {
    pending:        { label: '待訂購', color: 'text-gray-700 border-gray-300', bg: 'bg-gray-100' },
    ordered:        { label: '已訂購', color: 'text-[#3A72A0] border-[#3A72A0]/30', bg: 'bg-[#3A72A0]/10' },
    packed:         { label: '已打包', color: 'text-amber-700 border-amber-300', bg: 'bg-amber-50' },
    shipped_from:   { label: '已寄出', color: 'text-indigo-700 border-indigo-300', bg: 'bg-indigo-50' },
    in_transit:     { label: '配送中', color: 'text-cyan-700 border-cyan-300', bg: 'bg-cyan-50' },
    arrived:        { label: '已到貨', color: 'text-emerald-700 border-emerald-300', bg: 'bg-emerald-50' },
    sent_to_client: { label: '已出貨', color: 'text-indigo-800 border-indigo-200', bg: 'bg-indigo-100' },
  };

  const getStatusConf = (status: string) => {
    return ITEM_STATUS[status] || ITEM_STATUS.pending;
  };

  // Duplicate indicators map
  const duplicateMap = useMemo(() => {
    const map: Record<string, number> = {};
    cos.forEach(c => {
      const ig = (c.customerIG || '').trim().toLowerCase();
      if (ig) {
        map[ig] = (map[ig] || 0) + 1;
      }
    });
    return map;
  }, [cos]);

  const getItemPoName = (itemId: string, poId: string) => {
    if (!poId) return null;
    const po = pos.find((p) => p.id === poId);
    return po ? po.name : null;
  };

  // Merge management
  const [mergeCustomerIG, setMergeCustomerIG] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [masterId, setMasterId] = useState<string>('');

  // Filtering for Client Orders
  const filteredOrders = useMemo(() => {
    return cos.filter(
      (c) =>
        !search ||
        c.customerIG?.toLowerCase().includes(search.toLowerCase()) ||
        c.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        c.items.some(
          (i) =>
            i.series?.toLowerCase().includes(search.toLowerCase()) ||
            i.character?.toLowerCase().includes(search.toLowerCase()) ||
            i.spec?.toLowerCase().includes(search.toLowerCase())
        )
    );
  }, [cos, search]);


  /* ═════════════════════════════════════════════════
     ⚡ POINT 1: ONE-CLICK BULK TEXT PARSER ENGINE
     ═════════════════════════════════════════════════ */
  const [rawText, setRawText] = useState(
    `@amy_lucky\n吉伊卡哇兔兔 A款 +1 $350\n吉伊卡哇兔兔 B款 +1 $350\n\n@sherry_toy\n蠟筆小新睡衣公仔 x2 $180`
  );
  const [parsedDrafts, setParsedDrafts] = useState<any[]>([]);
  const [parserSuccessMsg, setParserSuccessMsg] = useState<string | null>(null);

  // Helper keyword matcher
  const matchSpecification = (lineText: string) => {
    if (!products || products.length === 0) return null;
    let bestProd: Product | null = null;
    let maxScore = 0;
    const lowerLine = lineText.toLowerCase();

    products.forEach(p => {
      const sName = (series.find(s => s.id === p.seriesId)?.name || '').toLowerCase();
      const cName = (chars.find(c => c.id === p.characterId)?.name || '').toLowerCase();
      const spec = (p.spec || '').toLowerCase();

      let score = 0;
      if (sName && lowerLine.includes(sName)) score += 3;
      if (cName && lowerLine.includes(cName)) score += 3;
      if (spec && lowerLine.includes(spec)) score += 2;

      if (score > maxScore) {
        maxScore = score;
        bestProd = p;
      }
    });

    return maxScore >= 2 ? bestProd : null;
  };

  const executeParsing = () => {
    const lines = rawText.split('\n');
    const drafts: any[] = [];
    let currentIG = 'temp_buyer';

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // 1. Check if the line is purely a standalone user header, e.g. "@amy_lucky" or "amy_lucky:"
      const standaloneUserMatch = trimmed.match(/^@([a-zA-Z0-9_\u4e00-\u9fa5]+)\s*$/) || trimmed.match(/^([a-zA-Z0-9_\u4e00-\u9fa5]+)\s*[:：]\s*$/);
      if (standaloneUserMatch) {
        currentIG = standaloneUserMatch[1];
        return; // Transition context and move to the next line
      }

      // 2. Check if the line contains an inline user handle like "@amy_lucky item info..."
      const inlineUserMatch = trimmed.match(/@([a-zA-Z0-9_\u4e00-\u9fa5]+)/);
      let restOfLine = trimmed;
      if (inlineUserMatch) {
        currentIG = inlineUserMatch[1];
        restOfLine = trimmed.replace(inlineUserMatch[0], '').trim();
      }

      // If the item text becomes empty, skip adding a draft
      if (!restOfLine) return;

      // Quantity pattern (e.g. +1, x2, *1, 1個)
      const qtyMatch = restOfLine.match(/[\+x\*]\s*(\d+)/) || restOfLine.match(/(\d+)\s*(個|支|套|雙)/);
      let qty = 1;
      if (qtyMatch) {
         qty = parseInt(qtyMatch[1], 10);
         restOfLine = restOfLine.replace(qtyMatch[0], '').trim();
      }

      // Price pattern (e.g. $350, 350元, 350NT)
      const priceMatch = restOfLine.match(/\$\s*(\d+)/) || restOfLine.match(/(\d+)\s*(元|nt|NTD)/);
      let price = '';
      if (priceMatch) {
        price = priceMatch[1];
        restOfLine = restOfLine.replace(priceMatch[0], '').trim();
      } else {
        // Fallback: look for other trailing numbers as price
        const trailingNum = restOfLine.match(/\s+(\d+)$/);
        if (trailingNum) {
          price = trailingNum[1];
          restOfLine = restOfLine.replace(trailingNum[0], '').trim();
        }
      }

      // Remaining keywords as specification text
      const specKeywords = restOfLine.trim();

      // Try matching specification against existing inventory catalogue
      const matchedProd = matchSpecification(specKeywords);
      let matchedSeriesName = '';
      let matchedCharName = '';
      let finalSpec = specKeywords;
      let finalPrice = price;

      if (matchedProd) {
        matchedSeriesName = series.find(s => s.id === matchedProd.seriesId)?.name || '';
        matchedCharName = chars.find(c => c.id === matchedProd.characterId)?.name || '';
        finalSpec = matchedProd.spec || specKeywords;
        if (!finalPrice) finalPrice = matchedProd.price || '';
      }

      drafts.push({
        id: 'draft_' + index + '_' + Math.random().toString(36).substring(2, 6),
        customerIG: currentIG,
        customerName: currentIG,
        seriesName: matchedSeriesName || '代購手動輸入',
        characterName: matchedCharName || '常態規格',
        spec: finalSpec || '代購周邊明細',
        qty,
        price: finalPrice || '100',
        matchedProductId: matchedProd?.id || ''
      });
    });

    setParsedDrafts(drafts);
  };

  const handleUpdateDraft = (id: string, key: string, value: any) => {
    setParsedDrafts(prev => prev.map(d => d.id === id ? { ...d, [key]: value } : d));
  };

  const handleAddDraftRow = () => {
    setParsedDrafts(prev => [
      ...prev,
      {
        id: 'draft_added_' + Date.now().toString(36),
        customerIG: '',
        customerName: '',
        seriesName: '代購手動輸入',
        characterName: '常態規格',
        spec: '',
        qty: 1,
        price: '100',
        matchedProductId: ''
      }
    ]);
  };

  const handleRemoveDraftRow = (id: string) => {
    setParsedDrafts(prev => prev.filter(d => d.id !== id));
  };

  const handleSaveAllParsedDrafts = async () => {
    if (parsedDrafts.length === 0) return;
    try {
      // Group drafts by customerIG to create ONE ClientOrder per buyer
      const groups = new Map<string, any[]>();
      parsedDrafts.forEach(draft => {
        const key = draft.customerIG.trim().toLowerCase();
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(draft);
      });

      let orderCount = 0;
      for (const [igKey, itemsList] of groups.entries()) {
        const firstDraft = itemsList[0];
        const draftItems: CoItem[] = itemsList.map(item => ({
          id: 'coitem_' + Math.random().toString(36).slice(2, 10),
          productId: item.matchedProductId || '',
          series: item.seriesName,
          character: item.characterName,
          spec: item.spec,
          qty: item.qty,
          price: item.price,
          status: 'pending',
          poId: ''
        }));

        const orderRecord: ClientOrder = {
          id: 'co_' + Math.random().toString(36).slice(2, 10),
          customerIG: firstDraft.customerIG.trim().replace(/^@/, '') || 'anonymous',
          customerName: firstDraft.customerName.trim() || firstDraft.customerIG,
          clientOrdered: false,
          notes: '',
          createdAt: new Date().toISOString(),
          items: draftItems
        };

        if (onSaveCo) {
          await onSaveCo(orderRecord);
        }
        orderCount++;
      }

      setParserSuccessMsg(`🎉 成功登記 ${orderCount} 位顧客之合併下單代購託運！共 ${parsedDrafts.length} 筆商品。`);
      setParsedDrafts([]);
      setRawText('');
      // Auto transition back to orders view to see new items
      setTimeout(() => {
        setParserSuccessMsg(null);
        setSubTab('orders');
      }, 3500);

    } catch (e) {
      alert('批次快速登記失敗，請檢查資料庫連線！');
    }
  };


  /* ═════════════════════════════════════════════════
     👥 POINT 4: CUSTOMER MASTER DATABASE & VIP/WISH PANEL
     ═════════════════════════════════════════════════ */
  const [selectedCustId, setSelectedCustId] = useState<string | null>(null);
  const [editingCust, setEditingCust] = useState<Partial<Customer> | null>(null);
  const [isNewCust, setIsNewCust] = useState(false);

  // New wish state inside edit panel
  const [newWishName, setNewWishName] = useState('');
  const [newWishPrice, setNewWishPrice] = useState('');
  const [newWishNotes, setNewWishNotes] = useState('');

  // Sort and statistics calculator for Customers - ensuring deduplicated records
  const customerStats = useMemo(() => {
    const uniqueMap = new Map<string, Customer>();
    customers.forEach(cust => {
      if (!cust) return;
      const key = (cust.customerIG || '').trim().toLowerCase() || (cust.name || '').trim().toLowerCase();
      if (!key) return;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, cust);
      } else {
        // Merge them - keep the one with more information/higher completeness
        const existing = uniqueMap.get(key)!;
        const score = (cust.phone ? 2 : 0) + (cust.notes ? 1 : 0) + (cust.vipLevel && cust.vipLevel !== 'New' ? 2 : 0) + (cust.wishes?.length ? cust.wishes.length : 0);
        const existingScore = (existing.phone ? 2 : 0) + (existing.notes ? 1 : 0) + (existing.vipLevel && existing.vipLevel !== 'New' ? 2 : 0) + (existing.wishes?.length ? existing.wishes.length : 0);
        if (score > existingScore) {
          uniqueMap.set(key, cust);
        }
      }
    });

    const uniqueCustomers = Array.from(uniqueMap.values());

    return uniqueCustomers.map(cust => {
      const orders = cos.filter(order => {
        const oIG = (order.customerIG || '').trim().toLowerCase();
        const oName = (order.customerName || '').trim().toLowerCase();
        const cIG = (cust.customerIG || '').trim().toLowerCase();
        const cName = (cust.name || '').trim().toLowerCase();
        return (cIG && oIG === cIG) || (cName && oName === cName);
      });

      const totalSpent = orders.reduce((sum, order) => {
        return sum + (order.items || []).reduce((itemSum, item) => {
          return itemSum + (parseFloat(item.price) * (item.qty || 1) || 0);
        }, 0);
      }, 0);

      const pendingPayCount = orders.filter(o => !o.clientOrdered).length;

      return {
        ...cust,
        totalOrdersCount: orders.length,
        totalSpent,
        pendingPayCount
      };
    });
  }, [customers, cos]);

  // Search filter inside Customer Master Tab
  const filteredCustomers = useMemo(() => {
    return customerStats.filter(c => {
      const q = search.toLowerCase();
      return !q || 
        (c.name || '').toLowerCase().includes(q) || 
        (c.customerIG || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.notes || '').toLowerCase().includes(q) ||
        (c.vipLevel || '').toLowerCase().includes(q);
    });
  }, [customerStats, search]);

  const handleEditCustTrigger = (cust: Customer) => {
    setEditingCust({
      ...cust,
      wishes: cust.wishes || []
    });
    setIsNewCust(false);
    setSelectedCustId(cust.id);
  };

  const handleNewCustTrigger = () => {
    setEditingCust({
      id: 'cust_' + Math.random().toString(36).slice(2, 10),
      name: '',
      customerIG: '',
      phone: '',
      notes: '',
      vipLevel: 'New',
      wishes: []
    });
    setIsNewCust(true);
    setSelectedCustId('new');
  };

  const handleSaveCustDirect = async () => {
    if (!editingCust || !editingCust.name || !editingCust.customerIG) {
      alert('請填寫客戶名字與簡寫 IG 帳號！');
      return;
    }

    const cleanedIG = editingCust.customerIG.trim().replace(/^@/, '');
    const clean: Customer = {
      id: editingCust.id || '',
      name: editingCust.name.trim(),
      customerIG: cleanedIG,
      phone: editingCust.phone || '',
      notes: editingCust.notes || '',
      createdAt: editingCust.createdAt || new Date().toISOString(),
      vipLevel: editingCust.vipLevel || 'New',
      wishes: editingCust.wishes || []
    };

    await onSaveCustomer(clean);
    setSelectedCustId(null);
    setEditingCust(null);
  };

  // Add wishing item
  const handleAddNewWish = () => {
    if (!newWishName.trim()) return;
    const item: WishItem = {
      id: 'wish_' + Math.random().toString(36).substring(2, 6) + '_' + Date.now().toString(36).substring(4, 8),
      itemName: newWishName.trim(),
      price: newWishPrice.trim(),
      status: 'pending',
      notes: newWishNotes.trim(),
      createdAt: new Date().toISOString()
    };

    setEditingCust(cust => {
      if (!cust) return null;
      return {
        ...cust,
        wishes: [...(cust.wishes || []), item]
      };
    });

    // Reset wish input fields
    setNewWishName('');
    setNewWishPrice('');
    setNewWishNotes('');
  };

  // Change wish status
  const handleToggleWishStatus = (wishId: string, status: 'pending' | 'success' | 'failed') => {
    setEditingCust(cust => {
      if (!cust) return null;
      return {
        ...cust,
        wishes: (cust.wishes || []).map(w => w.id === wishId ? { ...w, status } : w)
      };
    });
  };

  // Delete wish item
  const handleRemoveWish = (wishId: string) => {
    setEditingCust(cust => {
      if (!cust) return null;
      return {
        ...cust,
        wishes: (cust.wishes || []).filter(w => w.id !== wishId)
      };
    });
  };

  // Convert a success wish directly into a real ClientOrder inside the app!
  const handleConvertWishToOrder = async (wish: WishItem) => {
    if (!editingCust) return;
    const confirmConversion = window.confirm(`將此許願商品「${wish.itemName}」一鍵轉為 ${editingCust.name} 的正式託運代購訂單嗎？`);
    if (!confirmConversion) return;

    const orderRecord: ClientOrder = {
      id: 'co_' + Math.random().toString(36).slice(2, 10),
      customerIG: editingCust.customerIG?.trim().replace(/^@/, '') || 'anonymous',
      customerName: editingCust.name?.trim() || editingCust.customerIG,
      clientOrdered: false,
      notes: `🌠 由許願池商品 [${wish.itemName}] 轉入正式對帳訂單。原許願備註: ${wish.notes || '無'}`,
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'coitem_' + Math.random().toString(36).slice(2, 10),
          productId: '',
          series: '許願池商品',
          character: '許願匹配',
          spec: wish.itemName,
          qty: 1,
          price: wish.price || '0',
          status: 'pending',
          poId: ''
        }
      ]
    };

    // Auto update wish status to success in editing UI
    handleToggleWishStatus(wish.id, 'success');

    if (onSaveCo) {
      await onSaveCo(orderRecord);
      alert('已成功生成託運訂單，並自動同步到客戶訂單與雲端中！');
    }
  };


  return (
    <div className="space-y-6">
      
      {/* ──────────────────────────────────────────────────
          TOP SUB-TAB CONTROLLERS with distinctive styling
          ────────────────────────────────────────────────── */}
      <div className="bg-[#ede8de]/80 p-2 border border-[#BEB8AE] rounded-2xl flex flex-wrap gap-1.5 shadow-xs">
        <button
          onClick={() => { setSubTab('orders'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all select-none cursor-pointer ${
            subTab === 'orders'
              ? 'bg-[#3A72A0] text-white shadow-sm font-extrabold'
              : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
          }`}
          id="btn-subtab-orders"
        >
          <Layers className="w-4 h-4" />
          <span>📦 客戶代購訂單</span>
          <span className="bg-black/10 text-[9px] px-2 py-0.5 rounded-full font-mono font-extrabold">
            {cos.length}
          </span>
        </button>

        <button
          onClick={() => { setSubTab('parser'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all select-none cursor-pointer ${
            subTab === 'parser'
              ? 'bg-[#3A72A0] text-white shadow-sm font-extrabold'
              : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
          }`}
          id="btn-subtab-parser"
        >
          <Wand2 className="w-4 h-4" />
          <span className="text-[#A06A3A] font-extrabold">⚡ 快速文字下單解析</span>
          <span className="bg-amber-600/10 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
            NEW
          </span>
        </button>

        <button
          onClick={() => { setSubTab('customers'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all select-none cursor-pointer ${
            subTab === 'customers'
              ? 'bg-[#3A72A0] text-white shadow-sm font-extrabold'
              : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
          }`}
          id="btn-subtab-customers"
        >
          <User className="w-4 h-4" />
          <span>👥 顧客主檔與 VIP 標籤</span>
          <span className="bg-black/10 text-[9px] px-2 py-0.5 rounded-full font-mono font-extrabold">
            {customerStats.length}
          </span>
        </button>
      </div>


      {/* ──────────────────────────────────────────────────
          SUB-TAB A: CLIENT ORDERS LIST
          ────────────────────────────────────────────────── */}
      {subTab === 'orders' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="font-serif font-black text-2xl text-gray-900 tracking-tight">
                代購訂單貨夾
              </h1>
              <p className="text-gray-500 text-[11px] mt-1">
                總計 {filteredOrders.length} 筆項目匹配。管理買家喊單與後續包貨物流。
              </p>
            </div>

            <div className="flex items-center gap-2 sm:self-end md:self-auto">
              <button
                onClick={toggleCompact}
                className={`flex items-center gap-1.5 px-3 h-12 border rounded-xl font-bold text-xs select-none cursor-pointer active:scale-95 transition-all ${
                  isCompact 
                    ? 'bg-[#3A72A0] border-[#3A72A0] text-white' 
                    : 'text-gray-700 bg-white border-[#BEB8AE] hover:bg-[#FDFBF7]'
                }`}
                title="精簡模式：隱藏多餘細節，呈現高密度訂單顯示"
              >
                <span>{isCompact ? '◉ 精簡模式' : '◎ 詳細模式'}</span>
              </button>

              <button
                onClick={onNew}
                className="flex items-center justify-center gap-1.5 px-4 h-12 bg-[#3A72A0] hover:bg-[#2e5d85] active:scale-95 text-white text-sm font-bold rounded-xl cursor-pointer shadow-sm select-none transition-all"
                id="btn-new-order-direct"
              >
                <Plus className="w-4 h-4" />
                <span>新增客戶代購託單</span>
              </button>
            </div>
          </div>

          {/* SEARCH INPUT */}
          <div className="relative max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
              <Search className="w-4.5 h-4.5" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋 IG 帳號、名字或商品明細..."
              className="w-full pl-10 pr-4 h-12 border border-[#BEB8AE] focus:border-[#3A72A0] focus:ring-1 focus:ring-[#3A72A0]/20 bg-white rounded-xl text-xs transition-all outline-none"
            />
          </div>

          {/* ORDERS LIST */}
          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-16 bg-white border border-[#BEB8AE] rounded-2xl">
                <div className="text-4xl text-gray-300 mb-3">◈</div>
                <p className="text-gray-500 text-xs">目前沒有符合關鍵字的客戶訂單</p>
              </div>
            ) : (
              filteredOrders.map((c) => {
                const sumTotal = (c.items || []).reduce((sum, item) => {
                  return sum + (parseFloat(item.price) * (item.qty || 1) || 0);
                }, 0);

                const hasDuplicates = duplicateMap[(c.customerIG || '').trim().toLowerCase()] > 1;

                // Match customer level tag
                const custProfile = customers.find(x => x.customerIG?.toLowerCase() === c.customerIG?.toLowerCase());
                const vipLevel = custProfile?.vipLevel;

                return (
                  <div
                    key={c.id}
                    className="bg-white border-2 border-[#1E1E1E] rounded-2xl overflow-hidden shadow-xs hover:border-[#3A72A0] transition-colors duration-150"
                  >
                    {/* Header bar */}
                    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 bg-[#FFFCF7] ${
                      isCompact ? 'p-2.5 sm:p-3' : 'p-4 sm:p-5'
                    }`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="font-bold text-sm text-gray-900 truncate flex items-center gap-1.5 flex-wrap">
                              {c.customerName && (
                                <span className="text-[#3A72A0] bg-[#3A72A0]/10 px-2.5 py-0.5 rounded-lg text-xs font-bold border border-[#3A72A0]/15 shrink-0 block">
                                  👤 {c.customerName}
                                </span>
                              )}
                              <span className="text-gray-600 font-bold font-mono">@{c.customerIG || '未命名'}</span>
                              
                              {/* VIP Badges from Master Database */}
                              {vipLevel === 'VIP' && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-amber-300 shadow-3xs">
                                  🌟 VIP 頂級常客
                                </span>
                              )}
                              {vipLevel === 'Blacklist' && (
                                <span className="bg-red-50 text-red-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-red-200">
                                  ⚠️ 跑單黑名單
                                </span>
                              )}
                            </h4>

                            {onMergeSelectedOrders && hasDuplicates && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const ig = (c.customerIG || '').trim();
                                  const targets = cos.filter(o => (o.customerIG || '').trim().toLowerCase() === ig.toLowerCase());
                                  const sorted = [...targets].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                                  setMergeCustomerIG(ig);
                                  setSelectedIds(sorted.map(s => s.id));
                                  setMasterId(sorted[0]?.id || '');
                                }}
                                className="px-2 py-0.5 text-[9px] font-extrabold bg-[#3A72A0] hover:bg-[#2e5d85] text-white rounded-md transition-all cursor-pointer whitespace-nowrap active:scale-95 animate-pulse"
                                title="此客戶有多筆分開之訂單，可一鍵合併為單一貨夾"
                              >
                                🔗 點此倂單 ({duplicateMap[(c.customerIG || '').trim().toLowerCase()]}個貨夾)
                              </button>
                            )}
                          </div>

                          {!isCompact && (
                            <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1.5 font-mono">
                              <Calendar className="w-3 h-3" />
                              <span>建立：{new Date(c.createdAt).toLocaleDateString()}</span>
                              <span>·</span>
                              <span>共 {c.items?.length || 0} 個品項</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Status checklist and pricing actions */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={() => onToggleOrdered(c)}
                          className={`flex items-center justify-center gap-1.5 px-3 h-9 sm:h-10 border text-[11px] font-bold rounded-xl cursor-pointer select-none transition-all ${
                            isCompact ? 'min-w-[90px] px-2 text-[10px]' : 'min-w-[125px]'
                          } ${
                            c.clientOrdered
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                          title="標記買家是否聯絡完成對帳"
                        >
                          {c.clientOrdered ? (
                            <>
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>已收單對帳</span>
                            </>
                          ) : (
                            <>
                              <Square className="w-3.5 h-3.5 text-amber-500" />
                              <span>待確認對帳</span>
                            </>
                          )}
                        </button>

                        <div className="text-right min-w-[60px]">
                          {isCompact ? (
                            <div className="text-xs font-sans font-extrabold text-[#3A72A0]">
                              ${sumTotal.toLocaleString()}
                            </div>
                          ) : (
                            <>
                              <div className="text-[9px] text-gray-400 uppercase font-mono tracking-wider">合計 NTD</div>
                              <div className="text-base font-sans font-extrabold text-[#3A72A0]">
                                ${sumTotal.toLocaleString()}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1 h-9 sm:h-10 border border-[#BEB8AE] rounded-xl overflow-hidden bg-white">
                          <button
                            onClick={() => onEdit(c)}
                            className={`hover:bg-gray-100 flex items-center justify-center text-gray-600 active:scale-90 transition-all cursor-pointer ${
                              isCompact ? 'p-1.5 min-w-[32px]' : 'p-2 min-w-[40px]'
                            }`}
                            title="編輯此代購明細"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(c.id)}
                            className={`hover:bg-rose-50 border-l border-[#BEB8AE]/60 flex items-center justify-center text-rose-600 active:scale-95 transition-all cursor-pointer ${
                              isCompact ? 'p-1.5 min-w-[32px]' : 'p-2 min-w-[40px]'
                            }`}
                            title="刪除此貨夾"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Inside items list */}
                    <div className={`bg-gray-50 border-t border-gray-100 ${
                      isCompact ? 'p-1.5 space-y-1' : 'p-3 space-y-2'
                    }`}>
                      {(c.items || []).map((item) => {
                        const statusConf = getStatusConf(item.status);
                        const poName = getItemPoName(item.id, item.poId);
                        const canShip = item.status === 'arrived';

                        return (
                          <div
                            key={item.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-[#BEB8AE]/40 rounded-xl gap-2 hover:border-gray-300 transition-all ${
                              isCompact ? 'p-1.5 sm:p-2 text-[11px]' : 'p-3 sm:p-4 text-xs'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-gray-900 flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-gray-950">
                                  {[item.series, item.spec, item.character].filter(Boolean).join(' · ') || '常態規格物件'}
                                </span>
                                <span className="text-gray-400 font-mono text-[9px] font-bold">
                                  × {item.qty || 1}
                                </span>
                              </div>
                              
                              {poName && !isCompact && (
                                <div className="text-[9px] text-[#3A72A0] font-sans font-medium flex items-center gap-1 mt-1 bg-[#3A72A0]/5 px-2 py-0.5 rounded-md w-max">
                                  <Clipboard className="w-2.5 h-2.5" />
                                  <span>綁定海外海外採購批：{poName}</span>
                                </div>
                              )}
                            </div>

                            {/* Price and status */}
                            <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0 font-mono">
                              <div className="font-sans font-bold text-gray-700">
                                ${(parseFloat(item.price) * (item.qty || 1) || 0).toLocaleString()}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className={`font-semibold rounded border tracking-wider text-[8.5px] uppercase ${
                                  isCompact ? 'px-1 py-0.5' : 'px-2 py-0.5'
                                } ${statusConf.color} ${statusConf.bg}`}>
                                  {statusConf.label}
                                </span>
                                
                                {canShip && (
                                  <button
                                    onClick={() => onMarkSent(c.id, item.id)}
                                    className={`flex items-center justify-center gap-1 bg-emerald-650 hover:bg-emerald-700 text-white rounded font-bold active:scale-95 text-[10px] select-none cursor-pointer transition-all ${
                                      isCompact ? 'h-6.5 px-2' : 'h-8 px-3'
                                    }`}
                                    title="標記本單品已打包出貨給客人"
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                    <span>已寄交</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {c.notes && (
                        <div className="p-2.5 bg-[#FFFCF7] border border-amber-250/30 rounded-xl text-[10px] text-amber-900 leading-normal">
                          <strong className="text-amber-800">代購備註：</strong>
                          {c.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}


      {/* ──────────────────────────────────────────────────
          SUB-TAB B: ONE-CLICK BULK TEXT PARSER VIEW (Point 1)
          ────────────────────────────────────────────────── */}
      {subTab === 'parser' && (
        <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl p-4 sm:p-5 space-y-6 animate-in fade-in duration-150">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h2 className="font-serif font-black text-lg text-[#3A72A0] tracking-tight">
                IG 貼文與社群對話「智慧下單解析器」
              </h2>
            </div>
            <p className="text-gray-500 text-[11px] mt-1">
              免手動選商品規格！直接複製買家喊單留言（例如：<code>@username 小丸子A款 +1 $350</code>），貼在下方，系統將自動比對商品並批量新增。
            </p>
          </div>

          {parserSuccessMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs font-bold leading-relaxed flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{parserSuccessMsg}</span>
            </div>
          )}

          {/* Textarea Paste Area */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
              💬 貼上留言或對價紀錄文本 (每行一筆)：
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="例如：&#10;@ig_username 櫻桃小丸子A款 +1 $350&#10;@mary_beauty 蠟筆小新人氣公仔 x2 NT180"
              className="w-full h-40 p-3.5 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-gray-50 font-mono outline-none resize-none focus:ring-1 focus:ring-[#3A72A0]/20"
            />
            <div className="flex justify-between items-center bg-[#FFFCF7] p-3 border border-amber-100 rounded-xl text-[10px] text-amber-800 leading-normal">
              <span>💡 <b>解析小秘訣</b>：系統能辨識帶有 <code>@帳號</code> 的名稱，並自動尋找包含 <code>+個數</code>, <code>x個數</code> 及 <code>$金錢</code> 等特徵，再與商品規格資料庫智慧配對。</span>
            </div>
          </div>

          {/* Execution Button */}
          <div className="flex gap-2">
            <button
              onClick={executeParsing}
              className="flex items-center gap-1.5 px-5 h-11 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-all select-none"
            >
              <Wand2 className="w-4 h-4" />
              <span>開始文字智慧解析</span>
            </button>
            
            {parsedDrafts.length > 0 && (
              <button
                onClick={() => setParsedDrafts([])}
                className="px-4 h-11 bg-white hover:bg-gray-100 border border-[#BEB8AE] text-gray-700 text-xs font-bold rounded-xl cursor-pointer active:scale-95 transition-all select-none"
              >
                清空草稿
              </button>
            )}
          </div>

          {/* Draft Table Results */}
          {parsedDrafts.length > 0 && (
            <div className="border-t border-[#BEB8AE]/40 pt-5 space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="font-extrabold text-xs text-gray-800 tracking-tight flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>解析成效預覽 & 規格微調</span>
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">共解析出 {parsedDrafts.length} 筆商品下單行</span>
              </div>

              {/* Draft Grid Layout */}
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {parsedDrafts.map((draft, idx) => (
                  <div
                    key={draft.id}
                    className="p-3 border-2 border-gray-200 hover:border-gray-400 rounded-xl bg-gray-50/50 flex flex-col md:flex-row md:items-center gap-3 text-xs"
                  >
                    {/* Index */}
                    <div className="font-mono font-bold text-gray-300 w-6 shrink-0 text-center select-none text-sm">
                      #{idx + 1}
                    </div>

                    {/* Customer IG */}
                    <div className="min-w-[120px] flex-1">
                      <div className="text-[9px] text-gray-400 font-bold block uppercase mb-1">👤 買家 IG 帳號</div>
                      <input
                        type="text"
                        value={draft.customerIG}
                        onChange={(e) => handleUpdateDraft(draft.id, 'customerIG', e.target.value)}
                        className="w-full px-2 py-1.5 h-8 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-lg bg-white text-xs font-semibold"
                        placeholder="買家帳號"
                      />
                    </div>

                    {/* Series & specification Keyword */}
                    <div className="flex-[2] min-w-[200px]">
                      <div className="text-[9px] text-gray-400 font-bold block uppercase mb-1">🎁 商品規格備註 / 解析內容</div>
                      <input
                        type="text"
                        value={draft.spec}
                        onChange={(e) => handleUpdateDraft(draft.id, 'spec', e.target.value)}
                        className="w-full px-2 py-1.5 h-8 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-lg bg-white text-xs font-medium"
                        placeholder="商品規格明細內容"
                      />
                    </div>

                    {/* Matching inventory category override */}
                    <div className="min-w-[140px] flex-1">
                      <div className="text-[9px] text-gray-400 font-bold block uppercase mb-1">🔗 對應品類匹配</div>
                      <select
                        value={draft.matchedProductId}
                        onChange={(e) => {
                          const pId = e.target.value;
                          const pr = products.find(p => p.id === pId);
                          if (pr) {
                            const seName = series.find(s => s.id === pr.seriesId)?.name || '代購手動輸入';
                            const chName = chars.find(c => c.id === pr.characterId)?.name || '常態規格';
                            handleUpdateDraft(draft.id, 'matchedProductId', pId);
                            handleUpdateDraft(draft.id, 'seriesName', seName);
                            handleUpdateDraft(draft.id, 'characterName', chName);
                            handleUpdateDraft(draft.id, 'spec', pr.spec);
                            handleUpdateDraft(draft.id, 'price', pr.price);
                          } else {
                            handleUpdateDraft(draft.id, 'matchedProductId', '');
                          }
                        }}
                        className="w-full px-2 py-1 h-8 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-lg bg-white text-xs"
                      >
                        <option value="">-- 手動常規 --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {expandProduct ? expandProduct(p) : `${p.spec} ($${p.price})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Volume qty */}
                    <div className="w-16 shrink-0">
                      <div className="text-[9px] text-gray-400 font-bold block uppercase mb-1">🔢 數額</div>
                      <input
                        type="number"
                        value={draft.qty}
                        onChange={(e) => handleUpdateDraft(draft.id, 'qty', parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2 py-1 h-8 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-lg bg-white text-xs font-mono text-center"
                        min="1"
                      />
                    </div>

                    {/* Price spent */}
                    <div className="w-20 shrink-0">
                      <div className="text-[9px] text-gray-400 font-bold block uppercase mb-1">💲 單價 NTD</div>
                      <input
                        type="text"
                        value={draft.price}
                        onChange={(e) => handleUpdateDraft(draft.id, 'price', e.target.value)}
                        className="w-full px-2 py-1 h-8 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-lg bg-white text-xs font-mono text-center"
                        placeholder="100"
                      />
                    </div>

                    {/* Trash line */}
                    <div className="self-end md:self-auto shrink-0 mt-3 md:mt-0">
                      <button
                        onClick={() => handleRemoveDraftRow(draft.id)}
                        className="w-8 h-8 rounded-lg border border-gray-150 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-gray-400 active:scale-95 transition-all text-xs cursor-pointer"
                        title="移去此行"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bot draft action */}
              <div className="flex justify-between items-center border-t border-[#BEB8AE]/30 pt-4 flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleAddDraftRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-[#3A72A0] bg-white border border-[#BEB8AE] hover:bg-gray-50 rounded-lg cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>手動新增一筆草稿行</span>
                </button>

                <button
                  onClick={handleSaveAllParsedDrafts}
                  className="flex items-center gap-1.5 px-6 h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold rounded-xl cursor-pointer shadow-xs transition-all select-none"
                >
                  <CheckSquare className="w-4.5 h-4.5" />
                  <span>⚡ 確認無誤，一鍵登記此 {parsedDrafts.length} 筆訂單</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ──────────────────────────────────────────────────
          SUB-TAB C: CUSTOMER MASTER DATABASE (Point 4)
          ────────────────────────────────────────────────── */}
      {subTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
          
          {/* LEFT 2 COLUMNS: CUSTOMER DIRECTORY LIST */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif font-black text-lg text-gray-950 tracking-tight">
                    客戶資料維護 (Customer Master Registry)
                  </h2>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    用於整合對帳、手機號碼備註、標記 VIP 特權與黑名單。
                  </p>
                </div>

                <button
                  onClick={handleNewCustTrigger}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#3A72A0] hover:bg-[#2e5d85] active:scale-95 text-white text-xs font-bold rounded-xl cursor-pointer shadow-3xs select-none transition-all mr-1 self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增顧客檔案</span>
                </button>
              </div>

              {/* Internal customer search */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="快速篩選搜尋客戶姓名、IG 賬號、手機或標記..."
                  className="w-full pl-9 pr-4 h-10 border border-[#BEB8AE] focus:border-[#3A72A0] bg-white rounded-xl text-xs transition-all outline-none"
                />
              </div>

              {/* Grid or Table listing Customer items */}
              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                {filteredCustomers.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-xs font-semibold">
                    沒有符合篩選條件的顧客主檔案
                  </div>
                ) : (
                  filteredCustomers.map(cust => {
                    const isSelected = selectedCustId === cust.id;

                    return (
                      <div
                        key={cust.id}
                        onClick={() => handleEditCustTrigger(cust)}
                        className={`p-3.5 border-2 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                          isSelected 
                            ? 'bg-[#3A72A0]/5 border-[#3A72A0] text-gray-950 font-bold' 
                            : 'bg-white border-gray-150 hover:border-gray-400 text-gray-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-[#1e1e1e]">
                              {cust.name}
                            </span>
                            <span className="text-gray-500 font-mono text-xs font-semibold">
                              @{cust.customerIG}
                            </span>
                            
                            {/* VIP Flag */}
                            {cust.vipLevel === 'VIP' && (
                              <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-3xs">
                                🌟 頂級 VIP
                              </span>
                            )}
                            {cust.vipLevel === 'Regular' && (
                              <span className="bg-blue-50 text-[#3A72A0] border border-[#3A72A0]/25 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                                📦 常客買家
                              </span>
                            )}
                            {cust.vipLevel === 'Blacklist' && (
                              <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                                ⚠️ 跑單黑名單
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 font-mono">
                            {cust.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{cust.phone}</span>
                              </span>
                            )}
                            {cust.notes && (
                              <span className="flex items-center gap-1 truncate max-w-[170px]">
                                <FileText className="w-2.5 h-2.5" />
                                <span className="truncate">{cust.notes}</span>
                              </span>
                            )}
                            {cust.wishes && cust.wishes.length > 0 && (
                              <span className="text-amber-700 font-bold bg-amber-50 border border-amber-100 px-1 py-0.5 rounded flex items-center gap-0.5">
                                <Gift className="w-2.5 h-2.5" />
                                <span>{cust.wishes.length} 個許願</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Customer Aggregate statistics */}
                        <div className="flex items-center gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 text-left shrink-0">
                          <div className="text-right">
                            <span className="text-[9px] text-gray-400 font-mono uppercase block">託單筆數</span>
                            <span className="text-xs font-bold font-mono text-gray-900">
                              {cust.totalOrdersCount} 筆
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] text-gray-400 font-mono uppercase block">累積常規消費</span>
                            <span className="text-xs font-extrabold font-mono text-[#3A72A0]">
                              ${cust.totalSpent.toLocaleString()}
                            </span>
                          </div>

                          {cust.pendingPayCount > 0 && (
                            <div className="text-right bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                              <span className="text-[9px] text-amber-700 font-mono uppercase block leading-none">待對帳款</span>
                              <span className="text-[11px] font-black font-mono text-amber-800 mt-0.5 block leading-none">
                                {cust.pendingPayCount} 筆
                              </span>
                            </div>
                          )}

                          <ChevronRight className="w-4 h-4 text-gray-300 hidden sm:block shrink-0" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>


          {/* RIGHT COLUMN: DETAIL PROFILE / NEW / EDIT FORM & WISH POOL PANEL */}
          <div className="lg:col-span-1 space-y-4">
            
            {editingCust ? (
              <div className="bg-[#ede8de]/60 border-2 border-[#1E1E1E] rounded-2xl p-4 sm:p-5 space-y-5 animate-in fade-in duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#BEB8AE]/60 pb-3 font-semibold">
                  <h3 className="font-serif font-black text-sm text-[#3A72A0]">
                    {isNewCust ? '🆕 建立全新顧客主欄' : `👤 編輯 ${editingCust.name} 資料`}
                  </h3>
                  <button
                    onClick={() => { setSelectedCustId(null); setEditingCust(null); }}
                    className="text-gray-400 hover:text-gray-600 font-extrabold text-xs"
                  >
                    關閉
                  </button>
                </div>

                {/* Edit forms */}
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-[9px] text-gray-400 block tracking-wider uppercase font-bold mb-1">
                      👥 客戶姓名 / 常規暱稱 *
                    </label>
                    <input
                      type="text"
                      value={editingCust.name || ''}
                      onChange={(e) => setEditingCust(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="例如：王小明"
                      className="w-full px-2.5 h-9 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-gray-400 block tracking-wider uppercase font-bold mb-1">
                      📸 Instagram 帳號簡寫 *
                    </label>
                    <input
                      type="text"
                      value={editingCust.customerIG || ''}
                      onChange={(e) => setEditingCust(prev => ({ ...prev, customerIG: e.target.value }))}
                      placeholder="例如：shiaoming_toy (省略@)"
                      className="w-full px-2.5 h-9 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none font-semibold transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-gray-400 block tracking-wider uppercase font-bold mb-1">
                      📞 聯繫電話配對 (選填)
                    </label>
                    <input
                      type="text"
                      value={editingCust.phone || ''}
                      onChange={(e) => setEditingCust(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="例如：0912-345-678"
                      className="w-full px-2.5 h-9 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-800 outline-none transition-all"
                    />
                  </div>

                  {/* VIP TAG LEVEL */}
                  <div>
                    <label className="text-[9px] text-gray-400 block tracking-wider uppercase font-bold mb-1">
                      🎖️ 客戶標籤群組 (消費級別分類)
                    </label>
                    <select
                      value={editingCust.vipLevel || 'New'}
                      onChange={(e) => setEditingCust(prev => ({ ...prev, vipLevel: e.target.value as any }))}
                      className="w-full px-2.5 h-9 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white font-bold text-gray-800 outline-none transition-all"
                    >
                      <option value="New">🆕 剛入社的新朋友 (New)</option>
                      <option value="Regular">📦 常客常規買家 (Regular)</option>
                      <option value="VIP">🌟 頂級貴賓大戶 (VIP)</option>
                      <option value="Blacklist">⚠️ 跑單與信譽黑名單 (Blacklist)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] text-gray-400 block tracking-wider uppercase font-bold mb-1">
                      📝 客戶專屬私人便籤 / 寄送偏好
                    </label>
                    <textarea
                      value={editingCust.notes || ''}
                      onChange={(e) => setEditingCust(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="例如：常用 7-11 門市、備用收件人、偏好吉伊卡哇..."
                      className="w-full h-16 p-2 border border-[#BEB8AE] focus:border-[#3A72A0] rounded-xl text-xs bg-white text-gray-850 outline-none resize-none transition-all"
                    />
                  </div>
                </div>

                {/* CASCADE rename warning notification */}
                {!isNewCust && (
                  <div className="bg-[#A06A3A]/5 border border-[#A06A3A]/20 rounded-xl p-2.5 text-[9px] text-amber-900 leading-normal">
                    💡 <b>代購溫馨提醒</b>：在此變更「客人姓名」或「IG 帳號」後儲存，系統將會<b>自動在背景批次同步關聯該客戶所有的代購代託單帳號名義</b>，防止出現 orphaned 孤兒錯單！無需手動逐筆變更有夠快速！
                  </div>
                )}


                {/* WISHES POOL SECTION (許願池項目管理) */}
                {!isNewCust && (
                  <div className="border-t border-[#BEB8AE]/60 pt-4 space-y-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">🌠</span>
                      <h4 className="text-xs font-bold text-[#A06A3A]">專屬客屬許願池 (Wishing Tracker)</h4>
                    </div>
                    
                    {/* Wishes inline insert list */}
                    <div className="bg-white border text-xs border-[#BEB8AE]/65 rounded-xl p-3 space-y-2">
                      <div className="text-[9.5px] text-gray-400 font-extrabold uppercase leading-none mb-1">新增許願商品：</div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newWishName}
                          onChange={(e) => setNewWishName(e.target.value)}
                          placeholder="商品名稱 (例外:小飛娃娃)"
                          className="px-2 h-7.5 border rounded text-[11px] w-full"
                        />
                        <input
                          type="text"
                          value={newWishPrice}
                          onChange={(e) => setNewWishPrice(e.target.value)}
                          placeholder="預算 NTD ($)"
                          className="px-2 h-7.5 border rounded text-[11px] w-full"
                        />
                      </div>

                      <div className="flex gap-1.5 items-center">
                        <input
                          type="text"
                          value={newWishNotes}
                          onChange={(e) => setNewWishNotes(e.target.value)}
                          placeholder="補充規格/色款(選填)"
                          className="px-2 h-7.5 border rounded text-[11px] flex-1"
                        />
                        <button
                          type="button"
                          onClick={handleAddNewWish}
                          className="px-3.5 h-7.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shrink-0 transition-opacity"
                        >
                          登記許願
                        </button>
                      </div>
                    </div>

                    {/* Wishes listing */}
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {(!editingCust.wishes || editingCust.wishes.length === 0) ? (
                        <p className="text-[10px] text-gray-400 italic text-center py-2">目前沒有登記此客人的代購許願品項</p>
                      ) : (
                        (editingCust.wishes || []).map(wish => (
                          <div key={wish.id} className="bg-white border rounded-lg p-2 flex flex-col gap-1.5 text-[11px]">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-extrabold text-gray-900">{wish.itemName}</span>
                                {wish.price && <span className="text-gray-400 font-mono ml-1.5">NT${wish.price}</span>}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveWish(wish.id)}
                                className="text-gray-300 hover:text-red-650 cursor-pointer"
                                title="移出許願"
                              >
                                ✕
                              </button>
                            </div>

                            {wish.notes && (
                              <div className="text-[10px] bg-amber-50 text-amber-900 p-1.5 rounded-md leading-normal">
                                備註: {wish.notes}
                              </div>
                            )}

                            {/* Wish statuses */}
                            <div className="flex items-center justify-between gap-2 border-t pt-1.5 border-gray-100 flex-wrap">
                              <div className="flex items-center gap-1 scale-90 origin-left">
                                <button
                                  type="button"
                                  onClick={() => handleToggleWishStatus(wish.id, 'pending')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    wish.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-400'
                                  }`}
                                >
                                  待代購
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleWishStatus(wish.id, 'success')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    wish.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400'
                                  }`}
                                >
                                  已購得
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleWishStatus(wish.id, 'failed')}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    wish.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-400'
                                  }`}
                                >
                                  缺貨
                                </button>
                              </div>

                              {/* Instant covert wish to active client order */}
                              {wish.status !== 'failed' && onSaveCo && (
                                <button
                                  type="button"
                                  onClick={() => handleConvertWishToOrder(wish)}
                                  className="text-[9.5px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-0.5"
                                  title="一鍵將此買家之許願轉為正式代購託運單！"
                                >
                                  <span>⚡ 轉為託運單</span>
                                  <ArrowUpRight className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}


                {/* Bottom Trigger Action Saves */}
                <div className="border-t border-[#BEB8AE]/60 pt-4 flex gap-2">
                  <button
                    onClick={handleSaveCustDirect}
                    className="flex-1 h-10 bg-[#3A72A0] hover:bg-[#2e5d85] text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-xs cursor-pointer"
                  >
                    🚀 儲存顧客檔案
                  </button>

                  {!isNewCust && onDeleteCustomer && (
                    <button
                      onClick={async () => {
                        if (confirm(`確定要永久刪除客戶 @${editingCust.customerIG} 的主檔與所有內部備註及許願清單嗎？（這不會刪除他們的歷史訂單紀錄）`)) {
                          await onDeleteCustomer(editingCust.id!);
                          setSelectedCustId(null);
                          setEditingCust(null);
                        }
                      }}
                      className="w-10 h-10 h-10 hover:bg-rose-50 border border-rose-350 text-rose-600 rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                      title="刪除此顧客主檔案"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </div>
            ) : (
              <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl p-6 text-center text-gray-450 italic text-xs space-y-2 animate-in fade-in duration-100">
                <p>💡 連按左側任何顧客行，即可在此開啟該買家的「CRM 面板」，設定聯繫手機、累積對帳總額、查看專屬代購「許願池品項」並一鍵快速轉下單！</p>
                <button
                  onClick={handleNewCustTrigger}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all mt-3"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>或按此建立新顧客</span>
                </button>
              </div>
            )}

          </div>

        </div>
      )}


      {/* ──────────────────────────────────────────────────
          DYNAMIC CONSOLIDATED BLENDING ORDER MERGE DIALOGUE DIALOGUE (CUSTOM MODAL)
          ────────────────────────────────────────────────── */}
      {mergeCustomerIG && (() => {
        const candidates = cos.filter(
          o => (o.customerIG || '').trim().toLowerCase() === mergeCustomerIG.trim().toLowerCase()
        );

        const handleToggleSelect = (id: string) => {
          if (id === masterId) return; // Master must remain included
          setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
          );
        };

        const handleSetMaster = (id: string) => {
          setMasterId(id);
          setSelectedIds(prev => prev.includes(id) ? prev : [...prev, id]);
        };

        const handleExecuteMerge = async () => {
          if (selectedIds.length < 2) return;
          const duplicateIds = selectedIds.filter(id => id !== masterId);
          if (duplicateIds.length === 0) return;

          const numToMerge = selectedIds.length;
          if (window.confirm(`確定要將選取的 ${numToMerge} 筆訂單合併為 1 筆主託代單嗎？\n合併後其餘 ${duplicateIds.length} 筆原始檔案與連結將被徹底刪除消除！`)) {
            try {
              await onMergeSelectedOrders?.(masterId, duplicateIds);
              setMergeCustomerIG(null);
            } catch (err) {
              alert('合併訂單失敗，請重試！');
            }
          }
        };

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
            <div className="bg-white border-4 border-[#1E1E1E] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-155">
              {/* Header */}
              <div className="bg-[#FFFCF7] border-b border-[#BEB8AE]/60 p-4 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔗</span>
                  <div>
                    <h3 className="font-sans font-extrabold text-base text-[#1e1e1e] tracking-tight">
                      買家 @{mergeCustomerIG} 代購託運單整併(倂單)
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1">
                      選取要合併的多筆訂單並指定其中一筆為「主存檔」，點擊儲存將整併所有代購明細項目。
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMergeCustomerIG(null)}
                  className="w-8 h-8 rounded-full border border-gray-150 hover:bg-gray-100 flex items-center justify-center text-gray-500 font-bold active:scale-95 transition-all text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Candidates select block */}
              <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-gray-50 text-xs text-gray-800">
                {candidates.map(o => {
                  const isChecked = selectedIds.includes(o.id);
                  const isMaster = masterId === o.id;
                  const orderTotal = (o.items || []).reduce(
                    (sum, item) => sum + (parseFloat(item.price) * (item.qty || 1) || 0), 
                    0
                  );

                  return (
                    <div
                      key={o.id}
                      onClick={() => handleToggleSelect(o.id)}
                      className={`p-3 border-2 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                        isMaster 
                          ? 'bg-[#3A72A0]/5 border-[#3A72A0] shadow-xs' 
                          : isChecked 
                            ? 'bg-[#FFFCF7] border-gray-500 font-bold text-gray-900' 
                            : 'bg-white border-gray-150 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="mt-1 flex items-center shrink-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by click parent Div wrapper
                            disabled={isMaster}
                            className="w-4 h-4 rounded text-[#3A72A0] cursor-pointer"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-gray-900">
                              📅 {new Date(o.createdAt).toLocaleDateString()}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                              o.clientOrdered 
                                ? 'bg-emerald-50 text-emerald-850 border-emerald-250' 
                                : 'bg-amber-50 text-amber-850 border-[#BEB8AE]'
                            }`}>
                              {o.clientOrdered ? '已收單對帳' : '待確認對帳'}
                            </span>
                            {isMaster && (
                              <span className="bg-[#3A72A0] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-lg shrink-0">
                                👑 指定為主要目標主存檔
                              </span>
                            )}
                          </div>

                          {/* Items listed */}
                          <div className="mt-2 pl-3 border-l-2 border-gray-150 space-y-1 text-gray-650 text-[11px]">
                            {(o.items || []).map((item) => (
                              <div key={item.id} className="flex items-center gap-1 truncate font-medium">
                                <span className="font-bold text-gray-800">
                                  {[item.series, item.spec, item.character].filter(Boolean).join(' · ')}
                                </span>
                                <span className="text-gray-400 font-bold font-mono">× {item.qty || 1}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right master specify trigger and aggregate */}
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 self-stretch border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetMaster(o.id);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
                            isMaster 
                              ? 'bg-[#3A72A0] text-white border-[#3A72A0]' 
                              : 'bg-white hover:bg-gray-100 text-gray-600 border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            checked={isMaster}
                            readOnly
                            className="w-3.5 h-3.5 cursor-pointer pointer-events-none"
                          />
                          <span>設為主存檔</span>
                        </button>

                        <div className="text-right">
                          <span className="text-[9px] text-gray-400 font-mono">本單對帳合計</span>
                          <div className="text-xs font-bold text-[#3A72A0] font-mono leading-none mt-0.5">
                            ${orderTotal.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Warnings and triggers execute action */}
              <div className="bg-[#ede8de]/50 border-t border-[#BEB8AE]/60 p-4 space-y-3 shrink-0">
                <div className="text-[10px] text-[#A06A3A] bg-[#A06A3A]/10 border border-[#A06A3A]/20 rounded-xl p-3 leading-normal flex items-start gap-2 font-medium">
                  <span className="text-sm leading-none shrink-0">⚠️</span>
                  <span>
                    <b>併單整併準則說明</b>：非主存檔的已勾選貨夾將被徹底刪除卸載。所有的品項明細及海外 PreOrder 預購採購單之綁定將全部移交集中到 <b>指定的主要目標主存檔</b> 中。
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs w-full">
                  <div className="text-gray-500 font-bold">
                    已選定要合併的筆數: <span className="text-[#3A72A0] font-mono font-extrabold text-sm">{selectedIds.length}</span> / {candidates.length} 筆
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setMergeCustomerIG(null)}
                      className="px-4 py-2 bg-white hover:bg-gray-100 border border-[#BEB8AE] font-bold text-gray-600 rounded-xl cursor-pointer active:scale-95 transition-all text-xs h-10"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleExecuteMerge}
                      disabled={selectedIds.length < 2}
                      className="px-5 py-2 bg-[#3A72A0] hover:bg-[#2e5d85] disabled:bg-gray-200 disabled:text-gray-400 disabled:border-transparent disabled:cursor-not-allowed border-0 font-bold text-white rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all text-xs h-10"
                    >
                      確執行併單
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
