import { AuditLog, AuditCategory, AuditSeverity, UserProfile } from '../types';
import { generateId } from './utils';

function getAuthToken(): string | null {
  try {
    for (const key of Object.keys(sessionStorage)) {
      const value = sessionStorage.getItem(key);
      if (value && value.startsWith('eyJ')) return value;
    }
  } catch {
    // Authentication storage may be unavailable outside the browser.
  }
  return null;
}

function authHeaders(includeJson = false): HeadersInit {
  const token = getAuthToken();
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export function createAuditEntry(
  category: AuditCategory,
  severity: AuditSeverity,
  action: string,
  details: string,
  user: UserProfile,
  targetName?: string,
  targetId?: string,
  previousValue?: string,
  newValue?: string
): AuditLog {
  return {
    id: generateId('audit'),
    timestamp: new Date().toISOString(),
    category,
    severity,
    action,
    performedBy: user.name || 'System User',
    performedByRole: user.role || 'ADMIN',
    targetId,
    targetName,
    details,
    previousValue,
    newValue,
    ipAddress: undefined
  };
}

export async function loadAuditLogs(): Promise<AuditLog[]> {
  const response = await fetch('/api/audit-logs', {
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(`Audit log API HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload as AuditLog[];
}

export async function saveAuditLog(entry: AuditLog): Promise<AuditLog> {
  const response = await fetch('/api/audit-logs', {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      category: entry.category,
      severity: entry.severity,
      action: entry.action,
      details: entry.details,
      performedBy: entry.performedBy,
      performedByRole: entry.performedByRole,
      targetName: entry.targetName,
      targetId: entry.targetId,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      ipAddress: entry.ipAddress,
      timestamp: entry.timestamp
    })
  });

  if (!response.ok) {
    throw new Error(`Audit log save failed: HTTP ${response.status}`);
  }

  return await response.json() as AuditLog;
}

export async function purgeAuditLogs(): Promise<void> {
  const response = await fetch('/api/audit-logs', {
    method: 'DELETE',
    headers: authHeaders()
  });

  if (!response.ok) {
    throw new Error(`Audit log purge failed: HTTP ${response.status}`);
  }
}
