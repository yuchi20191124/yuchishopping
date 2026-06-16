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
  DollarSign,
  RefreshCw 
} from 'lucide-react';
import { 
  Character, 
  Series, 
  Product, 
  ClientOrder, 
  PreOrder, 
  Shipment, 
  PackagingCost,
  CoItem,
  Customer
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
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [view, setView] = useState<string>('dashboard');
  const [modal, setModal] = useState<{ type: 'co' | 'po' | 'ship'; data: any | null } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadAllData();
    } catch (e) {
      console.error("Manual refresh failed:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load everything from unified storage service
  const loadAllData = async () => {
    try {
      const [pChars, pSeries, pProducts, pCos, pPos, pShips, pPkgs, pCustomers] = await Promise.all([
        StorageService.getChars().catch(e => {
          console.warn("Could not load chars from Cloud, trying local:", e);
          try {
            const localVal = localStorage.getItem("of_chars");
            return localVal ? JSON.parse(localVal) : [];
          } catch (_) { return []; }
        }),
        StorageService.getSeries().catch(e => {
          console.warn("Could not load series from Cloud, trying local:", e);
          try {
            const localVal = localStorage.getItem("of_series");
            return localVal ? JSON.parse(localVal) : [];
          } catch (_) { return []; }
        }),
        StorageService.getProducts().catch(e => {
          console.warn("Could not load products from Cloud, trying local:", e);
          try {
            const localVal = localStorage.getItem("of_products");
            return localVal ? JSON.parse(localVal) : [];
          } catch (_) { return []; }
        }),
        StorageService.getClientOrders().catch(e => {
          console.warn("Could not load client orders from Cloud, trying local:", e);
          try {
            const localVal = localStorage.getItem("of_cos");
            return localVal ? JSON.parse(localVal) : [];
          } catch (_) { return []; }
        }),
        StorageService.getPreOrders().catch(e => {
          console.warn("Could not load preorders from Cloud, trying local:", e);
          try {
            const localVal = localStorage.getItem("of_pos");
            return localVal ? JSON.parse(localVal) : [];
          } catch (_) { return []; }
        }),
        StorageService.getShipments().catch(e => {
          console.warn("Could not load shipments from Cloud, trying local:", e);
          try {
            const localVal = localStorage.getItem("of_ships");
            return localVal ? JSON.parse(localVal) : [];
          } catch (_) { return []; }
        }),
        StorageService.getPackagingCosts().catch(e => {
          console.warn("Could not load packaging costs from Cloud, trying local:", e);
          try {
            const localVal = localStorage.getItem("of_pkgs");
            return localVal ? JSON.parse(localVal) : [];
          } catch (_) { return []; }
        }),
        StorageService.getCustomers().catch(e => {
          console.warn("Could not load customers from Cloud, trying local:", e);
          try {
            const localVal = localStorage.getItem("of_customers");
            return localVal ? JSON.parse(localVal) : [];
          } catch (_) { return []; }
        })
      ]);

      setChars(pChars);
      setSeries(pSeries);
      setProducts(pProducts);
      setCos(pCos);
      setPos(pPos);
      setShips(pShips);
      setPkgs(pPkgs);

      // Deduplicate customers on application load to ensure absolute sanity
      const dedupedCusts: Customer[] = [];
      const seenCustKeys = new Set<string>();
      if (Array.isArray(pCustomers)) {
        pCustomers.forEach(c => {
          if (!c) return;
          const key = (c.customerIG || '').trim().toLowerCase() || (c.name || '').trim().toLowerCase();
          if (!key) return;
          if (!seenCustKeys.has(key)) {
            seenCustKeys.add(key);
            dedupedCusts.push(c);
          }
        });
      }
      setCustomers(dedupedCusts);
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

  // Merge multiple user-selected orders
  const handleMergeSelectedOrders = async (masterId: string, duplicateIds: string[]) => {
    if (!masterId || duplicateIds.length === 0) return;
    
    const master = cos.find(c => c.id === masterId);
    const duplicates = cos.filter(c => duplicateIds.includes(c.id));
    if (!master) return;

    // Merge items
    const mergedItems: CoItem[] = [...master.items];
    duplicates.forEach(d => {
      mergedItems.push(...(d.items || []));
    });

    // Merge notes
    const allNotes = [master.notes, ...duplicates.map(d => d.notes)].filter(Boolean).join('; ');

    // Merge clientOrdered state: true if any is true
    const mergedClientOrdered = master.clientOrdered || duplicates.some(d => d.clientOrdered);

    const updatedMaster: ClientOrder = {
      ...master,
      items: mergedItems,
      notes: allNotes,
      clientOrdered: mergedClientOrdered
    };

    // Update all PreOrders that point to any item in duplicates
    const updatedPos = pos.map(po => {
      const needsUpdate = po.linkedItems?.some(li => duplicateIds.includes(li.coId));
      if (!needsUpdate) return po;

      return {
        ...po,
        linkedItems: po.linkedItems.map(li => {
          if (duplicateIds.includes(li.coId)) {
            return { ...li, coId: masterId }; // point old duplicate coId to masterId
          }
          return li;
        })
      };
    });

    const changedPos = updatedPos.filter((item, idx) => item !== pos[idx]);

    // Commit to Firestore using optimized read-free calls
    await Promise.all([
      StorageService.saveClientOrder(updatedMaster),
      ...duplicates.map(d => StorageService.deleteClientOrder(d.id)),
      ...changedPos.map(p => StorageService.savePreOrder(p))
    ]);

    // Instantly modify state in memory
    setCos(prev => {
      const filtered = prev.filter(c => !duplicateIds.includes(c.id));
      return filtered.map(c => c.id === masterId ? updatedMaster : c);
    });
    setPos(updatedPos);
  };

  // A. CUSTOMER ORDERS LOG
  const saveCo = async (co: ClientOrder) => {
    const finalId = co.id || 'co_' + Math.random().toString(36).slice(2, 10);
    const finalRecord: ClientOrder = {
      ...co,
      id: finalId,
      createdAt: co.createdAt || new Date().toISOString()
    };

    const originalCo = cos.find(c => c.id === finalId);
    const previousIG = originalCo ? (originalCo.customerIG || '').trim() : '';
    const previousName = originalCo ? (originalCo.customerName || '').trim() : '';

    // Auto-update or add customer block
    const cleanIG = (finalRecord.customerIG || '').trim();
    const cleanName = (finalRecord.customerName || '').trim();

    let newCust: Customer | null = null;
    let updatedCust: Customer | null = null;
    let updatedOrders: ClientOrder[] = [];
    
    if (cleanIG || cleanName) {
      // Find matching customer safely, searching by OLD details if renamed, or NEW details otherwise
      const searchIG = previousIG || cleanIG;
      const searchName = previousName || cleanName;

      const existingCustomer = customers.find(c => 
        c && (
          (searchIG && (c.customerIG || '').toLowerCase() === searchIG.toLowerCase()) ||
          (searchName && (c.name || '').toLowerCase() === searchName.toLowerCase())
        )
      );

      if (!existingCustomer) {
        newCust = {
          id: 'cust_' + Math.random().toString(36).slice(2, 10),
          name: cleanName || cleanIG,
          customerIG: cleanIG || cleanName,
          createdAt: new Date().toISOString()
        };
      } else {
        let updated = false;
        const tempCust = { ...existingCustomer };
        if (cleanName && (existingCustomer.name || '') !== cleanName) {
          tempCust.name = cleanName;
          updated = true;
        }
        if (cleanIG && (existingCustomer.customerIG || '') !== cleanIG) {
          tempCust.customerIG = cleanIG;
          updated = true;
        }
        if (updated) {
          updatedCust = tempCust;
        }

        // Cascade update ALL other ClientOrders belonging to this customer to avoid orphaned or split records
        const igToRename = (existingCustomer.customerIG || '').trim().toLowerCase();
        const nameToRename = (existingCustomer.name || '').trim().toLowerCase();

        if (igToRename || nameToRename) {
          const ordersToUpdate = cos.filter(order => 
            order.id !== finalId && (
              (igToRename && (order.customerIG || '').toLowerCase() === igToRename) ||
              (nameToRename && (order.customerName || '').toLowerCase() === nameToRename)
            )
          );

          if (ordersToUpdate.length > 0) {
            updatedOrders = ordersToUpdate.map(order => ({
              ...order,
              customerIG: cleanIG || order.customerIG,
              customerName: cleanName || order.customerName
            }));
          }
        }
      }
    }

    // --- APPLY STATE UPDATES IMMEDIATELY ---
    if (newCust) {
      setCustomers(prev => [...prev, newCust!]);
    } else if (updatedCust) {
      setCustomers(prev => prev.map(c => c.id === updatedCust!.id ? updatedCust! : c));
    }

    setCos(prev => {
      let withSavedCo = prev.some(c => c.id === finalId)
        ? prev.map(c => c.id === finalId ? finalRecord : c)
        : [...prev, finalRecord];

      if (updatedOrders.length > 0) {
        withSavedCo = withSavedCo.map(order => {
          const matched = updatedOrders.find(u => u.id === order.id);
          return matched ? matched : order;
        });
      }
      return withSavedCo;
    });

    // Close the dialogue instantly
    setModal(null);

    // --- EXECUTE FIREBASE SAVES IN THE BACKGROUND ---
    (async () => {
      try {
        await StorageService.saveClientOrder(finalRecord);

        if (newCust) {
          await StorageService.saveCustomer(newCust);
        } else if (updatedCust) {
          await StorageService.saveCustomer(updatedCust);
        }

        if (updatedOrders.length > 0) {
          await Promise.all(updatedOrders.map(order => StorageService.saveClientOrder(order)));
        }
      } catch (e) {
        console.error("Background saveCo error:", e);
      }
    })();
  };

  const handleSaveCustomer = async (cust: Customer) => {
    const normalizedIG = (cust.customerIG || '').trim().toLowerCase();
    const normalizedName = (cust.name || '').trim().toLowerCase();

    // Check if another customer already exists with the same IG or Name
    const duplicate = customers.find(c => 
      c.id !== cust.id && (
        (normalizedIG && (c.customerIG || '').trim().toLowerCase() === normalizedIG) ||
        (normalizedName && (c.name || '').trim().toLowerCase() === normalizedName)
      )
    );

    let finalId = cust.id;
    let finalRecord = { ...cust };

    if (duplicate) {
      finalId = duplicate.id;
      finalRecord = {
        ...duplicate,
        ...cust,
        id: finalId,
        wishes: [
          ...(duplicate.wishes || []),
          ...(cust.wishes || []).filter(w => !(duplicate.wishes || []).some(dw => dw.id === w.id))
        ]
      };
    } else if (!finalId) {
      finalId = 'cust_' + Math.random().toString(36).slice(2, 10);
      finalRecord.id = finalId;
    }

    finalRecord.createdAt = finalRecord.createdAt || new Date().toISOString();

    // 1. Instantly update customer state
    setCustomers(prev => {
      const exists = prev.some(c => c.id === finalId);
      const updated = exists ? prev.map(c => c.id === finalId ? finalRecord : c) : [...prev, finalRecord];
      
      // Deduplicate to be absolutely safe
      const deduped: Customer[] = [];
      const seen = new Set<string>();
      updated.forEach(c => {
        const k = (c.customerIG || '').trim().toLowerCase() || (c.name || '').trim().toLowerCase();
        if (!k) return;
        if (!seen.has(k)) {
          seen.add(k);
          deduped.push(c);
        }
      });
      return deduped;
    });

    // 2. Cascade rename matching orders
    const oldCust = customers.find(c => c.id === finalId);
    let updatedOrders: ClientOrder[] = [];
    if (oldCust) {
      const oldIG = (oldCust.customerIG || '').trim().toLowerCase();
      const oldName = (oldCust.name || '').trim().toLowerCase();
      const newIG = (finalRecord.customerIG || '').trim();
      const newName = (finalRecord.name || '').trim();

      if (oldIG !== newIG.toLowerCase() || oldName !== newName.toLowerCase()) {
        const matchingOrders = cos.filter(order => 
          (oldIG && (order.customerIG || '').toLowerCase() === oldIG) ||
          (oldName && (order.customerName || '').toLowerCase() === oldName)
        );

        if (matchingOrders.length > 0) {
          updatedOrders = matchingOrders.map(order => ({
            ...order,
            customerIG: newIG || order.customerIG,
            customerName: newName || order.customerName
          }));

          // Update state
          setCos(prev => prev.map(o => {
            const u = updatedOrders.find(uo => uo.id === o.id);
            return u ? u : o;
          }));
        }
      }
    }

    // 3. Save background database operations
    (async () => {
      try {
        await StorageService.saveCustomer(finalRecord);
        if (updatedOrders.length > 0) {
          await Promise.all(updatedOrders.map(o => StorageService.saveClientOrder(o)));
        }
      } catch (err) {
        console.error("Background save customer error:", err);
      }
    })();
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('確定要永久刪除此客戶主檔嗎？這不會刪除該客戶已產生的歷史代購訂單。')) return;
    setCustomers(prev => prev.filter(c => c.id !== id));
    try {
      await StorageService.deleteCustomer(id);
    } catch (e) {
      console.error("Delete customer error:", e);
    }
  };

  const deleteCo = async (id: string) => {
    if (!window.confirm('確定要永久刪除此客戶訂單檔案嗎？將會解除所有已串聯預購包裹的綁定。')) return;
    
    // Remove the co links from pre-orders (pos)
    const updatedPos = pos.map(p => ({
      ...p,
      linkedItems: (p.linkedItems || []).filter(li => li.coId !== id)
    }));

    const changedPos = updatedPos.filter((item, idx) => item !== pos[idx]);

    // Direct state removal instantly
    setCos(prev => prev.filter(c => c.id !== id));
    setPos(updatedPos);

    // Run Firebase delete and saves in the background
    (async () => {
      try {
        await Promise.all([
          ...changedPos.map(p => StorageService.savePreOrder(p)),
          StorageService.deleteClientOrder(id)
        ]);
      } catch (e) {
        console.error("Background deleteCo error:", e);
      }
    })();
  };

  // Toggle client order status
  const handleToggleOrdered = async (co: ClientOrder) => {
    const updated = { ...co, clientOrdered: !co.clientOrdered };
    
    // Direct in-memory update
    setCos(prev => prev.map(c => c.id === co.id ? updated : c));

    // Save in the background
    (async () => {
      try {
        await StorageService.saveClientOrder(updated);
      } catch (e) {
        console.error("Background toggle error:", e);
      }
    })();
  };

  const handleMarkItemSent = async (coId: string, itemId: string) => {
    const co = cos.find(c => c.id === coId);
    if (!co) return;
    const updatedItems = co.items.map(i => i.id === itemId ? { ...i, status: 'sent_to_client' as const } : i);
    const updated = { ...co, items: updatedItems };
    
    // Direct in-memory update
    setCos(prev => prev.map(c => c.id === coId ? updated : c));

    // Save in the background
    (async () => {
      try {
        await StorageService.saveClientOrder(updated);
      } catch (e) {
        console.error("Background mark item sent error:", e);
      }
    })();
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

    const changedCos = updatedCos.filter((item, idx) => item !== cos[idx]);

    // Apply state updates instantly
    setCos(updatedCos);
    setPos(prev => prev.some(p => p.id === finalId)
      ? prev.map(p => p.id === finalId ? finalRecord : p)
      : [...prev, finalRecord]
    );

    setModal(null);

    // Save in the background
    (async () => {
      try {
        await Promise.all([
          ...changedCos.map(c => StorageService.saveClientOrder(c)),
          StorageService.savePreOrder(finalRecord)
        ]);
      } catch (e) {
        console.error("Background savePo error:", e);
      }
    })();
  };

  const deletePo = async (id: string) => {
    if (!window.confirm('確定要永久刪除此海外採購預購單嗎？所有已關聯的客戶單品狀態將被重置回「待訂購」。')) return;

    const poDoc = pos.find(p => p.id === id);
    const updatedCosMap = new Map<string, ClientOrder>();

    if (poDoc) {
      const linked = poDoc.linkedItems || [];
      for (const li of linked) {
        const existingCo = updatedCosMap.get(li.coId) || cos.find(c => c.id === li.coId);
        if (existingCo) {
          const updatedItems = existingCo.items.map(i => i.id === li.itemId ? { ...i, status: 'pending' as const, poId: '' } : i);
          updatedCosMap.set(li.coId, { ...existingCo, items: updatedItems });
        }
      }
    }

    const updatedShips = ships.map(s => ({
      ...s,
      poIds: (s.poIds || []).filter(pid => pid !== id)
    }));
    const changedShips = updatedShips.filter((item, idx) => item !== ships[idx]);

    // Apply state updates instantly
    setCos(prev => prev.map(c => updatedCosMap.has(c.id) ? updatedCosMap.get(c.id)! : c));
    setShips(updatedShips);
    setPos(prev => prev.filter(p => p.id !== id));

    // Save in background
    (async () => {
      try {
        await Promise.all([
          ...Array.from(updatedCosMap.values()).map(co => StorageService.saveClientOrder(co)),
          ...changedShips.map(s => StorageService.saveShipment(s)),
          StorageService.deletePreOrder(id)
        ]);
      } catch (e) {
        console.error("Background deletePo error:", e);
      }
    })();
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
            if (item.status === 'sent_to_client') return item;

            if (!inNewCarrier) {
              return { ...item, status: 'ordered' as const };
            }
            return { ...item, status: ship.stage };
          })
        } : c);
      });
    });

    let updatedPos = [...pos];
    if (ship.stage === 'arrived') {
      ship.poIds.forEach(poId => {
        updatedPos = updatedPos.map(p => p.id === poId && p.stage !== 'done' ? { ...p, stage: 'arrived' as const } : p);
      });
    } else {
      ship.poIds.forEach(poId => {
        updatedPos = updatedPos.map(p => p.id === poId && p.stage === 'arrived' ? { ...p, stage: 'ordered' as const } : p);
      });
    }

    const changedCos = updatedCos.filter((item, idx) => item !== cos[idx]);
    const changedPos = updatedPos.filter((item, idx) => item !== pos[idx]);

    // Apply state updates instantly
    setCos(updatedCos);
    setPos(updatedPos);
    setShips(prev => prev.some(s => s.id === finalId)
      ? prev.map(s => s.id === finalId ? finalRecord : s)
      : [...prev, finalRecord]
    );

    setModal(null);

    // Save in background
    (async () => {
      try {
        await Promise.all([
          ...changedCos.map(c => StorageService.saveClientOrder(c)),
          ...changedPos.map(p => StorageService.savePreOrder(p)),
          StorageService.saveShipment(finalRecord)
        ]);
      } catch (e) {
        console.error("Background saveShip error:", e);
      }
    })();
  };

  const updateShipStageDirectly = async (shipId: string, stage: 'packed' | 'shipped_from' | 'in_transit' | 'arrived') => {
    const ship = ships.find(s => s.id === shipId);
    if (!ship) return;
    await saveShip({ ...ship, stage });
  };

  const deleteShip = async (id: string) => {
    if (!window.confirm('確定要永久刪除此國際運送包裹打包單嗎？關聯單品狀態將復原回「已訂購」狀態。')) return;

    const shipDoc = ships.find(s => s.id === id);
    const updatedCosMap = new Map<string, ClientOrder>();

    if (shipDoc) {
      const poIds = shipDoc.poIds || [];
      for (const poId of poIds) {
        const poObj = pos.find(p => p.id === poId);
        if (poObj) {
          const linked = poObj.linkedItems || [];
          for (const li of linked) {
            const existingCo = updatedCosMap.get(li.coId) || cos.find(c => c.id === li.coId);
            if (existingCo) {
              const updatedItems = existingCo.items.map(item => {
                if (item.id === li.itemId && item.status !== 'sent_to_client') {
                  return { ...item, status: 'ordered' as const };
                }
                return item;
              });
              updatedCosMap.set(li.coId, { ...existingCo, items: updatedItems });
            }
          }
        }
      }
    }

    // Apply state updates instantly
    setCos(prev => prev.map(c => updatedCosMap.has(c.id) ? updatedCosMap.get(c.id)! : c));
    setShips(prev => prev.filter(s => s.id !== id));

    // Save in background
    (async () => {
      try {
        await Promise.all([
          ...Array.from(updatedCosMap.values()).map(co => StorageService.saveClientOrder(co)),
          StorageService.deleteShipment(id)
        ]);
      } catch (e) {
        console.error("Background deleteShip error:", e);
      }
    })();
  };

  // D. AUXILIARIES WRAP PACKAGING BILLS
  const handleSavePkgs = async (newPkgs: PackagingCost[]) => {
    setPkgs(newPkgs);
    const currentLocal = await StorageService.getPackagingCosts();
    
    const changedOrNew = newPkgs.filter(p => {
      const existing = currentLocal.find(o => o.id === p.id);
      return !existing || JSON.stringify(existing) !== JSON.stringify(p);
    });

    const savePromises = changedOrNew.map(p => StorageService.savePackagingCost(p));
    const deletes = currentLocal.filter(l => !newPkgs.some(p => p.id === l.id));
    const deletePromises = deletes.map(d => StorageService.deletePackagingCost(d.id));

    await Promise.all([...savePromises, ...deletePromises]);
  };

  const handleSaveChars = async (newChars: Character[]) => {
    setChars(newChars);
    const curr = await StorageService.getChars();
    
    const changedOrNew = newChars.filter(c => {
      const existing = curr.find(o => o.id === c.id);
      return !existing || JSON.stringify(existing) !== JSON.stringify(c);
    });

    const savePromises = changedOrNew.map(c => StorageService.saveChar(c));
    const deletes = curr.filter(o => !newChars.some(n => n.id === o.id));
    const deletePromises = deletes.map(d => StorageService.deleteChar(d.id));

    await Promise.all([...savePromises, ...deletePromises]);
  };

  const handleSaveSeries = async (newSeries: Series[]) => {
    setSeries(newSeries);
    const curr = await StorageService.getSeries();

    const changedOrNew = newSeries.filter(s => {
      const existing = curr.find(o => o.id === s.id);
      return !existing || JSON.stringify(existing) !== JSON.stringify(s);
    });

    const savePromises = changedOrNew.map(s => StorageService.saveSeries(s));
    const deletes = curr.filter(o => !newSeries.some(n => n.id === o.id));
    const deletePromises = deletes.map(d => StorageService.deleteSeries(d.id));

    await Promise.all([...savePromises, ...deletePromises]);
  };

  const handleSaveProducts = async (newProducts: Product[]) => {
    setProducts(newProducts);
    const curr = await StorageService.getProducts();

    const changedOrNew = newProducts.filter(p => {
      const existing = curr.find(o => o.id === p.id);
      return !existing || JSON.stringify(existing) !== JSON.stringify(p);
    });

    const savePromises = changedOrNew.map(p => StorageService.saveProduct(p));
    const deletes = curr.filter(o => !newProducts.some(n => n.id === o.id));
    const deletePromises = deletes.map(d => StorageService.deleteProduct(d.id));

    await Promise.all([...savePromises, ...deletePromises]);
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

        {/* Sync/Refresh Action Button */}
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#3A72A0] bg-white hover:bg-gray-50 active:scale-95 disabled:opacity-60 border border-[#BEB8AE] rounded-xl transition-all cursor-pointer select-none"
          title="手動重新整理網頁/雲端資料"
          id="btn-sync-refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
          <span>{isRefreshing ? '同步中...' : '同步更新'}</span>
        </button>
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
            onMergeSelectedOrders={handleMergeSelectedOrders}
            customers={customers}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            products={products}
            expandProduct={expandProduct}
            onSaveCo={saveCo}
            chars={chars}
            series={series}
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
            cos={cos}
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
          customers={customers}
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
          cos={cos}
          onSave={saveShip}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
