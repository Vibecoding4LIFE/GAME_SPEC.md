// src/net/index.ts – öffentliche API des Mehrspieler-Teils (B4). round/host/lobby/results/drillSpec sind reine Logik;
// transport.ts nutzt Browser-APIs (BroadcastChannel) nur in BroadcastChannelTransport.
export * from './config';
export * from './roomCode';
export * from './messages';
export * from './round';
export * from './clockOffset';
export * from './transport';
export * from './budget';
export * from './lobby';
export * from './results';
export * from './drillSpec';
export * from './host';
export * from './client';
