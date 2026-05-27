/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef } from 'react';
import { 
  TrendingUp, 
  Coins, 
  DollarSign, 
  Package, 
  Truck, 
  ShoppingBag, 
  ArrowRight, 
  Cloud, 
  CloudOff, 
  Download, 
  Upload, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { ClientOrder, PreOrder, Shipment, PackagingCost } from '../types';
import { StorageService } from '../lib/storage';

interface DashboardViewProps {
  cos: ClientOrder[];
  pos: PreOrder[];
  ships: Shipment[];
  pkgs: PackagingCost[];
  onNavigate: (view: string) => void;
  onRefreshAll: () => void;
}

export default function DashboardView({
  cos,
  pos,
  ships,
  pkgs,
  onNavigate,
  onRefreshAll
}: DashboardViewProps) {
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profit/Loss aggregates
  const totalRevenue = useMemo(() => {
    return cos.reduce((total, c) => {
      return total + (c.items || []).reduce((sub, i) => {
        return sub + (parseFloat(i.price) * (i.qty || 1) || 0);
      }, 0);
    }, 0);
  }, [cos]);

  const totalPoCost = useMemo(() => {
    return pos.reduce((sum, p) => sum + (parseFloat(p.cardAmount) || 0), 0);
  }, [pos]);

  const totalShipCost = useMemo(() => {
    return ships.reduce((sum, sh) => sum + (parseFloat(sh.shippingCost) || 0), 0);
  }, [ships]);

  const totalPkgCost = useMemo(() => {
    return pkgs.reduce((sum, pk) => sum + (parseFloat(pk.amount) || 0), 0);
  }, [pkgs]);

  const totalCost = totalPoCost + totalShipCost + totalPkgCost;
  const totalProfit = totalRevenue - totalCost;

  // Recent 5 client orders
  const recentCos = useMemo(() => {
    return [...cos]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [cos]);

  // Non-arrived shipments
  const activeShips = useMemo(() => {
    return ships.filter((s) => s.stage !== 'arrived');
  }, [ships]);

  const isCloud = StorageService.isCloudActive();

  // Export Backups
  const handleExport = () => {
    const dataStr = StorageService.exportAllData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    link.download = `yuchishopping-backup-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import backups
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await StorageService.importAllData(text);
        if (res) {
          setImportStatus('success');
          onRefreshAll();
          setTimeout(() => setImportStatus('idle'), 4000);
        } else {
          setImportStatus('error');
          setTimeout(() => setImportStatus('idle'), 4000);
        }
      } catch (err) {
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 4000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Cloud & PWA status info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white border border-[#BEB8AE] p-4 rounded-xl gap-4">
        <div>
          <h2 className="text-[#3A72A0] font-sans font-semibold text-lg flex items-center gap-2">
            {isCloud ? (
              <>
                <Cloud className="w-5 h-5 text-emerald-600 animate-pulse" />
                雲端同步已開啟
              </>
            ) : (
              <>
                <CloudOff className="w-5 h-5 text-amber-500" />
                本地離線模式
              </>
            )}
          </h2>
          <p className="text-gray-500 text-xs mt-1 font-sans">
            {isCloud 
              ? "資料已安全同步至 Google Cloud Firestore 雲端，多裝置隨時同步保存！" 
              : "資料目前安全儲存在本機瀏覽器。點擊右側可匯出 JSON 備份以防萬一。"}
          </p>
        </div>

        {/* Action button triggers */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#3A72A0] bg-[#3A72A0]/10 border border-[#3A72A0]/20 rounded-lg hover:bg-[#3A72A0]/20 active:scale-95 transition-all cursor-pointer h-10 select-none"
            title="下載全部資料備份"
            id="btn-export-backup"
          >
            <Download className="w-4 h-4" />
            <span>匯出備份</span>
          </button>

          <button
            onClick={handleImportClick}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 active:scale-95 transition-all cursor-pointer h-10 select-none"
            title="上傳備份 JSON 覆蓋"
            id="btn-import-backup"
          >
            <Upload className="w-4 h-4" />
            <span>匯入備份</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          {importStatus === 'success' && (
            <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold px-2 py-1 bg-emerald-50 rounded-lg animate-fade-in border border-emerald-200">
              <Check className="w-3.5 h-3.5" /> 匯入成功！
            </span>
          )}
          {importStatus === 'error' && (
            <span className="flex items-center gap-1 text-rose-600 text-xs font-semibold px-2 py-1 bg-rose-50 rounded-lg animate-fade-in border border-rose-200">
              <AlertCircle className="w-3.5 h-3.5" /> 匯入格式有誤
            </span>
          )}
        </div>
      </div>

      {/* Primary KPI Grid (High Contrast Bento Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Revenue */}
        <div className="bg-white border-2 border-[#1E1E1E] p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">Total Revenue / 營業額</span>
            <div className="p-2 bg-[#3A72A0]/10 rounded-xl text-[#3A72A0]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-sans font-bold tracking-tight text-gray-900">
              ${totalRevenue.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h3>
            <p className="text-gray-500 text-xs mt-2 font-medium">
              來自 {cos.length} 筆客戶訂單
            </p>
          </div>
        </div>

        {/* Cost */}
        <div className="bg-white border-2 border-[#1E1E1E] p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">Total Cost / 總成本</span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-700">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-sans font-bold tracking-tight text-gray-900">
              ${totalCost.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h3>
            <p className="text-gray-500 text-xs mt-2 font-medium">
              代購刷卡 + 運費 + 包材
            </p>
          </div>
        </div>

        {/* Profit */}
        <div className="bg-[#FFFCF7] border-2 border-[#1E1E1E] p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">Expected Profit / 預估毛利</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-700">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <h3 className={`text-3xl font-sans font-bold tracking-tight ${totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              ${totalProfit.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h3>
            <p className="text-gray-500 text-xs mt-2 font-medium">
              約 {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}% 毛利率
            </p>
          </div>
        </div>
      </div>

      {/* Split cost bento details */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#EDE8DE]/70 border border-[#BEB8AE] p-3 rounded-xl">
          <div className="text-[9px] text-[#3A72A0] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5" /> 代購款
          </div>
          <div className="text-base font-semibold text-gray-800">${totalPoCost.toLocaleString()}</div>
          <div className="text-[9px] text-gray-400 mt-1">{pos.length} 筆預購單</div>
        </div>

        <div className="bg-[#EDE8DE]/70 border border-[#BEB8AE] p-3 rounded-xl">
          <div className="text-[9px] text-[#3A72A0] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" /> 國際運費
          </div>
          <div className="text-base font-semibold text-gray-800">${totalShipCost.toLocaleString()}</div>
          <div className="text-[9px] text-gray-400 mt-1">{ships.length} 筆運送單</div>
        </div>

        <div className="bg-[#EDE8DE]/70 border border-[#BEB8AE] p-3 rounded-xl">
          <div className="text-[9px] text-[#3A72A0] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
            <Package className="w-3.5 h-3.5" /> 包材成本
          </div>
          <div className="text-base font-semibold text-gray-800">${totalPkgCost.toLocaleString()}</div>
          <div className="text-[9px] text-gray-400 mt-1">{pkgs.length} 筆項目</div>
        </div>
      </div>

      {/* Recents Splits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Recent Client Orders */}
        <div className="bg-[#EDE8DE]/50 border border-[#BEB8AE] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-sans font-bold text-sm text-gray-800 tracking-wider flex items-center gap-2">
              <span className="text-amber-500">◇</span> 最近客戶訂單
            </h3>
            <button 
              onClick={() => onNavigate('customer')}
              className="text-[#3A72A0] hover:text-[#2a5a82] font-semibold text-xs flex items-center gap-1 cursor-pointer"
            >
              全部 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {recentCos.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                尚無客戶訂單資料
              </div>
            ) : (
              recentCos.map((c) => {
                const total = (c.items || []).reduce((sum, item) => {
                  return sum + (parseFloat(item.price) * (item.qty || 1) || 0);
                }, 0);
                return (
                  <div 
                    key={c.id}
                    onClick={() => onNavigate('customer')}
                    className="flex items-center justify-between px-3.5 py-3 bg-white border border-[#BEB8AE]/60 hover:border-gray-400 hover:shadow-sm rounded-xl cursor-pointer transition-all duration-150"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-bold text-xs text-gray-800 truncate">
                        @{c.customerIG || '未命名'}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {c.items.length} 件商品 · {new Date(c.createdAt).toLocaleDateString('zh-TW')}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-sans font-bold text-sm text-[#3A72A0]">
                        ${total.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5">
                        {c.clientOrdered ? (
                          <span className="text-emerald-600 font-semibold px-1 py-0.2 bg-emerald-50 rounded">已下單</span>
                        ) : (
                          <span className="text-amber-600 font-semibold px-1 py-0.2 bg-amber-50 rounded">未下單</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* In-Transit Shipments */}
        <div className="bg-[#EDE8DE]/50 border border-[#BEB8AE] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-sans font-bold text-sm text-gray-800 tracking-wider flex items-center gap-2">
              <span className="text-[#3A72A0]">△</span> 進行中運送單
            </h3>
            <button 
              onClick={() => onNavigate('shipment')}
              className="text-[#3A72A0] hover:text-[#2a5a82] font-semibold text-xs flex items-center gap-1 cursor-pointer"
            >
              全部 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {activeShips.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                暫無進行中的運送單
              </div>
            ) : (
              activeShips.map((s) => {
                const stages: Record<string, { label: string; emoji: string }> = {
                  packed: { label: '已打包', emoji: '📦' },
                  shipped_from: { label: '集運寄出', emoji: '✈️' },
                  in_transit: { label: '等待配送', emoji: '🚛' },
                };
                const st = stages[s.stage] || { label: '打包中', emoji: '📦' };

                return (
                  <div 
                    key={s.id}
                    onClick={() => onNavigate('shipment')}
                    className="flex items-center justify-between px-3.5 py-3 bg-white border border-[#BEB8AE]/60 hover:border-gray-400 hover:shadow-sm rounded-xl cursor-pointer transition-all duration-150"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-bold text-xs text-gray-800 truncate">
                        {s.name || '未命名運送單'}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        與 {s.poIds?.length || 0} 筆預購單關聯 · {new Date(s.createdAt).toLocaleDateString('zh-TW')}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-[#3A72A0] flex items-center gap-1 justify-end">
                        <span>{st.emoji}</span>
                        <span>{st.label}</span>
                      </div>
                      <div className="text-[9px] text-gray-400 mt-1">
                        運費: ${parseFloat(s.shippingCost || '0').toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
