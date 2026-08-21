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
  const entry: AuditLog = {
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

  void persistAuditEntry(entry);
  return entry;
}

async function persistAuditEntry(entry: AuditLog): Promise<void> {
  try {
    const token = getAuthToken();
    if (!token) return;

    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5080').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/audit-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
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

    if (!response.ok) console.error(`Audit log API HTTP ${response.status}`);
  } catch (error) {
    console.error('Audit log persistence failed:', error);
  }
}
