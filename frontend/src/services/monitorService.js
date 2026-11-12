import api from './api.js';
const path = id => `/api/monitors/${encodeURIComponent(id)}`;
export async function listMonitors() { return (await api.get('/api/monitors')).data; }
export async function createMonitor(config) { return (await api.post('/api/monitors', config)).data; }
export async function updateMonitor(id, changes) { return (await api.patch(path(id), changes)).data; }
export async function deleteMonitor(id) { return (await api.delete(path(id))).data; }
export async function runMonitor(id) { return (await api.post(`${path(id)}/run`)).data; }
export async function monitorStatus() { return (await api.get('/api/monitors/status')).data; }
export async function monitorHistory(id, page = 1) { return (await api.get(`${path(id)}/history`, { params: { page } })).data; }
export async function monitorComparison(id, scanId) { return (await api.get(`${path(id)}/history/${encodeURIComponent(scanId)}/comparison`)).data; }
export async function listNotifications(page = 1, unread = false) { return (await api.get('/api/monitors/notifications', { params: { page, unread } })).data; }
export async function markNotificationRead(notification, read = true) { return (await api.patch(`${path(notification.monitorId)}/notifications/${encodeURIComponent(notification.id)}`, { read })).data; }
