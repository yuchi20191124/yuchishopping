/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
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
  Clock 
} from 'lucide-react';
import { ClientOrder, PreOrder, CoItem } from '../types';

interface ClientOrdersViewProps {
  cos: ClientOrder[];
  pos: PreOrder[];
  onToggleOrdered: (co: ClientOrder) => void;
  onMarkSent: (coId: string, itemId: string) => void;
  onEdit: (co: ClientOrder) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onMergeSelectedOrders?: (masterId: string, duplicateIds: string[]) => Promise<void>;
}

export default function ClientOrdersView({
  cos,
  pos,
  onToggleOrdered,
  onMarkSent,
  onEdit,
  onDelete,
  onNew,
  onMergeSelectedOrders
}: ClientOrdersViewProps) {
  const [search, setSearch] = useState('');
  
  // Merge candidates select states
  const [mergeCustomerIG, setMergeCustomerIG] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [masterId, setMasterId] = useState<string>('');
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

  const filtered = useMemo(() => {
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

  return (
    <div className="space-y-6">
      {/* Search Header panel with responsive action control buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-sans font-bold text-2xl text-gray-900 tracking-tight">
            客戶訂單列表
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            總計 {filtered.length} 筆項目匹配。管理個別客戶的 IG 下單跟進與出貨排程。
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
            id="btn-toggle-compact"
            title="精簡模式：隱藏對應頭像、縮小間距以在畫面顯示更多訂單項目"
          >
            <span>{isCompact ? '◉ 精簡模式已啟用' : '◎ 詳細模式'}</span>
          </button>

          <button
            onClick={onNew}
            className="flex items-center justify-center gap-1.5 px-4 h-12 bg-[#3A72A0] hover:bg-[#2e5d85] active:scale-95 text-white text-sm font-semibold rounded-xl cursor-pointer shadow-sm select-none transition-all"
            id="btn-new-client-order"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>新增客戶訂單</span>
          </button>
        </div>
      </div>

      {/* SEARCH AND FILTER FIELD */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋 IG 帳號或商品明細..."
          className="w-full pl-11 pr-4 h-12 border border-[#BEB8AE] focus:border-[#3A72A0] focus:ring-2 focus:ring-[#3A72A0]/20 bg-white rounded-xl text-sm transition-all outline-none"
          id="inp-search-orders"
        />
      </div>

      {/* Grid listing */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#BEB8AE] rounded-2xl">
            <div className="text-4xl text-gray-300 mb-3">◈</div>
            <p className="text-gray-500 text-sm">找不到相關的客戶訂單</p>
          </div>
        ) : (
          filtered.map((c) => {
            const sumTotal = (c.items || []).reduce((sum, item) => {
              return sum + (parseFloat(item.price) * (item.qty || 1) || 0);
            }, 0);

            const hasDuplicates = duplicateMap[(c.customerIG || '').trim().toLowerCase()] > 1;

            return (
              <div
                key={c.id}
                className="bg-white border-2 border-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-150"
              >
                {/* Order header row */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 bg-[#FFFCF7] ${
                  isCompact ? 'p-2.5 sm:p-3' : 'p-4 sm:p-5'
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="font-bold text-base text-gray-900 truncate flex items-center gap-2">
                          {c.customerName && (
                            <span className="text-[#3A72A0] bg-[#3A72A0]/10 px-2.5 py-0.5 rounded-lg text-xs font-bold leading-normal border border-[#3A72A0]/15 shrink-0 block">
                              👤 {c.customerName}
                            </span>
                          )}
                          <span className="text-gray-600 font-semibold font-mono">@{c.customerIG || '未命名'}</span>
                        </h4>
                        
                        {/* Duplicate order merging trigger badge */}
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
                            className="px-2 py-0.5 text-[10px] font-bold bg-[#3A72A0] hover:bg-[#2e5d85] text-white rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95 animate-pulse"
                            title="此客戶有其他重複訂單，點此將其全部合併（倂單）"
                          >
                            🔗 點此併單
                          </button>
                        )}
                      </div>
                      
                      {!isCompact && (
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>建立：{new Date(c.createdAt).toLocaleDateString()}</span>
                          <span>·</span>
                          <span>共 {c.items?.length || 0} 品項</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status checklist and pricing actions */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => onToggleOrdered(c)}
                      className={`flex items-center justify-center gap-1.5 px-3 h-9 sm:h-10 border text-xs font-semibold rounded-xl cursor-pointer select-none transition-all ${
                        isCompact ? 'min-w-[100px] px-2 text-[11px]' : 'min-w-[130px]'
                      } ${
                        c.clientOrdered
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                      title="標記客人是否已經完成下單匯款"
                      id={`btn-toggle-ordered-${c.id}`}
                    >
                      {c.clientOrdered ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>已收單/款</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5 text-amber-500" />
                          <span>待客人下單</span>
                        </>
                      )}
                    </button>

                    <div className="text-right min-w-[60px]">
                      {isCompact ? (
                        <div className="text-sm font-sans font-bold text-[#3A72A0]">
                          ${sumTotal.toLocaleString()}
                        </div>
                      ) : (
                        <>
                          <div className="text-[10px] text-gray-400 uppercase font-mono tracking-wider">合計</div>
                          <div className="text-lg font-sans font-bold text-[#3A72A0]">
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
                        title="編輯此訂單"
                        id={`btn-edit-order-${c.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        className={`hover:bg-rose-50 border-l border-[#BEB8AE] flex items-center justify-center text-rose-600 active:scale-95 transition-all cursor-pointer ${
                          isCompact ? 'p-1.5 min-w-[32px]' : 'p-2 min-w-[40px]'
                        }`}
                        title="刪除此訂單"
                        id={`btn-delete-order-${c.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Grid layout for items listed inside */}
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
                        className={`flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-[#BEB8AE]/60 rounded-xl gap-2 hover:border-gray-400 transition-all ${
                          isCompact ? 'p-1.5 sm:p-2 text-xs' : 'p-3 sm:p-4'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className={`text-gray-900 flex flex-wrap items-center gap-1.5 ${
                            isCompact ? 'text-xs' : 'text-sm font-semibold'
                          }`}>
                            <span className="font-semibold text-gray-950">
                              {[item.series, item.spec, item.character].filter(Boolean).join(' · ') || '商品物件'}
                            </span>
                            <span className="text-gray-400 font-mono text-[10px]">
                              × {item.qty || 1}
                            </span>
                          </div>
                          
                          {poName && !isCompact && (
                            <div className="text-[10px] text-[#3A72A0] font-sans font-medium flex items-center gap-1 mt-1 bg-[#3A72A0]/5 px-2 py-0.5 rounded-lg w-max">
                              <Clipboard className="w-3 h-3" />
                              <span>預購：{poName}</span>
                            </div>
                          )}
                        </div>

                        {/* Status elements and triggers */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-shrink-0">
                          <div className={`font-sans font-semibold text-[#3A72A0] ${
                            isCompact ? 'text-xs' : 'text-sm'
                          }`}>
                            ${(parseFloat(item.price) * (item.qty || 1) || 0).toLocaleString()}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold rounded border uppercase tracking-wider text-[9px] ${
                              isCompact ? 'px-1.5 py-0.5' : 'px-2.5 py-1'
                            } ${statusConf.color} ${statusConf.bg}`}>
                              {statusConf.label}
                            </span>
                            
                            {canShip && (
                              <button
                                onClick={() => onMarkSent(c.id, item.id)}
                                className={`flex items-center justify-center gap-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded active:scale-95 text-xs font-semibold select-none cursor-pointer transition-all ${
                                  isCompact ? 'h-7 text-[10px] min-w-[64px]' : 'h-9 min-w-[80px]'
                                }`}
                                title="標記該單品已完成交貨/已出貨給客人"
                                id={`btn-ship-item-${item.id}`}
                              >
                                <Check className="w-3 h-3" />
                                <span>已出貨</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {c.notes && (
                    <div className="p-2 bg-[#FFFCF7] border border-amber-200/50 rounded-xl text-[11px] text-amber-900 leading-normal">
                      <strong className="text-amber-800">備註：</strong>
                      {c.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Order Merging Dialogue Modal (Custom Multiselect Merge) */}
      {mergeCustomerIG && (() => {
        const candidates = cos.filter(
          o => (o.customerIG || '').trim().toLowerCase() === mergeCustomerIG.trim().toLowerCase()
        );

        const handleToggleSelect = (id: string) => {
          if (id === masterId) return; // Master must be included
          setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
          );
        };

        const handleSetMaster = (id: string) => {
          setMasterId(id);
          // Auto include masterId
          setSelectedIds(prev => prev.includes(id) ? prev : [...prev, id]);
        };

        const handleExecuteMerge = async () => {
          if (selectedIds.length < 2) return;
          const duplicateIds = selectedIds.filter(id => id !== masterId);
          if (duplicateIds.length === 0) return;

          const numToMerge = selectedIds.length;
          if (window.confirm(`確定要將選取的 ${numToMerge} 筆訂單合併為 1 筆嗎？\n合併後其餘 ${duplicateIds.length} 筆原始託代單檔案將被永久刪除！`)) {
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
            <div className="bg-white border-4 border-[#1E1E1E] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="bg-[#FFFCF7] border-b border-[#BEB8AE]/60 p-4 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔗</span>
                  <div>
                    <h3 className="font-sans font-extrabold text-base text-gray-900 tracking-tight">
                      客戶 @{mergeCustomerIG} 專屬倂單/合併管理
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-1">
                      選擇多個待合併的訂單，指定一筆為「主存檔」，點選執行將整併商品明細。
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

              {/* Candidates selection area */}
              <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-gray-50 text-xs text-gray-850">
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
                      className={`p-3.5 border-2 rounded-xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs ${
                        isMaster 
                          ? 'bg-[#3A72A0]/5 border-[#3A72A0] shadow-xs' 
                          : isChecked 
                            ? 'bg-[#FFFCF7] border-gray-500 text-gray-900 font-semibold' 
                            : 'bg-white border-gray-150 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Selector checkbox */}
                        <div className="mt-1 flex items-center shrink-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by div click
                            disabled={isMaster}
                            className="w-4 h-4 rounded text-[#3A72A0] cursor-pointer"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-[#1E1E1E]">
                              📅 {new Date(o.createdAt).toLocaleDateString()}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              o.clientOrdered 
                                ? 'bg-emerald-50 text-emerald-850 border-emerald-250' 
                                : 'bg-amber-50 text-amber-850 border-[#BEB8AE]'
                            }`}>
                              {o.clientOrdered ? '已收單/款' : '待客人下單'}
                            </span>
                            {isMaster && (
                              <span className="bg-[#3A72A0] text-white text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0">
                                👑 主存檔
                              </span>
                            )}
                          </div>

                          {/* Sub items info list */}
                          <div className="mt-2 pl-3 border-l-2 border-gray-200 space-y-1 text-gray-700">
                            {(o.items || []).map((item) => (
                              <div key={item.id} className="text-[11px] flex items-center gap-1.5 flex-wrap font-medium">
                                <span className="font-bold text-gray-900">
                                  {[item.series, item.spec, item.character].filter(Boolean).join(' · ')}
                                </span>
                                <span className="text-gray-400 font-bold">× {item.qty || 1}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right-side action: Button to prioritize as master, and show total price */}
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 self-stretch border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetMaster(o.id);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
                            isMaster 
                              ? 'bg-[#3A72A0] text-white border-[#3A72A0]' 
                              : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                          }`}
                          title="將此單設定為合併後的目標主頁面"
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
                          <span className="text-[10px] text-gray-400 font-mono">合計金額</span>
                          <div className="text-sm font-bold text-[#3A72A0] font-mono leading-none mt-0.5">
                            ${orderTotal.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Warning label & Actions */}
              <div className="bg-[#ede8de]/40 border-t border-[#BEB8AE]/60 p-4 space-y-3 shrink-0">
                <div className="text-[11px] text-[#A06A3A] bg-[#A06A3A]/10 border border-[#A06A3A]/20 rounded-xl p-3 leading-normal flex items-start gap-2 font-medium">
                  <span className="text-sm shrink-0">⚠️</span>
                  <span>
                    <b>合併規則說明</b>：被合併的其他訂單將會被刪除，其內的所有單品項目、相關聯的海外採購單 PreOrder 綁定都會被轉移並集中到<b>主存檔</b>中。
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs w-full">
                  <div className="text-gray-500 font-bold">
                    已選取 <span className="text-[#3A72A0] font-mono font-extrabold text-sm">{selectedIds.length}</span> / {candidates.length} 筆
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setMergeCustomerIG(null)}
                      className="px-4 py-2 bg-white hover:bg-gray-100 border border-[#BEB8AE] font-bold text-gray-700 rounded-xl cursor-pointer active:scale-95 transition-all text-sm h-11"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleExecuteMerge}
                      disabled={selectedIds.length < 2}
                      className="px-5 py-2 bg-[#3A72A0] hover:bg-[#2e5d85] disabled:bg-gray-200 disabled:text-gray-400 disabled:border-transparent disabled:cursor-not-allowed border-0 font-bold text-white rounded-xl shadow-sm cursor-pointer active:scale-95 transition-all text-sm h-11"
                    >
                      確認並執行併單({selectedIds.length}筆)
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


