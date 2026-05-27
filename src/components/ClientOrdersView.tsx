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
}

export default function ClientOrdersView({
  cos,
  pos,
  onToggleOrdered,
  onMarkSent,
  onEdit,
  onDelete,
  onNew
}: ClientOrdersViewProps) {
  const [search, setSearch] = useState('');

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
        c.items.some(
          (i) =>
            i.series?.toLowerCase().includes(search.toLowerCase()) ||
            i.character?.toLowerCase().includes(search.toLowerCase()) ||
            i.spec?.toLowerCase().includes(search.toLowerCase())
        )
    );
  }, [cos, search]);

  const getItemPoName = (itemId: string, poId: string) => {
    if (!poId) return null;
    const po = pos.find((p) => p.id === poId);
    return po ? po.name : null;
  };

  return (
    <div className="space-y-6">
      {/* Search Header panel with nice buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-sans font-bold text-2xl text-gray-900 tracking-tight">
            客戶訂單列表
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            總計 {filtered.length} 筆項目匹配。管理個別客戶的 IG 下單跟進與出貨排程。
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center justify-center gap-1.5 px-4 h-12 bg-[#3A72A0] hover:bg-[#2e5d85] active:scale-95 text-white text-sm font-semibold rounded-xl cursor-pointer shadow-sm select-none transition-all"
          id="btn-new-client-order"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>新增客戶訂單</span>
        </button>
      </div>

      {/* Styled text field wrapper */}
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

            return (
              <div
                key={c.id}
                className="bg-white border-2 border-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-150"
              >
                {/* Order header row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 bg-[#FFFCF7]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-[#EDE8DE] border border-[#BEB8AE] flex items-center justify-center rounded-xl font-bold text-sm text-[#3A72A0]">
                      {(c.customerIG || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-base text-gray-900 truncate flex items-center gap-1.5">
                        @{c.customerIG || '未命名'}
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>建立：{new Date(c.createdAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>共 {c.items?.length || 0} 品項</span>
                      </p>
                    </div>
                  </div>

                  {/* Status checklist and pricing actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => onToggleOrdered(c)}
                      className={`flex items-center justify-center gap-2 px-3.5 h-11 border text-xs font-semibold rounded-xl cursor-pointer select-none transition-all min-w-[130px] ${
                        c.clientOrdered
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                      title="標記客人是否已經完成下單匯款"
                      id={`btn-toggle-ordered-${c.id}`}
                    >
                      {c.clientOrdered ? (
                        <>
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                          <span>✓ 客人已下單</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-4 h-4 text-amber-500" />
                          <span>待客人下單</span>
                        </>
                      )}
                    </button>

                    <div className="text-right min-w-[70px]">
                      <div className="text-[10px] text-gray-400 uppercase font-mono tracking-wider">合計</div>
                      <div className="text-lg font-sans font-bold text-[#3A72A0]">
                        ${sumTotal.toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 h-11 border border-[#BEB8AE] rounded-xl overflow-hidden bg-white">
                      <button
                        onClick={() => onEdit(c)}
                        className="p-2.5 h-full hover:bg-gray-100 flex items-center justify-center text-gray-600 active:scale-90 transition-all cursor-pointer min-w-[44px]"
                        title="編輯此訂單"
                        id={`btn-edit-order-${c.id}`}
                      >
                        <Edit className="w-4.5 h-4.5" />
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        className="p-2.5 h-full hover:bg-rose-50 border-l border-[#BEB8AE] flex items-center justify-center text-rose-600 active:scale-95 transition-all cursor-pointer min-w-[44px]"
                        title="刪除此訂單"
                        id={`btn-delete-order-${c.id}`}
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Grid layout for items listed inside */}
                <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
                  {(c.items || []).map((item) => {
                    const statusConf = getStatusConf(item.status);
                    const poName = getItemPoName(item.id, item.poId);
                    const canShip = item.status === 'arrived';

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-[#BEB8AE]/60 rounded-xl p-3 sm:p-4 gap-3 hover:border-gray-400 transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-900 flex flex-wrap items-center gap-1.5">
                            <span className="text-gray-900 font-bold">
                              {[item.series, item.spec, item.character].filter(Boolean).join(' · ') || '商品物件'}
                            </span>
                            <span className="text-gray-400 font-mono text-xs">
                              × {item.qty || 1}
                            </span>
                          </div>
                          
                          {poName && (
                            <div className="text-[10px] text-[#3A72A0] font-sans font-medium flex items-center gap-1 mt-1.5 bg-[#3A72A0]/5 px-2 py-0.5 rounded-lg w-max">
                              <Clipboard className="w-3 h-3" />
                              <span>預購：{poName}</span>
                            </div>
                          )}
                        </div>

                        {/* Status elements and triggers */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-dashed border-gray-100">
                          <div className="font-sans font-bold text-sm text-[#3A72A0]">
                            ${(parseFloat(item.price) * (item.qty || 1) || 0).toLocaleString()}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${statusConf.color} ${statusConf.bg}`}>
                              {statusConf.label}
                            </span>
                            
                            {canShip && (
                              <button
                                onClick={() => onMarkSent(c.id, item.id)}
                                className="flex items-center justify-center gap-1.5 px-3 h-9 bg-emerald-600 text-white rounded-lg active:scale-95 text-xs font-semibold select-none cursor-pointer hover:bg-emerald-700 transition-all min-w-[80px]"
                                title="標記該單品已完成交貨/已出貨給客人"
                                id={`btn-ship-item-${item.id}`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>已出貨給客人</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {c.notes && (
                    <div className="p-3 bg-[#FFFCF7] border border-amber-200/50 rounded-xl text-xs text-amber-900">
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
    </div>
  );
}
