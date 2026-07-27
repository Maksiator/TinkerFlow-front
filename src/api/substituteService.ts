import { apiClient } from './client';

// TUTAJ BYŁ BŁĄD - BRAKOWAŁO validFrom i validUntil
export interface CreateSubstituteRequest {
	groupId: string;
	trainerId: string;
	lessonDate: string;
	validFrom?: string; // <--- TEGO CI BRAKOWAŁO
	validUntil?: string; // <--- I TEGO TEŻ
}

export interface SubstituteResponse {
	id: string;
	groupId: string;
	groupName: string;
	branchName?: string;
	trainerId: string;
	trainerName: string;
	lessonDate: string;
	validFrom: string;
	validUntil: string;
}

export const substituteService = {
	getAll: async () => {
		const res = await apiClient.get<SubstituteResponse[]>('/GroupSubstitutes');
		return res.data;
	},

	getMy: async () => {
		const res = await apiClient.get<SubstituteResponse[]>('/GroupSubstitutes/my');
		return res.data;
	},

	create: async (data: CreateSubstituteRequest) => {
		const res = await apiClient.post<SubstituteResponse>('/GroupSubstitutes', data);
		return res.data;
	},

	delete: async (id: string) => {
		await apiClient.delete(`/GroupSubstitutes/${id}`);
	},
};
