import { apiClient } from './client';

export interface AuditLogItem {
	id: string;
	timestamp: string;
	userId: string | null;
	userEmail: string | null;
	userName: string | null;
	userRole: string | null;
	action: string;
	category: string;
	entityId: string | null;
	entityName: string | null;
	details: string | null;
	ipAddress: string | null;
}

export interface AuditLogListResponse {
	items: AuditLogItem[];
	totalCount: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export interface AuditLogFiltersResponse {
	categories: string[];
	actions: string[];
}

export interface AuditLogQueryParams {
	page?: number;
	pageSize?: number;
	category?: string;
	actionName?: string;
	userId?: string;
	search?: string;
	fromDate?: string;
	toDate?: string;
}

export const auditLogService = {
	getLogs: async (params?: AuditLogQueryParams): Promise<AuditLogListResponse> => {
		const response = await apiClient.get<AuditLogListResponse>('/audit-logs', { params });
		return response.data;
	},

	getFilters: async (): Promise<AuditLogFiltersResponse> => {
		const response = await apiClient.get<AuditLogFiltersResponse>('/audit-logs/filters');
		return response.data;
	},

	cleanupOldLogs: async (olderThanDays = 90): Promise<{ deletedCount: number; message: string }> => {
		const response = await apiClient.delete<{ deletedCount: number; message: string }>('/audit-logs/cleanup', {
			params: { olderThanDays },
		});
		return response.data;
	},
};
