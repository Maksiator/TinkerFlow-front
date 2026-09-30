import axios from 'axios';
import { apiClient } from './client';

// Odwzorowanie enum ProjectState z C#
export const ProjectState = {
	NotStarted: 0,
	Scheduled: 1,
	InProgress: 2,
	ReadyToPrint: 3,
	Completed: 4,
} as const;

export type ProjectState = (typeof ProjectState)[keyof typeof ProjectState];

export const ProjectSoftware = {
	Tinkercad: 0,
	SolidWorks: 1,
} as const;

export type ProjectSoftware = (typeof ProjectSoftware)[keyof typeof ProjectSoftware];

export interface Project {
	id: string;
	name: string;
	code: string;
	sequenceOrder: number;
	isPractice: boolean;
	isYearBoundary: boolean;
	software: ProjectSoftware;
	isAdvanced: boolean;
}
// Omit usuwa 'id' z interfejsu Project, zostawiając resztę
export type ProjectRequest = Omit<Project, 'id'>;

export const projectService = {
	// GET
	getAll: async (software?: ProjectSoftware, isAdvanced?: boolean) => {
		const params: Record<string, unknown> = {};
		if (software !== undefined) params.software = software;
		if (isAdvanced !== undefined) params.isAdvanced = isAdvanced;
		const response = await apiClient.get<Project[]>('/projects', { params });
		return response.data.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
	},

	// POST
	create: async (project: ProjectRequest) => {
		const response = await apiClient.post<Project>('/projects', project);
		return response.data;
	},

	// POST BULK - Masowe dodawanie
	createBulk: async (projects: ProjectRequest[]) => {
		const response = await apiClient.post<{ message: string }>('/projects/bulk', projects);
		return response.data;
	},

	// PUT (do edycji, przyda się za chwilę)
	update: async (id: string, project: ProjectRequest) => {
		const response = await apiClient.put<Project>(`/projects/${id}`, project);
		return response.data;
	},

	// DELETE
	delete: async (id: string) => {
		try {
			await apiClient.delete(`/projects/${id}`);
		} catch (error) {
			if (axios.isAxiosError(error) && error.response) {
				const serverMessage = error.response.data?.message || error.response.data;

				throw new Error(typeof serverMessage === 'string' ? serverMessage : 'Nie można usunąć projektu.');
			}
			throw error;
		}
	},

	// Dodaj to do obiektu projectService
	getUsage: async (id: string) => {
		const response = await apiClient.get<Record<string, unknown>>(`/projects/${id}/usage`);
		return response.data;
	},

	reorder: async (items: { id: string; sequenceOrder: number }[]) => {
		const response = await apiClient.post<{ message: string }>('/projects/reorder', items);
		return response.data;
	},
};
