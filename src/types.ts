/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Character {
  id: string;
  name: string;
}

export interface Series {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  seriesId: string;
  characterId: string;
  spec: string;
  price: string;
}

export interface CoItem {
  id: string;
  productId: string;
  series: string;
  spec: string;
  character: string;
  qty: number;
  price: string;
  status: 'pending' | 'ordered' | 'packed' | 'shipped_from' | 'in_transit' | 'arrived' | 'sent_to_client';
  poId: string;
}

export interface ClientOrder {
  id: string;
  customerIG: string;
  customerName?: string;
  clientOrdered: boolean;
  items: CoItem[];
  notes: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  customerIG: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  vipLevel?: 'VIP' | 'Regular' | 'New' | 'Blacklist';
  wishes?: WishItem[];
}

export interface WishItem {
  id: string;
  itemName: string;
  price?: string;
  status: 'pending' | 'success' | 'failed';
  notes?: string;
  createdAt: string;
}

export interface PreOrder {
  id: string;
  name: string;
  stage: 'ordered' | 'paid' | 'arrived' | 'done';
  cardAmount: string;
  notes: string;
  linkedItems: { coId: string; itemId: string }[];
  createdAt: string;
}

export interface Shipment {
  id: string;
  name: string;
  stage: 'packed' | 'shipped_from' | 'in_transit' | 'arrived';
  shippingCost: string;
  poIds: string[];
  notes: string;
  createdAt: string;
}

export interface PackagingCost {
  id: string;
  name: string;
  amount: string;
  date: string;
  notes: string;
  createdAt: string;
}

