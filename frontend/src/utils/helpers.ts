export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return formatDate(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: 'text-red-600  bg-red-50  border-red-200 ',
    high: 'text-orange-600  bg-orange-50  border-orange-200 ',
    medium: 'text-amber-600  bg-amber-50  border-amber-200 ',
    low: 'text-green-600  bg-green-50  border-green-200 ',
    info: 'text-blue-600  bg-blue-50  border-blue-200 ',
  };
  return colors[severity.toLowerCase()] || colors.info;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-[var(--text-secondary)]  bg-[var(--surface-container-lowest)]  border-[var(--border-subtle)] ',
    active: 'text-blue-600  bg-blue-50  border-blue-200 ',
    analyzing: 'text-purple-600  bg-purple-50  border-purple-200 ',
    escalated: 'text-orange-600  bg-orange-50  border-orange-200 ',
    resolved: 'text-green-600  bg-green-50  border-green-200 ',
    closed: 'text-[var(--text-secondary)]  bg-[var(--surface-container-low)]  border-[var(--border-default)] ',
    archived: 'text-gray-500  bg-gray-100  border-gray-300 ',
  };
  return colors[status.toLowerCase()] || colors.pending;
}

export function getPriorityIcon(priority: string): string {
  const icons: Record<string, string> = {
    critical: '🔥',
    high: '⚠️',
    medium: '⚡',
    low: '📋',
  };
  return icons[priority.toLowerCase()] || '📋';
}

export function generateCaseNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}${month}-${random}`;
}