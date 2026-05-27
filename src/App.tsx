/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  User, 
  ShoppingBag, 
  Truck, 
  Plus, 
  FolderHeart, 
  Box, 
  DollarSign 
} from 'lucide-react';
import { 
  Character, 
  Series, 
  Product, 
  ClientOrder, 
  PreOrder, 
  Shipment, 
  PackagingCost 
} from './types';
import { StorageService } from './lib/storage';

// VIEWS COMPONENTS
import DashboardView from './components/DashboardView';
import ClientOrdersView from './components/ClientOrdersView';
import PreOrdersView from './components/PreOrdersView';
import ShipmentView from './components/ShipmentView';
import ProductsView from './components/ProductsView';
import PackagingView from './components/PackagingView';

// MODALS AND DIALOGUES
import { CoModal, PoModal, ShipModal } from './components/Modals';

export default function App() {
  const [chars, setChars] = useState<Character[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cos, setCos] = useState<ClientOrder[]>([]);
  const [pos, setPos] = useState<PreOrder[]>([]);
  const [ships, setShips] = useState<Shipment[]>([]);
  const [pkgs, setPkgs] = useState<PackagingCost[]>([]);

  const [view, setView] = useState<string>('dashboard');
  const [modal, setModal] = useState<{ type: 'co' | 'po' | 'ship'; data: any | null } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load everything from unified storage service
  const loadAllData = async () => {
    try {
      const pChars = await StorageService.getChars();
      const pSeries = await StorageService.getSeries();
      const pProducts = await StorageService.getProducts();
      const pCos = await StorageService.getClientOrders();
      const pPos = await StorageService.getPreOrders();
      const pShips = await StorageService.getShipments();
      const pPkgs = await StorageService.getPackagingCosts();

      setChars(pChars);
      setSeries(pSeries);
      setProducts(pProducts);
      setCos(pCos);
      setPos(pPos);
      setShips(pShips);
      setPkgs(pPkgs);
    } catch (e) {
      console.error("Failed to load local/cloud databases:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Utility to map/resolve compound descriptive product labels
  const expandProduct = (p: Product): string => {
    const serObj = series.find(s => s.id === p.seriesId);
    const charObj = chars.find(c => c.id === p.characterId);
    return [serObj?.name || '', p.spec, charObj?.name || '']
      .filter(Boolean)
      .join(' · ');
  };

  /* ──────────────── CUSTOM BUSINESS PROCESSORS ──────────────── */

  // A. CUSTOMER ORDERS LOG
  const saveCo = async (co: ClientOrder) => {
    const isNew = !co.id;
    const finalId = co.id || 'co_' + Math.random().toString(36).slice(2, 10);
    const finalRecord: ClientOrder = {
      ...co,
      id: finalId,
      createdAt: co.createdAt || new Date().toISOString()
    };

    await StorageService.saveClientOrder(finalRecord);
    setModal(null);
    await loadAllData();
  };

  const deleteCo = async (id: string) => {
    if (!window.confirm('確定要永久刪除此客戶訂單檔案嗎？將會解除所有已串聯預購包裹的綁定。')) return;
    
    // Remove the co links from pre-orders (pos)
    const updatedPos = pos.map(p => ({
      ...p,
      linkedItems: (p.linkedItems || []).filter(li => li.coId !== id)
    }));

    for (const p of updatedPos) {
      await StorageService.savePreOrder(p);
    }

    await StorageService.deleteClientOrder(id);
    await loadAllData();
  };

  // Toggle cliente order status
  const handleToggleOrdered = async (co: ClientOrder) => {
    const updated = { ...co, clientOrdered: !co.clientOrdered };
    await StorageService.saveClientOrder(updated);
    await loadAllData();
  };

  const handleMarkItemSent = async (coId: string, itemId: string) => {
    const co = cos.find(c => c.id === coId);
    if (!co) return;
    const updatedItems = co.items.map(i => i.id === itemId ? { ...i, status: 'sent_to_client' as const } : i);
    await StorageService.saveClientOrder({ ...co, items: updatedItems });
    await loadAllData();
  };

  // B. PRE-ORDERS / MERCHANDISE PURCHASES BINDER
  const savePo = async (po: PreOrder) => {
    const finalId = po.id || 'po_' + Math.random().toString(36).slice(2, 10);
    const finalRecord: PreOrder = {
      ...po,
      id: finalId,
      createdAt: po.createdAt || new Date().toISOString()
    };

    const oldPo = pos.find(p => p.id === finalId);
    const oldLinked = oldPo?.linkedItems || [];
    const newLinked = po.linkedItems || [];

    // Detect items removed from linkage
    let updatedCos = [...cos];
    oldLinked.forEach(li => {
      const isStillLinked = newLinked.some(n => n.coId === li.coId && n.itemId === li.itemId);
      if (!isStillLinked) {
        updatedCos = updatedCos.map(c => c.id === li.coId ? {
          ...c,
          items: c.items.map(item => item.id === li.itemId ? { ...item, status: 'pending' as const, poId: '' } : item)
        } : c);
      }
    });

    // Detect newly linked items
    newLinked.forEach(li => {
      updatedCos = updatedCos.map(c => c.id === li.coId ? {
        ...c,
        items: c.items.map(item => item.id === li.itemId ? { ...item, status: 'ordered' as const, poId: finalId } : item)
      } : c);
    });

    // Save and commit client orders affected
    for (const c of updatedCos) {
      await StorageService.saveClientOrder(c);
    }

    await StorageService.savePreOrder(finalRecord);
    setModal(null);
    await loadAllData();
  };

  const deletePo = async (id: string) => {
    if (!window.confirm('確定要永久刪除此海外採購預購單嗎？所有已關聯的客戶單品狀態將被重置回「待訂購」。')) return;

    const poDoc = pos.find(p => p.id === id);
    if (poDoc) {
      // Restore linked items status and clear poId references
      const linked = poDoc.linkedItems || [];
      for (const li of linked) {
        const co = cos.find(c => c.id === li.coId);
        if (co) {
          const updatedItems = co.items.map(i => i.id === li.itemId ? { ...i, status: 'pending' as const, poId: '' } : i);
          await StorageService.saveClientOrder({ ...co, items: updatedItems });
        }
      }
    }

    // Clean current shipment bounds
    const updatedShips = ships.map(s => ({
      ...s,
      poIds: (s.poIds || []).filter(pid => pid !== id)
    }));
    for (const s of updatedShips) {
      await StorageService.saveShipment(s);
    }

    await StorageService.deletePreOrder(id);
    await loadAllData();
  };

  // C. FREIGHT INTERNATIONAL SHIPMENT TRACKING
  const saveShip = async (ship: Shipment) => {
    const finalId = ship.id || 'ship_' + Math.random().toString(36).slice(2, 10);
    const finalRecord: Shipment = {
      ...ship,
      id: finalId,
      createdAt: ship.createdAt || new Date().toISOString()
    };

    const oldShip = ships.find(s => s.id === finalId);
    const oldPoIds = oldShip?.poIds || [];
    const allPoIds = [...new Set([...oldPoIds, ...ship.poIds])];

    let updatedCos = [...cos];

    allPoIds.forEach(poId => {
      const poObj = pos.find(p => p.id === poId);
      if (!poObj) return;

      const inNewCarrier = ship.poIds.includes(poId);
      
      (poObj.linkedItems || []).forEach(li => {
        updatedCos = updatedCos.map(c => c.id === li.coId ? {
          ...c,
          items: c.items.map(item => {
            if (item.id !== li.itemId) return item;
            if (item.status === 'sent_to_client') return item; // retain finished items

            // If removed from shipment bundle, role-back state to ordered
            if (!inNewCarrier) {
              return { ...item, status: 'ordered' as const };
            }
            
            // Map stage from shipment stage
            return { ...item, status: ship.stage };
          })
        } : c);
      });
    });

    // Automatically flag preorder stages to "arrived" when cargo is arrived
    let updatedPos = [...pos];
    if (ship.stage === 'arrived') {
      ship.poIds.forEach(poId => {
        updatedPos = updatedPos.map(p => p.id === poId && p.stage !== 'done' ? { ...p, stage: 'arrived' as const } : p);
      });
    } else {
      // Revert if set back to transit
      ship.poIds.forEach(poId => {
        updatedPos = updatedPos.map(p => p.id === poId && p.stage === 'arrived' ? { ...p, stage: 'ordered' as const } : p);
      });
    }

    // Safe updates commit block
    for (const c of updatedCos) {
      await StorageService.saveClientOrder(c);
    }
    for (const p of updatedPos) {
      await StorageService.savePreOrder(p);
    }

    await StorageService.saveShipment(finalRecord);
    setModal(null);
    await loadAllData();
  };

  const updateShipStageDirectly = async (shipId: string, stage: 'packed' | 'shipped_from' | 'in_transit' | 'arrived') => {
    const ship = ships.find(s => s.id === shipId);
    if (!ship) return;
    await saveShip({ ...ship, stage });
  };

  const deleteShip = async (id: string) => {
    if (!window.confirm('確定要永久刪除此國際運送包裹打包單嗎？關聯單品狀態將復原回「已訂購」狀態。')) return;

    const shipDoc = ships.find(s => s.id === id);
    if (shipDoc) {
      const poIds = shipDoc.poIds || [];
      for (const poId of poIds) {
        const poObj = pos.find(p => p.id === poId);
        if (poObj) {
          const linked = poObj.linkedItems || [];
          for (const li of linked) {
            const co = cos.find(c => c.id === li.coId);
            if (co) {
              const updatedItems = co.items.map(item => {
                if (item.id === li.itemId && item.status !== 'sent_to_client') {
                  return { ...item, status: 'ordered' as const };
                }
                return item;
              });
              await StorageService.saveClientOrder({ ...co, items: updatedItems });
            }
          }
        }
      }
    }

    await StorageService.deleteShipment(id);
    await loadAllData();
  };

  // D. AUXILIARIES WRAP PACKAGING BILLS
  const handleSavePkgs = async (newPkgs: PackagingCost[]) => {
    setPkgs(newPkgs);
    // Find what changes and commit
    const currentLocal = await StorageService.getPackagingCosts();
    
    // Save new/mutated ones
    for (const p of newPkgs) {
      await StorageService.savePackagingCost(p);
    }
    
    // Detect deletes
    const deletes = currentLocal.filter(l => !newPkgs.some(p => p.id === l.id));
    for (const d of deletes) {
      await StorageService.deletePackagingCost(d.id);
    }

    await loadAllData();
  };

  const handleSaveChars = async (newChars: Character[]) => {
    setChars(newChars);
    const curr = await StorageService.getChars();
    for (const c of newChars) {
      await StorageService.saveChar(c);
    }
    const deletes = curr.filter(o => !newChars.some(n => n.id === o.id));
    for (const d of deletes) {
      await StorageService.deleteChar(d.id);
    }
    await loadAllData();
  };

  const handleSaveSeries = async (newSeries: Series[]) => {
    setSeries(newSeries);
    const curr = await StorageService.getSeries();
    for (const s of newSeries) {
      await StorageService.saveSeries(s);
    }
    const deletes = curr.filter(o => !newSeries.some(n => n.id === o.id));
    for (const d of deletes) {
      await StorageService.deleteSeries(d.id);
    }
    await loadAllData();
  };

  const handleSaveProducts = async (newProducts: Product[]) => {
    setProducts(newProducts);
    const curr = await StorageService.getProducts();
    for (const p of newProducts) {
      await StorageService.saveProduct(p);
    }
    const deletes = curr.filter(o => !newProducts.some(n => n.id === o.id));
    for (const d of deletes) {
      await StorageService.deleteProduct(d.id);
    }
    await loadAllData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F0E8] text-[#3A72A0] font-sans antialiased">
        <div className="w-10 h-10 border-4 border-[#3A72A0] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-semibold tracking-widest uppercase">系統加載自檢中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F0E8]">
      {/* Premium Top Navigation header bar */}
      <header className="sticky top-0 bg-[#EDE8DE] border-b border-[#BEB8AE] py-3.5 px-4 sm:px-6 flex items-center justify-between z-40 shadow-xs">
        <div className="flex items-center gap-2">
          {/* Circular launcher badge */}
          <div className="w-9 h-9 border border-[#BEB8AE] bg-white rounded-lg flex items-center justify-center overflow-hidden">
            <img src="icon-192.png" alt="logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-serif font-black text-sm text-[#3A72A0] tracking-wide leading-none">yuchishopping</h1>
            <p className="text-[10px] text-gray-500 font-sans tracking-widest mt-1 uppercase">代購管理系統</p>
          </div>
        </div>
      </header>

      {/* Main viewport panels */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 pb-28">
        {view === 'dashboard' && (
          <DashboardView 
            cos={cos} 
            pos={pos} 
            ships={ships} 
            pkgs={pkgs} 
            onNavigate={setView}
            onRefreshAll={loadAllData}
          />
        )}

        {view === 'customer' && (
          <ClientOrdersView
            cos={cos}
            pos={pos}
            onToggleOrdered={handleToggleOrdered}
            onMarkSent={handleMarkItemSent}
            onEdit={(c) => setModal({ type: 'co', data: c })}
            onDelete={deleteCo}
            onNew={() => setModal({ type: 'co', data: null })}
          />
        )}

        {view === 'purchase' && (
          <PreOrdersView
            pos={pos}
            cos={cos}
            ships={ships}
            onEdit={(p) => setModal({ type: 'po', data: p })}
            onDelete={deletePo}
            onNew={() => setModal({ type: 'po', data: null })}
          />
        )}

        {view === 'shipment' && (
          <ShipmentView
            ships={ships}
            pos={pos}
            onEdit={(s) => setModal({ type: 'ship', data: s })}
            onDelete={deleteShip}
            onNew={() => setModal({ type: 'ship', data: null })}
            onStageChange={updateShipStageDirectly}
          />
        )}

        {view === 'products' && (
          <ProductsView
            chars={chars}
            series={series}
            products={products}
            saveChars={handleSaveChars}
            saveSeries={handleSaveSeries}
            saveProducts={handleSaveProducts}
            expandProduct={expandProduct}
          />
        )}

        {view === 'packaging' && (
          <PackagingView
            pkgs={pkgs}
            savePkgs={handleSavePkgs}
          />
        )}
      </main>

      {/* Responsive Bottom Menu Drawer */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#EDE8DE] border-t border-[#BEB8AE] flex justify-around p-2 pb-[max(12px,env(safe-area-inset-bottom))] z-40 shadow-lg">
        {[
          { id: 'dashboard', label: '總覽摘要', icon: LayoutDashboard },
          { id: 'customer',  label: '客戶訂單', icon: User },
          { id: 'purchase',  label: '採購單', icon: ShoppingBag },
          { id: 'shipment',  label: '包裹運送', icon: Truck },
          { id: 'products',  label: '商品規格', icon: FolderHeart },
          { id: 'packaging', label: '包耗材額', icon: Box }
        ].map((item) => {
          const IconComponent = item.icon;
          const isSelected = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer select-none border-t-2 h-14 ${
                isSelected 
                  ? 'bg-[#3A72A0]/5 text-[#3A72A0] font-extrabold border-[#3A72A0]'
                  : 'text-gray-500 border-transparent hover:text-gray-800'
              }`}
              id={`nav-btn-${item.id}`}
            >
              <IconComponent className="w-5 h-5 shrink-0" />
              <span className="text-[10px] tracking-wide mt-1.5 whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* POPUP MODAL OVERLAY COMPILER */}
      {modal?.type === 'co' && (
        <CoModal
          order={modal.data}
          products={products}
          chars={chars}
          series={series}
          expandProduct={expandProduct}
          onSave={saveCo}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'po' && (
        <PoModal
          po={modal.data}
          cos={cos}
          expandProduct={expandProduct}
          onSave={savePo}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'ship' && (
        <ShipModal
          ship={modal.data}
          pos={pos}
          ships={ships}
          onSave={saveShip}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
