export type KBCategory = string;

export interface KBDocument {
  id: string;
  category: KBCategory;
  title: string;
  content: string;
  keywords: string[];
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface PlanMetadata {
  type: 'prepaid' | 'postpaid' | 'fiber';
  price: number;
  currency: 'PHP';
  validity: string;
  data?: string;
  calls?: string;
  texts?: string;
  speed?: string;
  channel?: string;
}

export interface StoreMetadata {
  city: string;
  address: string;
  hours: string;
  phone?: string;
  services: string[];
  coordinates?: {lat: number; lng: number};
}

export interface RoamingMetadata {
  zone: string;
  countries: string;
  dailyRate?: string;
  packages?: {name: string; price: number; includes: string}[];
}

export interface PaymentMetadata {
  channel: string;
  type: string;
  fee: string;
  processingTime: string;
}
