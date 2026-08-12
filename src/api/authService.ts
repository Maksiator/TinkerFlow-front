import { apiClient } from './client';
import { UserRole } from './userService'; // Importujemy nasze nowe źródło prawdy o rolach

// Definiujemy kształt użytkownika w pamięci aplikacji
export interface AuthenticatedUser {
	id: string;
	firstName: string;
	lastName: string;
	role: UserRole;
	mustChangePassword: boolean;
}

export interface AuthResponse {
	token: string;
	userId: string;
	firstName: string;
	lastName: string;
	role: UserRole;
	mustChangePassword: boolean;
}

export const authService = {
	login: async (credentials: { email: string; password: string }) => {
		const res = await apiClient.post<AuthResponse>('/auth/login', credentials);

		const user: AuthenticatedUser = {
			id: res.data.userId,
			firstName: res.data.firstName,
			lastName: res.data.lastName,
			role: res.data.role,
			mustChangePassword: res.data.mustChangePassword,
		};

		localStorage.setItem('tinkerflow_user', JSON.stringify(user));
		return res.data;
	},

	logout: async () => {
		try {
			// Musimy uderzyć do API, żeby serwer usunął ciasteczko z przeglądarki
			await apiClient.post('/auth/logout');
		} catch (error) {
			console.error('Błąd podczas wylogowywania:', error);
		} finally {
			localStorage.removeItem('tinkerflow_user');
			window.location.href = '/login';
		}
	},

	isAuthenticated: () => {
		// Skoro nie mamy tokena pod ręką, weryfikujemy czy istnieje profil usera.
		// Jeśli ciasteczko wygasło, API i tak zwróci błąd 401 przy pierwszym zapytaniu,
		// a Twój istniejący interceptor w client.ts wyrzuci użytkownika do /login.
		return !!localStorage.getItem('tinkerflow_user');
	},

	getCurrentUser: (): AuthenticatedUser | null => {
		const userStr = localStorage.getItem('tinkerflow_user');
		if (!userStr) return null;

		try {
			return JSON.parse(userStr) as AuthenticatedUser;
		} catch {
			return null;
		}
	},
};
