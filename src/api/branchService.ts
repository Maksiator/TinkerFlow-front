import { apiClient } from './client';

export interface Branch {
	id: string;
	name: string;
	groupCount: number; // To ten bonus, który dodaliśmy w kontrolerze
}

export interface CreateBranchRequest {
	name: string;
}

export interface UpdateBranchRequest {
	name: string;
}

export const branchService = {
	getAll: async () => {
		const response = await apiClient.get<Branch[]>('/branches');
		return response.data;
	},

	getById: async (id: string) => {
		const response = await apiClient.get<Branch>(`/branches/${id}`);
		return response.data;
	},

	create: async (data: CreateBranchRequest) => {
		const response = await apiClient.post<Branch>('/branches', data);
		return response.data;
	},

	update: async (id: string, data: UpdateBranchRequest) => {
		const response = await apiClient.put(`/branches/${id}`, data);
		return response.data;
	},

	delete: async (id: string) => {
		const response = await apiClient.delete(`/branches/${id}`);
		return response.data;
	},
};
