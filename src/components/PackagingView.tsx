/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { 
  Package, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit, 
  DollarSign, 
  Clipboard, 
  DollarSign as IconDollar 
} from 'lucide-react';
import { PackagingCost } from '../types';

interface PackagingViewProps {
  pkgs: PackagingCost[];
  savePkgs: (pkgs: PackagingCost[]) => void;
}

export default function PackagingView({ pkgs, savePkgs }: PackagingViewProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  
  // Single record input register
  const [form, setForm] = useState<Omit<PackagingCost, 'id' | 'createdAt'>>({
    name: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  const total = useMemo(() => {
    return pkgs.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  }, [pkgs]);

  const handleStartNew = () => {
    setForm({
      name: '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      notes: ''
    });
    setEditingId('new');
  };

  const startEdit = (item: PackagingCost) => {
    setForm({
      name: item.name,
      amount: item.amount,
      date: item.date,
      notes: item.notes
    });
    setEditingId(item.id);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      alert('請填寫包材品項名稱！');
      return;
    }
    const amountVal = parseFloat(form.amount || '0').toString();

    if (editingId === 'new') {
      const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      savePkgs([
        ...pkgs,
        {
          id: newId,
          ...form,
          amount: amountVal,
          createdAt: new Date().toISOString()
        }
      ]);
    } else {
      savePkgs(
        pkgs.map((p) =>
          p.id === editingId
            ? { ...p, ...form, amount: amountVal }
            : p
        )
      );
    }
    handleCancel();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('確定要永久刪除此筆包材耗損成本紀錄嗎？此開銷將自淨利率公式中扣除。')) {
      savePkgs(pkgs.filter((p) => p.id !== id));
    }
  };

  const setField = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-sans font-bold text-2xl text-gray-900 tracking-tight">
            包耗材成本流水帳
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            登記泡泡袋、飛機盒、紙箱、防水袋、緞帶等採購紀錄。此支出將直接計入代購獲利損益計算中！
          </p>
        </div>

        <button
          onClick={handleStartNew}
          className="flex items-center justify-center gap-1.5 px-4 h-12 bg-[#3A72A0] hover:bg-[#2e5d85] text-white text-sm font-semibold rounded-xl cursor-pointer shadow-sm active:scale-95 transition-all select-none"
          id="btn-new-pkg-cost"
        >
          <Plus className="w-4.5 h-4.5" />
          <span>登記購買包材</span>
        </button>
      </div>

      {/* Aggregate KPI details */}
      <div className="bg-white border-2 border-[#1E1E1E] p-4 rounded-xl flex items-center justify-between shadow-sm">
        <span className="text-[10px] text-gray-400 font-mono tracking-wider uppercase font-semibold">包材總購買支出累計</span>
        <div className="text-right">
          <div className="text-2xl font-sans font-bold text-[#3A72A0] flex items-center gap-0.5 justify-end">
            <DollarSign className="w-6 h-6 text-[#3A72A0]" />
            <span>{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Editor Panel Wrapper */}
      {editingId !== null && (
        <div className="bg-[#FFFCF7] border border-[#BEB8AE] p-4 rounded-xl shadow-sm space-y-4 animate-fade-in text-xs">
          <h4 className="text-xs font-semibold text-[#3A72A0]">
            {editingId === 'new' ? '登記耗損包材購買' : '編輯包材紀錄'}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="text-[10px] text-gray-400 block font-bold mb-1.5">品項名稱 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="例如：馬卡龍紙箱 A4 50個"
                className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl outline-none text-xs bg-white text-gray-800 font-sans"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block font-bold mb-1.5">採購總金額</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setField('amount', e.target.value)}
                placeholder="0"
                className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl outline-none text-xs bg-white text-gray-800 font-sans"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block font-bold mb-1.5">採購日期</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl outline-none text-xs bg-white text-gray-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 block font-bold mb-1.5">其他明細 / 注意事項 / 購買來源</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="進口氣泡棉、淘寶購、蝦皮等備註..."
              className="w-full px-3 h-10 border border-[#BEB8AE] rounded-xl outline-none text-xs bg-white text-gray-800 font-sans"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleSave}
              className="px-4 h-10 bg-[#3A72A0] text-white rounded-xl text-xs font-semibold cursor-pointer active:scale-95"
              id="btn-save-pkg-cost"
            >
              儲存紀錄
            </button>
            <button
              onClick={handleCancel}
              className="px-3 border border-[#BEB8AE] text-gray-500 hover:bg-gray-50 rounded-xl text-xs font-semibold cursor-pointer h-10"
              id="btn-close-pkg-cost"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Main logs listing */}
      <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl overflow-hidden shadow-sm">
        {pkgs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            您尚未建置任何購買包材的耗損數據
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {[...pkgs]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((it) => (
                <div key={it.id} className="p-4 flex items-center justify-between gap-4 bg-[#FFFCF7]/30 hover:bg-[#EDE8DE]/10 transition-colors">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs text-gray-900">{it.name}</h5>
                    <div className="flex flex-wrap items-center text-[10px] text-gray-400 gap-1.5 mt-1 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{it.date}</span>
                      {it.notes && (
                        <>
                          <span>·</span>
                          <span className="font-sans font-medium text-amber-800 block truncate max-w-sm">備註：{it.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 flex-shrink-0">
                    <span className="font-sans font-black text-[#3A72A0] text-sm flex items-center">
                      ${parseFloat(it.amount || '0').toLocaleString()}
                    </span>

                    <div className="flex gap-1 h-8">
                      <button
                        onClick={() => startEdit(it)}
                        className="px-2.5 h-full hover:bg-[#EDE8DE]/30 text-[#3A72A0] rounded-lg text-xs font-semibold select-none active:scale-95 transition-all cursor-pointer"
                        id={`btn-edit-pk-${it.id}`}
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleDelete(it.id)}
                        className="px-2.5 h-full hover:bg-rose-50 text-rose-500 rounded-lg text-xs font-semibold select-none active:scale-95 transition-all cursor-pointer"
                        id={`btn-delete-pk-${it.id}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
