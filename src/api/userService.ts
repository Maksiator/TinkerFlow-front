import { apiClient } from './client';
import axios from 'axios';

// ZAKTUALIZOWANE: Zgodnie z naszą nową logiką w C#
export const UserRole = {
	Admin: 0,
	Coordinator: 1,
	Trainer: 2,
	Printer: 3,
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// NOWE: Pomocniczy interfejs dla oddziałów użytkownika
export interface UserBranch {
	branchId: string;
	branchName: string;
}

export interface User {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	role: UserRole;
	isActive: boolean;
	branches: UserBranch[]; // NOWE: Teraz backend to zwraca
	mustChangePassword: boolean;
}

export interface PagedUserResponse {
	items: User[];
	totalCount: number;
	totalPages: number;
	page: number;
	pageSize: number;
}

export interface CreateUserRequest {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	role: UserRole;
	branchIds: string[]; // NOWE: Lista ID oddziałów
}

export interface UpdateUserRequest {
	firstName: string;
	lastName: string;
	role: UserRole;
	branchIds: string[]; // NOWE: Lista ID oddziałów
}

export interface ChangePasswordRequest {
	currentPassword: string;
	newPassword: string;
}

interface IdentityError {
	code: string;
	description: string;
}

export const userService = {
	getAll: async (search?: string, page: number = 1, pageSize: number = 15) => {
		const params = new URLSearchParams();
		if (search) params.append('search', search);
		params.append('page', page.toString());
		params.append('pageSize', pageSize.toString());

		const response = await apiClient.get<PagedUserResponse>(`/users?${params.toString()}`);
		return response.data;
	},

	create: async (data: CreateUserRequest) => {
		try {
			const response = await apiClient.post<User>('/users', data);
			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.status === 400) {
				const errors = error.response.data;
				if (Array.isArray(errors)) {
					const errorMessages = errors.map((e: IdentityError) => e.description).join(' ');
					throw new Error(errorMessages);
				}
			}
			throw new Error('Nie udało się utworzyć użytkownika.');
		}
	},

	update: async (id: string, data: UpdateUserRequest) => {
		const response = await apiClient.put<User>(`/users/${id}`, data);
		return response.data;
	},

	toggleStatus: async (id: string) => {
		const response = await apiClient.put<{ message: string }>(`/users/${id}/status`);
		return response.data;
	},

	deleteUser: async (id: string) => {
		const response = await apiClient.delete(`/users/${id}`);
		return response.data;
	},

	changePassword: async (data: ChangePasswordRequest) => {
		try {
			const response = await apiClient.post<{ message: string }>('/users/change-password', data);
			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.data?.message) {
				throw new Error(error.response.data.message);
			}
			throw new Error('Nie udało się zmienić hasła.');
		}
	},

	getMe: async () => {
		const response = await apiClient.get<User>('/users/me');
		return response.data;
	},

	resetPassword: async (id: string, data: { newPassword: string }) => {
		try {
			const response = await apiClient.post<{ message: string }>(`/users/${id}/reset-password`, data);
			return response.data;
		} catch (error) {
			if (axios.isAxiosError(error) && error.response?.data?.message) {
				throw new Error(error.response.data.message);
			}
			throw new Error('Nie udało się zresetować hasła.');
		}
	},
};
