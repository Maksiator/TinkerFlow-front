import { apiClient } from './client';
import type { ProjectState } from './projectService';

// To musi idealnie odwzorowywać to, co pluje Twój select w C#
export interface GroupMatrixResponse {
	groupId: string;
	groupName: string;
	location: string;
	students: {
		studentId: string;
		fullName: string;
		projects: {
			projectId: string;
			projectName: string;
			status: ProjectState;
		}[];
	}[];
}

export interface PendingPrint {
	id: string; // To jest ID wpisu w StudentProjects
	studentName: string;
	projectName: string;
}

export const studentProjectService = {
	// Zmieniony endpoint - uderza prosto w Twój GroupsController!
	getForGroup: async (groupId: string) => {
		const res = await apiClient.get<GroupMatrixResponse>(`/groups/${groupId}/matrix`);
		return res.data;
	},

	getForGroupsBulk: async (groupIds: string[]) => {
		const res = await apiClient.post<GroupMatrixResponse[]>('/groups/matrix/bulk', groupIds);
		return res.data;
	},

	// Zapisywanie zostaje na starym adresie (StudentProjectsController)
	upsert: async (studentId: string, projectId: string, status: ProjectState) => {
		const payloadStatus = status === 0 ? null : status;
		await apiClient.post('/studentprojects/upsert', { studentId, projectId, status: payloadStatus });
	},
	getPendingPrints: async (groupId: string) => {
		const res = await apiClient.get<PendingPrint[]>(`/studentprojects/group/${groupId}/ready-to-print`);
		return res.data;
	},

	markAsCompleted: async (ids: string[]) => {
		const res = await apiClient.patch<{ message: string }>('/studentprojects/bulk-complete', ids);
		return res.data;
	},
};
