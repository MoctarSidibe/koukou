import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchAdvisory,
  fetchBatches,
  fetchCaisseCurrent,
  fetchCaisseSessions,
  fetchCustomerHistory,
  fetchCustomers,
  fetchExpenses,
  fetchFarmInputs,
  fetchFeedStock,
  fetchFarmMembers,
  fetchOrder,
  fetchOrders,
  fetchPromotions,
  fetchProphylaxis,
  fetchReferenceConstants,
  fetchRentabiliteBatch,
  fetchRentabiliteOverview,
  fetchSales,
  fetchSanitaryProgram,
  fetchSlaughterOrders,
  fetchTreatments,
  isLive,
} from './index';
import { clearSession, saveSession } from './token';
import type { PublicUser } from './types';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: 'demo.local:8081' } },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

vi.mock('./live', () => ({
  LiveApi: class {
    fetchDashboard = vi.fn(async () => ({ src: 'live' }));
    fetchBatches = vi.fn(async () => [{ src: 'live' }]);
    fetchBatch = vi.fn(async () => ({ src: 'live' }));
    fetchCurve = vi.fn(async () => ({ src: 'live' }));
    fetchAdvisory = vi.fn(async () => ({ src: 'live' }));
    fetchFeedStock = vi.fn(async () => ({ src: 'live' }));
    fetchCaisseCurrent = vi.fn(async () => ({ src: 'live' }));
    fetchCaisseSessions = vi.fn(async () => [{ src: 'live' }]);
    fetchFarms = vi.fn(async () => [{ src: 'live' }]);
    fetchProtocols = vi.fn(async () => [{ src: 'live' }]);
    fetchSanitaryProgram = vi.fn(async () => ({ src: 'live' }));
    fetchFarmInputs = vi.fn(async () => [{ src: 'live' }]);
    fetchProphylaxis = vi.fn(async () => [{ src: 'live' }]);
    fetchTreatments = vi.fn(async () => [{ src: 'live' }]);
    fetchSlaughterOrders = vi.fn(async () => [{ src: 'live' }]);
    fetchCustomers = vi.fn(async () => [{ src: 'live' }]);
    fetchCustomer = vi.fn(async () => ({ src: 'live' }));
    fetchCustomerStats = vi.fn(async () => ({ src: 'live' }));
    fetchCustomerHistory = vi.fn(async () => [{ src: 'live' }]);
    fetchPromotions = vi.fn(async () => [{ src: 'live' }]);
    fetchRentabiliteOverview = vi.fn(async () => ({ src: 'live' }));
    fetchRentabiliteBatch = vi.fn(async () => ({ src: 'live' }));
    fetchSales = vi.fn(async () => [{ src: 'live' }]);
    fetchExpenses = vi.fn(async () => [{ src: 'live' }]);
    fetchOrders = vi.fn(async () => [{ src: 'live' }]);
    fetchOrder = vi.fn(async () => ({ src: 'live' }));
    fetchFarmMembers = vi.fn(async () => [{ src: 'live' }]);
    fetchReferenceConstants = vi.fn(async () => [{ src: 'live' }]);
  },
}));

vi.mock('./mock', () => ({
  fetchDashboard: vi.fn(async () => ({ src: 'mock' })),
  fetchBatches: vi.fn(async () => [{ src: 'mock' }]),
  fetchBatch: vi.fn(async () => ({ src: 'mock' })),
  fetchCurve: vi.fn(async () => ({ src: 'mock' })),
  fetchAdvisory: vi.fn(async () => ({ src: 'mock' })),
  fetchFeedStock: vi.fn(async () => ({ src: 'mock' })),
  fetchCaisseCurrent: vi.fn(async () => ({ src: 'mock' })),
  fetchCaisseSessions: vi.fn(async () => [{ src: 'mock' }]),
  fetchProtocols: vi.fn(async () => [{ src: 'mock' }]),
  fetchSanitaryProgram: vi.fn(async () => ({ src: 'mock' })),
  fetchFarmInputs: vi.fn(async () => [{ src: 'mock' }]),
  fetchProphylaxis: vi.fn(async () => [{ src: 'mock' }]),
  fetchTreatments: vi.fn(async () => [{ src: 'mock' }]),
  fetchSlaughterOrders: vi.fn(async () => [{ src: 'mock' }]),
  fetchCustomers: vi.fn(async () => [{ src: 'mock' }]),
  fetchCustomer: vi.fn(async () => ({ src: 'mock' })),
  fetchCustomerStats: vi.fn(async () => ({ src: 'mock' })),
  fetchCustomerHistory: vi.fn(async () => [{ src: 'mock' }]),
  fetchPromotions: vi.fn(async () => [{ src: 'mock' }]),
  fetchRentabiliteOverview: vi.fn(async () => ({ src: 'mock' })),
  fetchRentabiliteBatch: vi.fn(async () => ({ src: 'mock' })),
  fetchSales: vi.fn(async () => [{ src: 'mock' }]),
  fetchExpenses: vi.fn(async () => [{ src: 'mock' }]),
  fetchOrders: vi.fn(async () => [{ src: 'mock' }]),
  fetchOrder: vi.fn(async () => ({ src: 'mock' })),
  fetchFarmMembers: vi.fn(async () => [{ src: 'mock' }]),
  fetchReferenceConstants: vi.fn(async () => [{ src: 'mock' }]),
}));

const user: PublicUser = { id: 'u-1', fullName: 'M. Test', phone: '+241 00 00 00 00', role: 'PROPRIETAIRE' };

beforeEach(() => {
  clearSession();
});

describe('facade @/api', () => {
  it('isLive dépend de la présence d’un token', () => {
    expect(isLive()).toBe(false);
    saveSession({ token: 'jwt', user, farms: [] });
    expect(isLive()).toBe(true);
  });

  it('route vers mock sans session', async () => {
    const batches = await fetchBatches('f-demo');
    expect(batches).toEqual([{ src: 'mock' }]);
    const adv = await fetchAdvisory('f-demo');
    expect(adv).toEqual({ src: 'mock' });
  });

  it('route vers live avec une session', async () => {
    saveSession({ token: 'jwt', user, farms: [] });
    const batches = await fetchBatches('f-live');
    expect(batches).toEqual([{ src: 'live' }]);
    const adv = await fetchAdvisory('f-live');
    expect(adv).toEqual({ src: 'live' });
  });

  it('route caisse / stock vers mock ou live', async () => {
    const feed = await fetchFeedStock('f-demo');
    expect(feed).toEqual({ src: 'mock' });
    const cur = await fetchCaisseCurrent('f-demo');
    expect(cur).toEqual({ src: 'mock' });
    const demo = await fetchCaisseSessions('f-demo');
    expect(demo).toEqual([{ src: 'mock' }]);

    saveSession({ token: 'jwt', user, farms: [] });
    const feedLive = await fetchFeedStock('f-live');
    expect(feedLive).toEqual({ src: 'live' });
    const curLive = await fetchCaisseCurrent('f-live');
    expect(curLive).toEqual({ src: 'live' });
    const live = await fetchCaisseSessions('f-live');
    expect(live).toEqual([{ src: 'live' }]);
  });

  it('route sanitaire / abattage / clients / rentabilité vers mock ou live', async () => {
    expect(await fetchProphylaxis('f-demo', 'b-1')).toEqual([{ src: 'mock' }]);
    expect(await fetchTreatments('f-demo', 'b-1')).toEqual([{ src: 'mock' }]);
    expect(await fetchSanitaryProgram('vacc-1')).toEqual({ src: 'mock' });
    expect(await fetchFarmInputs('f-demo')).toEqual([{ src: 'mock' }]);
    expect(await fetchSlaughterOrders('f-demo')).toEqual([{ src: 'mock' }]);
    expect(await fetchCustomers('f-demo')).toEqual([{ src: 'mock' }]);
    expect(await fetchCustomerHistory('f-demo', 'c-1')).toEqual([{ src: 'mock' }]);
    expect(await fetchPromotions('f-demo')).toEqual([{ src: 'mock' }]);
    expect(await fetchRentabiliteOverview('f-demo')).toEqual({ src: 'mock' });
    expect(await fetchRentabiliteBatch('f-demo', 'b-1')).toEqual({ src: 'mock' });
    expect(await fetchSales('f-demo')).toEqual([{ src: 'mock' }]);
    expect(await fetchExpenses('f-demo')).toEqual([{ src: 'mock' }]);
    expect(await fetchOrders('f-demo')).toEqual([{ src: 'mock' }]);
    expect(await fetchOrder('f-demo', 'ord-1')).toEqual({ src: 'mock' });
    expect(await fetchFarmMembers('f-demo')).toEqual([{ src: 'mock' }]);
    expect(await fetchReferenceConstants()).toEqual([{ src: 'mock' }]);

    saveSession({ token: 'jwt', user, farms: [] });
    expect(await fetchProphylaxis('f-live', 'b-1')).toEqual([{ src: 'live' }]);
    expect(await fetchTreatments('f-live', 'b-1')).toEqual([{ src: 'live' }]);
    expect(await fetchSanitaryProgram('vacc-1')).toEqual({ src: 'live' });
    expect(await fetchFarmInputs('f-live')).toEqual([{ src: 'live' }]);
    expect(await fetchSlaughterOrders('f-live')).toEqual([{ src: 'live' }]);
    expect(await fetchCustomers('f-live')).toEqual([{ src: 'live' }]);
    expect(await fetchCustomerHistory('f-live', 'c-1')).toEqual([{ src: 'live' }]);
    expect(await fetchPromotions('f-live')).toEqual([{ src: 'live' }]);
    expect(await fetchRentabiliteOverview('f-live')).toEqual({ src: 'live' });
    expect(await fetchRentabiliteBatch('f-live', 'b-1')).toEqual({ src: 'live' });
    expect(await fetchSales('f-live')).toEqual([{ src: 'live' }]);
    expect(await fetchExpenses('f-live')).toEqual([{ src: 'live' }]);
    expect(await fetchOrders('f-live')).toEqual([{ src: 'live' }]);
    expect(await fetchOrder('f-live', 'ord-1')).toEqual({ src: 'live' });
    expect(await fetchFarmMembers('f-live')).toEqual([{ src: 'live' }]);
    expect(await fetchReferenceConstants()).toEqual([{ src: 'live' }]);
  });
});