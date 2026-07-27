import { apiClient } from './client';

export interface PrintQueueItem {
	studentId: string;
	fullName: string;
	totalPrints: number;
	lastPrintDate: string | null;
}

export interface CreatePrintLog {
	studentId: string;
	printDate?: string;
}

// NOWE:
export interface PrintLogHistoryItem {
	id: string;
	studentId: string;
	fullName: string;
	printDate: string;
}

export interface UpdatePrintLog {
	studentId: string;
	printDate: string;
}

export const printLogService = {
	// STARE
	getQueue: async (groupId: string) => {
		const res = await apiClient.get<PrintQueueItem[]>(`/printlogs/group/${groupId}/queue`);
		return res.data;
	},

	addLog: async (data: CreatePrintLog) => {
		const res = await apiClient.post<{ message: string }>('/printlogs', data);
		return res.data;
	},

	// NOWE:
	getHistory: async (groupId: string) => {
		const res = await apiClient.get<PrintLogHistoryItem[]>(`/printlogs/group/${groupId}/history`);
		return res.data;
	},

	updateLog: async (id: string, data: UpdatePrintLog) => {
		const res = await apiClient.put<{ message: string }>(`/printlogs/${id}`, data);
		return res.data;
	},

	deleteLog: async (id: string) => {
		const res = await apiClient.delete<{ message: string }>(`/printlogs/${id}`);
		return res.data;
	},
};
