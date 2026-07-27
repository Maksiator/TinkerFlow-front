import { apiClient } from './client';

export interface ImportProjectRow {
	projectName: string;
	projectCode: string;
	statuses: string[];
}

export interface ImportMatrixRequest {
	groupId: string;
	studentNames: string[];
	rows: ImportProjectRow[];
}

export const importService = {
	importProjectsMatrix: async (data: ImportMatrixRequest) => {
		const response = await apiClient.post<{ message: string }>('/imports/projects-matrix', data);
		return response.data;
	},
};
