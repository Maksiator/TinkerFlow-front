import { apiClient } from './client';

export const SkillLevel = {
	Beginner: 0,
	Intermediate: 1,
	Advanced: 2,
} as const;

export type SkillLevel = (typeof SkillLevel)[keyof typeof SkillLevel];

export interface Student {
	id: string;
	firstName: string;
	lastName: string;
	dateOfBirth: string;
	level: SkillLevel;
	isIndependent: boolean;
	needsAttention: boolean;
	groupId: string | null;
	groupName?: string | null;
	branchId?: string | null;
	recordHistory?: boolean;
	isMidYear?: boolean;
	academicYear?: string;
}

export type StudentRequest = Omit<Student, 'id' | 'groupName'>;

// NOWE: Interfejs dla paginacji (zgodny z backendem)
export interface PagedResult<T> {
	items: T[];
	totalCount: number;
	totalPages: number;
	currentPage: number;
	pageSize: number;
}

export interface StudentHistoryItem {
	studentId: string;
	firstName: string;
	lastName: string;
	dateOfBirth: string;
	archivedAt: string;
	academicYear: string;
	isMidYear: boolean;
}

export const studentService = {
	getAll: async (search: string = '', sortBy: string = 'lastName', sortOrder: string = 'asc', page: number = 1, pageSize: number = 15) => {
		const params = new URLSearchParams();
		if (search.trim() !== '') params.append('search', search);
		params.append('sortBy', sortBy);
		params.append('sortOrder', sortOrder);
		params.append('page', page.toString());
		params.append('pageSize', pageSize.toString());

		const res = await apiClient.get<PagedResult<Student>>(`/students?${params.toString()}`);
		return res.data;
	},

	getById: async (id: string) => {
		const res = await apiClient.get<Student>(`/students/${id}`);
		return res.data;
	},

	getByGroup: async (groupId: string): Promise<Student[]> => {
		const response = await apiClient.get<Student[]>(`/students/group/${groupId}`);
		return response.data;
	},

	getGroupHistory: async (groupId: string): Promise<StudentHistoryItem[]> => {
		const response = await apiClient.get<StudentHistoryItem[]>(`/students/group/${groupId}/history`);
		return response.data;
	},

	search: async (query: string) => {
		const res = await apiClient.get<Student[]>(`/students/search?query=${query}`);
		return res.data;
	},

	create: async (data: StudentRequest) => {
		const res = await apiClient.post<Student>('/students', data);
		return res.data;
	},

	createBulk: async (data: StudentRequest[]) => {
		const res = await apiClient.post<{ message: string }>('/students/bulk', data);
		return res.data;
	},

	update: async (id: string, data: StudentRequest) => {
		await apiClient.put(`/students/${id}`, data);
	},

	changeGroup: async (studentId: string, groupId: string | null, options?: { recordHistory: boolean, isMidYear: boolean, academicYear?: string }) => {
		const payload = { 
			groupId,
			recordHistory: options?.recordHistory ?? true,
			isMidYear: options?.isMidYear ?? false,
			academicYear: options?.academicYear
		};
		await apiClient.patch(`/students/${studentId}/group`, payload);
	},

	delete: async (id: string) => {
		await apiClient.delete(`/students/${id}`);
	},

	deleteBulk: async (studentIds: string[]) => {
		const res = await apiClient.post<{ count: number; message: string }>('/students/bulk-delete', { studentIds });
		return res.data;
	},

	changeGroupBulk: async (studentIds: string[], groupId: string | null, options?: { recordHistory?: boolean; isMidYear?: boolean; academicYear?: string }) => {
		const payload = {
			studentIds,
			groupId,
			recordHistory: options?.recordHistory ?? true,
			isMidYear: options?.isMidYear ?? false,
			academicYear: options?.academicYear
		};
		const res = await apiClient.post<{ count: number; message: string }>('/students/bulk-change-group', payload);
		return res.data;
	},

	getHistory: async (studentId: string) => {
		const res = await apiClient.get<StudentHistoryResponse>(`/students/${studentId}/history`);
		return res.data;
	},

	addGroupHistory: async (studentId: string, groupId: string, academicYear: string) => {
		await apiClient.post(`/students/${studentId}/history/groups`, { groupId, academicYear });
	},

	deleteGroupHistory: async (studentId: string, historyId: string) => {
		await apiClient.delete(`/students/${studentId}/history/groups/${historyId}`);
	}
};

export interface StudentHistoryResponse {
	groupHistory: {
		id: string;
		groupId: string;
		groupName: string;
		academicYear: string;
		archivedAt: string;
	}[];
	activeProjects: {
		id: string;
		projectId: string;
		projectName: string;
		status: number;
	}[];
}
