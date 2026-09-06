import { loadSession } from './token';
import { LiveApi } from './live';
import * as mock from './mock';
import type {
  AdvisoryData,
  BatchCurve,
  BatchHealth,
  BatchPnl,
  BatchWithMetrics,
  CaisseSummary,
  CashSession,
  Customer,
  CustomerStats,
  DashboardData,
  Expense,
  FarmMember,
  FeedMovement,
  FeedProduct,
  FeedStockSummary,
  HealthEvent,
  InputLot,
  OrderCanal,
  OrderFull,
  OrderStatus,
  OverviewPnl,
  PondageSummary,
  PointOfSale,
  Promotion,
  ProphylaxisEvent,
  ReferenceConstant,
  SaleFull,
  SaleSummary,
  SanitaryProtocol,
  SanitaryProtocolWithSteps,
  SlaughterOrder,
  TreatmentRecord,
  Building,
  Breed,
  BreedStandard,
} from './types';

const live = new LiveApi();

export function isLive(): boolean {
  const s = loadSession();
  if (!s?.token) return false;
  const farmId = s.activeFarmId ?? s.farms[0]?.id;
  return farmId !== 'farm-demo';
}

export function fetchDashboard(farmId: string, date?: string, time?: string): Promise<DashboardData> {
  return isLive() ? live.fetchDashboard(farmId, date, time) : mock.fetchDashboard(farmId, date);
}

export function fetchBatches(farmId: string): Promise<BatchWithMetrics[]> {
  return isLive() ? live.fetchBatches(farmId) : mock.fetchBatches(farmId);
}

export function fetchBatch(farmId: string, batchId: string): Promise<BatchWithMetrics> {
  return isLive() ? live.fetchBatch(farmId, batchId) : mock.fetchBatch(farmId, batchId);
}

export function fetchCurve(farmId: string, batchId: string): Promise<BatchCurve> {
  return isLive() ? live.fetchCurve(farmId, batchId) : mock.fetchCurve(farmId, batchId);
}

export function fetchAdvisory(farmId: string): Promise<AdvisoryData> {
  return isLive() ? live.fetchAdvisory(farmId) : mock.fetchAdvisory(farmId);
}

export function fetchFeedStock(farmId: string): Promise<FeedStockSummary> {
  return isLive() ? live.fetchFeedStock(farmId) : mock.fetchFeedStock(farmId);
}

export function fetchFeedProducts(farmId: string): Promise<FeedProduct[]> {
  return isLive() ? live.fetchFeedProducts(farmId) : mock.fetchFeedProducts(farmId);
}

export function fetchFeedMovements(farmId: string): Promise<FeedMovement[]> {
  return isLive() ? live.fetchFeedMovements(farmId) : mock.fetchFeedMovements(farmId);
}

export function fetchCaisseCurrent(farmId: string): Promise<CaisseSummary | null> {
  return isLive() ? live.fetchCaisseCurrent(farmId) : mock.fetchCaisseCurrent(farmId);
}

export function fetchCaisseSessions(farmId: string): Promise<CashSession[]> {
  return isLive() ? live.fetchCaisseSessions(farmId) : mock.fetchCaisseSessions(farmId);
}

export function fetchProtocols(): Promise<SanitaryProtocol[]> {
  return isLive() ? live.fetchProtocols() : mock.fetchProtocols();
}

export function fetchSanitaryProgram(
  id: string,
): Promise<SanitaryProtocolWithSteps> {
  return isLive()
    ? live.fetchSanitaryProgram(id)
    : mock.fetchSanitaryProgram(id);
}

export function fetchFarmInputs(farmId: string): Promise<InputLot[]> {
  return isLive() ? live.fetchFarmInputs(farmId) : mock.fetchFarmInputs(farmId);
}

export function fetchProphylaxis(farmId: string, batchId: string): Promise<ProphylaxisEvent[]> {
  return isLive() ? live.fetchProphylaxis(farmId, batchId) : mock.fetchProphylaxis(farmId, batchId);
}

export function fetchTreatments(farmId: string, batchId: string): Promise<TreatmentRecord[]> {
  return isLive() ? live.fetchTreatments(farmId, batchId) : mock.fetchTreatments(farmId, batchId);
}

export function fetchBatchHealth(farmId: string, batchId: string): Promise<BatchHealth> {
  return isLive() ? live.fetchBatchHealth(farmId, batchId) : mock.fetchBatchHealth(farmId, batchId);
}

export function fetchHealthEvents(farmId: string, batchId: string): Promise<HealthEvent[]> {
  return isLive() ? live.fetchHealthEvents(farmId, batchId) : mock.fetchHealthEvents(farmId, batchId);
}

export function fetchSlaughterOrders(farmId: string): Promise<SlaughterOrder[]> {
  return isLive() ? live.fetchSlaughterOrders(farmId) : mock.fetchSlaughterOrders(farmId);
}

export function fetchCustomers(farmId: string): Promise<Customer[]> {
  return isLive() ? live.fetchCustomers(farmId) : mock.fetchCustomers(farmId);
}

export function fetchCustomer(farmId: string, customerId: string): Promise<Customer> {
  return isLive() ? live.fetchCustomer(farmId, customerId) : mock.fetchCustomer(farmId, customerId);
}

export function fetchCustomerStats(farmId: string, customerId: string): Promise<CustomerStats> {
  return isLive() ? live.fetchCustomerStats(farmId, customerId) : mock.fetchCustomerStats(farmId, customerId);
}

export function fetchCustomerHistory(farmId: string, customerId: string): Promise<SaleFull[]> {
  return isLive() ? live.fetchCustomerHistory(farmId, customerId) : mock.fetchCustomerHistory(farmId, customerId);
}

export function fetchPromotions(farmId: string): Promise<Promotion[]> {
  return isLive() ? live.fetchPromotions(farmId) : mock.fetchPromotions(farmId);
}

export function fetchPointsOfSale(farmId: string): Promise<PointOfSale[]> {
  return isLive() ? live.fetchPointsOfSale(farmId) : mock.fetchPointsOfSale(farmId);
}

export function fetchPointOfSale(farmId: string, pointOfSaleId: string): Promise<PointOfSale> {
  return isLive() ? live.fetchPointOfSale(farmId, pointOfSaleId) : mock.fetchPointOfSale(farmId, pointOfSaleId);
}

export function fetchRentabiliteOverview(farmId: string, from?: string, to?: string): Promise<OverviewPnl> {
  return isLive() ? live.fetchRentabiliteOverview(farmId, from, to) : mock.fetchRentabiliteOverview(farmId, from, to);
}

export function fetchRentabiliteBatch(farmId: string, batchId: string): Promise<BatchPnl> {
  return isLive() ? live.fetchRentabiliteBatch(farmId, batchId) : mock.fetchRentabiliteBatch(farmId, batchId);
}

export function fetchSales(farmId: string, from?: string, to?: string): Promise<SaleSummary[]> {
  return isLive() ? live.fetchSales(farmId, from, to) : mock.fetchSales(farmId, from, to);
}

export function fetchExpenses(farmId: string, from?: string, to?: string): Promise<Expense[]> {
  return isLive() ? live.fetchExpenses(farmId, from, to) : mock.fetchExpenses(farmId, from, to);
}

export function fetchOrders(
  farmId: string,
  canal?: OrderCanal,
  status?: OrderStatus,
): Promise<OrderFull[]> {
  return isLive()
    ? live.fetchOrders(farmId, canal, status)
    : mock.fetchOrders(farmId, canal, status);
}

export function fetchOrder(farmId: string, orderId: string): Promise<OrderFull> {
  return isLive() ? live.fetchOrder(farmId, orderId) : mock.fetchOrder(farmId, orderId);
}

export function fetchPondage(farmId: string, batchId: string): Promise<PondageSummary> {
  return isLive() ? live.fetchPondage(farmId, batchId) : mock.fetchPondage(farmId, batchId);
}

export function fetchFarmMembers(farmId: string): Promise<FarmMember[]> {
  return isLive() ? live.fetchFarmMembers(farmId) : mock.fetchFarmMembers(farmId);
}

export function fetchReferenceConstants(): Promise<ReferenceConstant[]> {
  return isLive() ? live.fetchReferenceConstants() : mock.fetchReferenceConstants();
}

export function fetchBuildings(farmId: string): Promise<Building[]> {
  return isLive() && farmId !== 'farm-demo' ? live.fetchBuildings(farmId) : mock.fetchBuildings(farmId);
}

export function fetchBreeds(): Promise<Breed[]> {
  return isLive() ? live.fetchBreeds() : mock.fetchBreeds();
}

export function fetchBreedStandards(breedId: string): Promise<BreedStandard[]> {
  return isLive() ? live.fetchBreedStandards(breedId) : mock.fetchBreedStandards(breedId);
}