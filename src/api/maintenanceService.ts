import { apiClient } from './client';

export interface OrphanItem {
	id: string;
	entityType: string;
	reason: string;
	additionalInfo?: string;
}

export interface OrphanCategory {
	key: string;
	name: string;
	description: string;
	count: number;
	items: OrphanItem[];
}

export interface OrphanReportResponse {
	totalOrphansCount: number;
	checkedAt: string;
	categories: OrphanCategory[];
}

export interface CleanupOrphansRequest {
	categories?: string[];
}

export interface CleanupOrphansResponse {
	success: boolean;
	totalCleaned: number;
	cleanedByCategory: Record<string, number>;
	message: string;
}

export const maintenanceService = {
	getOrphans: async (): Promise<OrphanReportResponse> => {
		const response = await apiClient.get<OrphanReportResponse>('/maintenance/orphans');
		return response.data;
	},

	cleanupOrphans: async (categories?: string[]): Promise<CleanupOrphansResponse> => {
		const response = await apiClient.post<CleanupOrphansResponse>('/maintenance/cleanup', {
			categories: categories && categories.length > 0 ? categories : undefined,
		});
		return response.data;
	},
};
