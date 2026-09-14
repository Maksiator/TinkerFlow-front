import { apiClient } from './client';

export interface ImportProjectRow {
	projectName: string;
	projectCode: string;
	statuses: string[];
}

export interface ImportMatrixRequest {
	groupId?: string | null;
	studentNames: string[];
	rows: ImportProjectRow[];
	selectedStudentNames?: string[];
}

export interface MatchedStudentDto {
	nameInExcel: string;
	studentId?: string | null;
	studentName?: string | null;
	groupId?: string | null;
	groupName?: string | null;
	branchId?: string | null;
	branchName?: string | null;
	isMatched: boolean;
}

export const importService = {
	matchStudents: async (studentNames: string[]) => {
		const response = await apiClient.post<MatchedStudentDto[]>('/imports/match-students', { studentNames });
		return response.data;
	},

	importProjectsMatrix: async (data: ImportMatrixRequest) => {
		const response = await apiClient.post<{ message: string }>('/imports/projects-matrix', data);
		return response.data;
	},
};
