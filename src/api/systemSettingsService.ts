import { apiClient } from './client';

export interface SystemSettings {
	substituteDaysBefore: number;
	substituteDaysAfter: number;
	printDeadlineDays: number;
	currentAcademicYear: string;
}

export const systemSettingsService = {
	getSettings: async () => {
		const res = await apiClient.get<SystemSettings>('/systemsettings');
		return res.data;
	},

	updateSettings: async (data: SystemSettings) => {
		const res = await apiClient.put<SystemSettings>('/systemsettings', data);
		return res.data;
	},

	closeAcademicYear: async (academicYear: string) => {
		const res = await apiClient.post<{ message: string }>('/endofyear/close-year', { academicYear });
		return res.data;
	},

	undoCloseAcademicYear: async (academicYear: string) => {
		const res = await apiClient.post<{ message: string }>('/endofyear/undo-close-year', { academicYear });
		return res.data;
	},
};
