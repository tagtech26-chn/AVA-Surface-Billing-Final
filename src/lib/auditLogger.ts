import { AuditLog, AuditCategory, AuditSeverity, UserProfile } from '../types';
import { generateId } from './utils';

export function createAuditEntry(
  category: AuditCategory,
  severity: AuditSeverity,
  action: string,
  user: UserProfile,
  details: string,
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
    ipAddress: '192.168.1.104'
  };
}
