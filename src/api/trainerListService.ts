import { apiClient } from './client';
import { type Group } from './groupService';

export interface TrainerListRequest {
	name: string;
	groupIds: string[];
	targetDay?: number | null;
}

// Interfejs zgodny z backendowym TrainerListResponse
export interface TrainerList {
	id: string;
	name: string;
	groups: Group[];
	targetDay?: number | null;
}

export const trainerListService = {
	// Zmieniona nazwa na getMyLists (zgodnie z naszym nowym Dashboardem)
	getMyLists: async () => {
		const res = await apiClient.get<TrainerList[]>('/trainerlists');
		return res.data;
	},

	create: async (data: TrainerListRequest) => {
		const res = await apiClient.post<TrainerList>('/trainerlists', data);
		return res.data;
	},

	update: async (id: string, data: TrainerListRequest) => {
		await apiClient.put(`/trainerlists/${id}`, data);
	},

	delete: async (id: string) => {
		await apiClient.delete(`/trainerlists/${id}`);
	},
};
