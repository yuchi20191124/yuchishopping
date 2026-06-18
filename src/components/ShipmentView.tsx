/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Truck, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  ArrowRight, 
  Link, 
  Layers 
} from 'lucide-react';
import { Shipment, PreOrder, ClientOrder } from '../types';

interface ShipmentViewProps {
  ships: Shipment[];
  pos: PreOrder[];
  cos?: ClientOrder[];
  onEdit: (ship: Shipment) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onStageChange: (id: string, stage: 'packed' | 'shipped_from' | 'in_transit' | 'arrived') => void;
}

export default function ShipmentView({
  ships,
  pos,
  cos = [],
  onEdit,
  onDelete,
  onNew,
  onStageChange
}: ShipmentViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const SHIP_STAGES: { id: 'packed' | 'shipped_from' | 'in_transit' | 'arrived'; label: string; emoji: string }[] = [
    { id: 'packed',       label: '已打包', emoji: '📦' },
    { id: 'shipped_from', label: '集運寄出', emoji: '✈️' },
    { id: 'in_transit',   label: '等待配送', emoji: '🚛' },
    { id: 'arrived',      label: '已到貨', emoji: '✅' },
  ];

  const getStageConf = (id: string) => {
    return SHIP_STAGES.find((s) => s.id === id) || SHIP_STAGES[0];
  };

  const getLinkedPoNames = (poIds: string[]) => {
    if (!poIds) return [];
    return pos.filter((p) => poIds.includes(p.id));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-sans font-bold text-2xl text-gray-900 tracking-tight">
            國際運送單
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            追蹤國際空運、海運包裹！點擊進度標籤即可一鍵切換狀態，並自動更新採購物品的物流進度。
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center justify-center gap-1.5 px-4 h-12 bg-[#3A72A0] hover:bg-[#2e5d85] active:scale-95 text-white text-sm font-semibold rounded-xl cursor-pointer shadow-sm select-none transition-all"
          id="btn-new-shipment-order"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>新增運送單</span>
        </button>
      </div>

      {/* Main Lists */}
      <div className="space-y-4">
        {ships.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[#BEB8AE] rounded-2xl">
            <div className="text-4xl text-gray-300 mb-3">🚛</div>
            <p className="text-gray-500 text-sm">暫無國際包裹運送紀錄</p>
          </div>
        ) : (
          [...ships]
            .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
            .map((s) => {
              const st = getStageConf(s.stage);
            const linkedPos = getLinkedPoNames(s.poIds || []);
            const isExpanded = expandedId === s.id;
            const currentStageIndex = SHIP_STAGES.findIndex((stage) => stage.id === s.stage);

            return (
              <div
                key={s.id}
                className="bg-white border-2 border-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Parent Row */}
                <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-gray-100 bg-[#FFFCF7]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-[#EDE8DE] border border-[#BEB8AE] flex items-center justify-center rounded-xl text-lg flex-shrink-0">
                      {st.emoji}
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-950 truncate max-w-xs sm:max-w-md">
                        {s.name || '未命名運送單'}
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>託運日期：{new Date(s.createdAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span className="text-[#3A72A0] font-sans font-semibold">
                          與 {s.poIds?.length || 0} 筆採購預購單綁定
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Direct status switcher trigger buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[10.5px] font-bold text-gray-400 font-mono tracking-wider uppercase block xl:hidden w-full mb-1">
                      ◇ 快速追蹤配送階段：
                    </div>
                    {/* Interactive nodes */}
                    <div className="flex items-center border border-[#BEB8AE] rounded-xl p-1 bg-gray-50 flex-wrap gap-1">
                      {SHIP_STAGES.map((stage, idx) => {
                        const isCurrent = s.stage === stage.id;
                        const isPast = idx < currentStageIndex;

                        return (
                          <button
                            key={stage.id}
                            onClick={() => onStageChange(s.id, stage.id)}
                            className={`px-3 h-8 text-[11px] font-semibold rounded-lg flex items-center gap-1 select-none transition-all active:scale-95 cursor-pointer ${
                              isCurrent
                                ? 'bg-[#3A72A0] text-white shadow-sm'
                                : isPast
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'hover:bg-gray-100 text-gray-500'
                            }`}
                            title={`按一下切換為：${stage.label}`}
                            id={`btn-ship-stage-${s.id}-${stage.id}`}
                          >
                            <span>{stage.emoji}</span>
                            <span className="hidden sm:inline">{stage.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Shipping Costs and Action Buttons */}
                  <div className="flex items-center justify-between xl:justify-end gap-4 border-t xl:border-t-0 pt-3 xl:pt-0 border-dashed border-gray-100">
                    <div className="text-right min-w-[70px]">
                      <div className="text-[10px] text-gray-400 font-mono tracking-wider uppercase flex items-center gap-0.5 justify-end">
                        <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                        <span>國際運費</span>
                      </div>
                      <div className="text-lg font-sans font-bold text-[#3A72A0]">
                        ${(parseFloat(s.shippingCost) || 0).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 border border-[#BEB8AE] rounded-xl overflow-hidden h-11 bg-white">
                      <button
                        onClick={() => toggleExpand(s.id)}
                        className="px-3.5 h-full hover:bg-gray-100 text-[#3A72A0] font-semibold text-xs flex items-center gap-1 select-none active:scale-95 transition-all cursor-pointer h-full min-w-[44px]"
                        title={isExpanded ? '收起貨夾' : '展開採購關聯'}
                        id={`btn-expand-ship-${s.id}`}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span className="hidden sm:inline">收起</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            <span className="hidden sm:inline">貨夾</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => onEdit(s)}
                        className="p-2.5 h-full hover:bg-gray-100 border-l border-[#BEB8AE] flex items-center justify-center text-gray-600 active:scale-90 transition-all cursor-pointer min-w-[44px]"
                        title="編輯此單"
                        id={`btn-edit-ship-${s.id}`}
                      >
                        <Edit className="w-4.5 h-4.5" />
                      </button>

                      <button
                        onClick={() => onDelete(s.id)}
                        className="p-2.5 h-full hover:bg-rose-50 border-l border-[#BEB8AE] flex items-center justify-center text-rose-500 active:scale-90 transition-all cursor-pointer min-w-[44px]"
                        title="刪除此單"
                        id={`btn-delete-ship-${s.id}`}
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4">
                    <h5 className="text-[10px] text-gray-400 font-mono tracking-wider uppercase font-semibold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" /> 包含於本集運包裏中的預購採購單：
                    </h5>

                    <div className="divide-y divide-gray-150 bg-white border border-[#BEB8AE]/60 rounded-xl overflow-hidden text-xs">
                      {linkedPos.length === 0 ? (
                        <div className="p-4 text-center text-gray-400">
                          本運送包裹目前沒有與任何採購單綁定，可點擊編輯進行串聯！
                        </div>
                      ) : (
                        linkedPos.map((p) => {
                          const stagesMap: Record<string, { label: string; emoji: string }> = {
                            ordered: { label: '已下單', emoji: '🛒' },
                            paid:    { label: '已付款', emoji: '💳' },
                            arrived: { label: '已到貨', emoji: '📦' },
                            done:    { label: '完成結算', emoji: '✅' },
                          };
                          const poSt = stagesMap[p.stage] || { label: '已下單', emoji: '🛒' };

                          // Generate fully self-healed, merged detailItems list
                          const detailItems: {
                            coId: string;
                            itemId: string;
                            customerIG: string;
                            customerName: string;
                            series: string;
                            spec: string;
                            character: string;
                            qty: number;
                            price: string;
                            status: string;
                            isBroken?: boolean;
                          }[] = [];

                          const seenKeys = new Set<string>();

                          // 1. Scan actual poId markings
                          cos.forEach(c => {
                            c.items?.forEach(i => {
                              if (i.poId === p.id) {
                                const key = `${c.id}-${i.id}`;
                                seenKeys.add(key);
                                detailItems.push({
                                  coId: c.id,
                                  itemId: i.id,
                                  customerIG: c.customerIG || '未知',
                                  customerName: c.customerName || '',
                                  series: i.series || '未知系列',
                                  spec: i.spec || '未知規格',
                                  character: i.character || '未知角色',
                                  qty: i.qty || 1,
                                  price: i.price || '0',
                                  status: i.status || 'pending'
                                });
                              }
                            });
                          });

                          // 2. Scan defined linked items
                          (p.linkedItems || []).forEach(li => {
                            const key = `${li.coId}-${li.itemId}`;
                            if (seenKeys.has(key)) return;

                            let clientOrder = cos.find(c => c.id === li.coId);
                            let item = clientOrder?.items?.find(i => i.id === li.itemId);

                            if (!item) {
                              clientOrder = cos.find(c => c.items?.some(i => i.id === li.itemId));
                              item = clientOrder?.items?.find(i => i.id === li.itemId);
                            }

                            if (clientOrder && item) {
                              seenKeys.add(key);
                              detailItems.push({
                                coId: clientOrder.id,
                                itemId: item.id,
                                customerIG: clientOrder.customerIG || '未知',
                                customerName: clientOrder.customerName || '',
                                series: item.series || '未知系列',
                                spec: item.spec || '未知規格',
                                character: item.character || '未知角色',
                                qty: item.qty || 1,
                                price: item.price || '0',
                                status: item.status || 'pending'
                              });
                            } else {
                              seenKeys.add(key);
                              detailItems.push({
                                coId: li.coId,
                                itemId: li.itemId,
                                customerIG: clientOrder?.customerIG || '未知顧客',
                                customerName: clientOrder?.customerName || '',
                                series: '海外單品',
                                spec: '關聯已變更或正在拆單',
                                character: '',
                                qty: 1,
                                price: '0',
                                status: 'pending',
                                isBroken: true
                              });
                            }
                          });

                          return (
                            <div key={p.id} className="p-3.5 bg-[#FFFCF7]/30 hover:bg-[#EDE8DE]/10 border-b border-gray-150/40 last:border-0 transition-all space-y-2.5">
                              {/* Header info */}
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className="font-extrabold text-gray-800 text-sm flex items-center gap-1.5">
                                    📋 {p.name || '未命名'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                  <span className="px-2 py-0.5 bg-[#3A72A0]/10 rounded text-[10px] text-[#3A72A0] font-bold border border-[#3A72A0]/15">
                                    {poSt.emoji} {poSt.label}
                                  </span>
                                  <span className="font-mono font-extrabold text-[#3a72a0]">
                                    ${parseFloat(p.cardAmount || '0').toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              {/* Detailed items table/list */}
                              {detailItems.length > 0 ? (
                                <div className="bg-white/80 border border-gray-100 rounded-xl p-2.5 space-y-2 text-[11px]">
                                  <div className="text-[10px] text-gray-400 font-bold font-mono tracking-wider">📦 商品打包/撿貨明細 (共 {detailItems.length} 件):</div>
                                  <div className="space-y-1.5 divide-y divide-gray-50">
                                    {detailItems.map((item, dIdx) => (
                                      <div key={dIdx} className={`${dIdx > 0 ? 'pt-1.5' : ''} flex flex-col sm:flex-row sm:items-center justify-between gap-1.5`}>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {/* Customer Owner badge */}
                                          <span className="bg-[#ede8de] text-gray-700 px-1.5 py-0.5 rounded font-bold text-[10px] flex items-center gap-1">
                                            👤 {item.customerName || item.customerIG}
                                          </span>
                                          <span className="text-gray-850 font-semibold font-sans text-xs">
                                            {[item.series, item.spec, item.character].filter(Boolean).join(' · ')}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                                          <span className="font-extrabold text-gray-500">× {item.qty}</span>
                                          <span className="font-mono text-gray-400 font-bold">${parseFloat(item.price).toLocaleString()}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[10.5px] text-gray-400 italic pl-5">本採購單中目前未載入任何具體客訂商品。</div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {s.notes && (
                      <div className="p-3 bg-amber-50 border border-amber-200/50 rounded-xl text-xs text-amber-900 font-mono">
                        <strong className="text-amber-800 font-sans">集運追蹤碼與筆記：</strong>
                        {s.notes}
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
