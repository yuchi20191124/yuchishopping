/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Calendar, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  ChevronDown, 
  ChevronUp, 
  User, 
  TrendingUp, 
  CreditCard 
} from 'lucide-react';
import { PreOrder, ClientOrder, Shipment } from '../types';

interface PreOrdersViewProps {
  pos: PreOrder[];
  cos: ClientOrder[];
  ships: Shipment[];
  onEdit: (po: PreOrder) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function PreOrdersView({
  pos,
  cos,
  ships,
  onEdit,
  onDelete,
  onNew
}: PreOrdersViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);

  const PO_STAGES = [
    { id: 'ordered', label: '已下單', emoji: '🛒', color: 'text-blue-700 border-blue-200 bg-blue-50' },
    { id: 'paid',    label: '已付款', emoji: '💳', color: 'text-indigo-700 border-indigo-200 bg-indigo-50' },
    { id: 'arrived', label: '已到貨', emoji: '📦', color: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
    { id: 'done',    label: '已完成', emoji: '✅', color: 'text-gray-700 border-gray-200 bg-gray-50' },
  ];

  const getPOStageConf = (id: string) => {
    return PO_STAGES.find((s) => s.id === id) || PO_STAGES[0];
  };

  const filtered = useMemo(() => {
    return pos.filter(
      (p) =>
        (filter === 'all' || p.stage === filter) &&
        (!search || p.name?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [pos, filter, search]);

  const toggleExpand = (poId: string) => {
    setExpandedPoId(expandedPoId === poId ? null : poId);
  };

  const getPoShipment = (poId: string) => {
    return ships.find((s) => s.poIds?.includes(poId));
  };

  const getLinkedItemDetail = (coId: string, itemId: string) => {
    const co = cos.find((c) => c.id === coId);
    if (!co) return null;
    const item = co.items?.find((i) => i.id === itemId);
    if (!item) return null;
    return {
      customerIG: co.customerIG,
      desc: [item.series, item.spec, item.character].filter(Boolean).join(' · '),
      qty: item.qty || 1,
      price: parseFloat(item.price) || 0
    };
  };

  return (
    <div className="space-y-6">
      {/* View Title Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-sans font-bold text-2xl text-gray-900 tracking-tight">
            預購與採購單
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            記錄每次在日本或海外官網、門市刷卡下單的批次，並串聯該單品的客戶！
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center justify-center gap-1.5 px-4 h-12 bg-[#3A72A0] hover:bg-[#2e5d85] active:scale-95 text-white text-sm font-semibold rounded-xl cursor-pointer shadow-sm select-none transition-all"
          id="btn-new-pre-order"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>新增預購單</span>
        </button>
      </div>

      {/* Styled filter and search drawer */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
            <Search className="w-5 h-5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋預購單名稱..."
            className="w-full pl-11 pr-4 h-12 border border-[#BEB8AE] focus:border-[#3A72A0] focus:ring-2 focus:ring-[#3A72A0]/20 bg-white rounded-xl text-s transition-all outline-none"
            id="inp-search-pos"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 h-11 text-xs font-semibold rounded-xl border cursor-pointer select-none transition-all ${
              filter === 'all'
                ? 'bg-[#3A72A0] text-white border-[#3A72A0]'
                : 'bg-white text-gray-600 border-[#BEB8AE] hover:bg-gray-50'
            }`}
            id="filter-po-all"
          >
            全部
          </button>
          {PO_STAGES.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilter(s.id)}
              className={`px-4 h-11 text-xs font-semibold rounded-xl border flex items-center gap-1 select-none transition-all cursor-pointer ${
                filter === s.id
                  ? 'bg-[#3A72A0] text-white border-[#3A72A0]'
                  : 'bg-white text-gray-600 border-[#BEB8AE] hover:bg-gray-50'
              }`}
              id={`filter-po-${s.id}`}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lists */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#BEB8AE] rounded-2xl">
            <div className="text-4xl text-gray-300 mb-3">🛍️</div>
            <p className="text-gray-500 text-sm">找不到符合條件的預購單</p>
          </div>
        ) : (
          filtered.map((po) => {
            const conf = getPOStageConf(po.stage);
            const shipmentDoc = getPoShipment(po.id);
            const isExpanded = expandedPoId === po.id;

            return (
              <div
                key={po.id}
                className="bg-white border-2 border-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm"
              >
                {/* PO Header bar */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 bg-[#FFFCF7]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#EDE8DE] border border-[#BEB8AE] flex items-center justify-center rounded-xl font-bold text-lg">
                      {conf.emoji}
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-950">
                        {po.name || '未命名預購單'}
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>採購日期：{new Date(po.createdAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span className="text-[#3A72A0] font-medium">
                          與 {po.linkedItems?.length || 0} 筆客戶單品綁定
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Status checklist and actions */}
                  <div className="flex flex-wrap items-center gap-4">
                    {shipmentDoc && (
                      <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-indigo-800 font-semibold flex items-center gap-1">
                        <span>✈️ {shipmentDoc.name}</span>
                      </div>
                    )}

                    <span className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border uppercase tracking-wider ${conf.color}`}>
                      {conf.emoji} {conf.label}
                    </span>

                    {/* Cost aggregate */}
                    <div className="text-right min-w-[80px]">
                      <div className="text-[10px] text-gray-400 font-mono tracking-wider flex items-center gap-1 justify-end">
                        <CreditCard className="w-3 h-3 text-gray-400" />
                        <span>刷卡金額</span>
                      </div>
                      <div className="text-lg font-sans font-bold text-gray-900">
                        ${(parseFloat(po.cardAmount) || 0).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 border border-[#BEB8AE] rounded-xl overflow-hidden bg-white h-11">
                      <button
                        onClick={() => toggleExpand(po.id)}
                        className="px-3.5 h-full hover:bg-gray-100 text-[#3A72A0] font-semibold text-xs flex items-center gap-1 select-none active:scale-95 transition-all cursor-pointer h-full min-w-[44px]"
                        title={isExpanded ? '縮小明細' : '展開單品清單'}
                        id={`btn-expand-po-${po.id}`}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span className="hidden sm:inline">收起</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span className="hidden sm:inline">明細</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => onEdit(po)}
                        className="p-2.5 h-full hover:bg-gray-100 border-l border-[#BEB8AE] flex items-center justify-center text-gray-600 active:scale-90 transition-all cursor-pointer min-w-[44px]"
                        title="編輯此單"
                        id={`btn-edit-po-${po.id}`}
                      >
                        <Edit className="w-4.5 h-4.5" />
                      </button>

                      <button
                        onClick={() => onDelete(po.id)}
                        className="p-2.5 h-full hover:bg-rose-50 border-l border-[#BEB8AE] flex items-center justify-center text-rose-500 active:scale-90 transition-all cursor-pointer min-w-[44px]"
                        title="刪除此單"
                        id={`btn-delete-po-${po.id}`}
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded linked orders panel */}
                {isExpanded && (
                  <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4">
                    <h5 className="text-[10px] text-gray-400 font-mono tracking-wider uppercase font-semibold">
                      ◇ 關聯的客戶商品紀錄明細
                    </h5>

                    <div className="divide-y divide-gray-100 bg-white border border-[#BEB8AE]/60 rounded-xl overflow-hidden text-xs">
                      {po.linkedItems?.length === 0 ? (
                        <div className="p-4 text-center text-gray-400">
                          本採購單中尚未串聯任何客戶單品。可點擊編輯串聯。
                        </div>
                      ) : (
                        po.linkedItems?.map((li, idx) => {
                          const det = getLinkedItemDetail(li.coId, li.itemId);
                          if (!det) return null;

                          return (
                            <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                              <div className="min-w-0">
                                <span className="font-bold text-amber-800">@{det.customerIG}</span>
                                <span className="text-gray-400 mx-2">·</span>
                                <span className="text-gray-800 font-medium">{det.desc}</span>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end gap-4">
                                <span className="text-gray-400 font-mono text-xs">數量：× {det.qty}</span>
                                <span className="font-bold text-[#3A72A0]">${(det.price * det.qty).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {po.notes && (
                      <div className="p-3 bg-amber-50 border border-amber-200/50 rounded-xl text-xs text-amber-900 font-mono">
                        <strong className="text-amber-800 font-sans">採購筆記 / 配色等備註：</strong>
                        {po.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
