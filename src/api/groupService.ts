import { apiClient } from './client';

export interface Group {
	id: string;
	name: string;
	branchId: string;
	branchName: string;
	primaryTrainerId: string | null;
	primaryTrainerName: string | null;
	studentCount: number;
	classDayOfWeek?: number | null;
	isArchived?: boolean;
	archivedAcademicYear?: string | null;
}

export interface CreateGroup {
	name: string;
	branchId: string;
	primaryTrainerId?: string | null;
	classDayOfWeek?: number | null;
}

export interface UpdateGroup {
	name: string;
	branchId: string;
	primaryTrainerId?: string | null;
	classDayOfWeek?: number | null;
}

export const groupService = {
	getAll: async (includeArchived: boolean = false) => {
		try {
			const res = await apiClient.get<Group[]>(`/groups?includeArchived=${includeArchived}`);
			return res.data;
		} catch (error) {
			console.error('Błąd pobierania listy grup:', error);
			throw error;
		}
	},

	getById: async (id: string) => {
		try {
			const res = await apiClient.get<Group>(`/groups/${id}`);
			return res.data;
		} catch (error) {
			console.error(`Błąd pobierania grupy o ID ${id}:`, error);
			throw error;
		}
	},

	create: async (data: CreateGroup) => {
		try {
			const res = await apiClient.post<{ id: string }>('/groups', data);
			return res.data;
		} catch (error) {
			console.error('Błąd tworzenia nowej grupy:', error);
			throw error;
		}
	},

	update: async (id: string, data: UpdateGroup) => {
		try {
			await apiClient.put(`/groups/${id}`, data);
		} catch (error) {
			console.error(`Błąd aktualizacji grupy o ID ${id}:`, error);
			throw error;
		}
	},

	delete: async (id: string) => {
		try {
			await apiClient.delete(`/groups/${id}`);
		} catch (error) {
			console.error(`Błąd usuwania grupy o ID ${id}:`, error);
			throw error;
		}
	},

	deleteBulk: async (groupIds: string[]) => {
		try {
			const res = await apiClient.post<{ count: number; message: string }>('/groups/bulk-delete', { groupIds });
			return res.data;
		} catch (error) {
			console.error('Błąd masowego usuwania grup:', error);
			throw error;
		}
	},

	changeBranchBulk: async (groupIds: string[], branchId: string) => {
		try {
			const res = await apiClient.post<{ count: number; message: string }>('/groups/bulk-change-branch', { groupIds, branchId });
			return res.data;
		} catch (error) {
			console.error('Błąd masowej zmiany oddziału grup:', error);
			throw error;
		}
	},

	archive: async (id: string, academicYear: string) => {
		try {
			const res = await apiClient.post(`/groups/${id}/archive?academicYear=${encodeURIComponent(academicYear)}`);
			return res.data;
		} catch (error) {
			console.error(`Błąd archiwizacji grupy o ID ${id}:`, error);
			throw error;
		}
	},
};
