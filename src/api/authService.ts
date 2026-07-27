import { apiClient } from './client';
import { UserRole } from './userService'; // Importujemy nasze nowe źródło prawdy o rolach

// Definiujemy kształt użytkownika w pamięci aplikacji
export interface AuthenticatedUser {
	id: string;
	firstName: string;
	lastName: string;
	role: UserRole;
}

export interface AuthResponse {
	token: string;
	userId: string;
	firstName: string;
	lastName: string;
	role: UserRole; // Już nie dowolny number, a konkretny UserRole
}

export const authService = {
	login: async (credentials: { email: string; password: string }) => {
		// API zwróci dane, a token JWT wyląduje automatycznie w bezpiecznym ciasteczku
		const res = await apiClient.post<AuthResponse>('/auth/login', credentials);

		const user: AuthenticatedUser = {
			id: res.data.userId,
			firstName: res.data.firstName,
			lastName: res.data.lastName,
			role: res.data.role,
		};

		// Zapisujemy w przeglądarce TYLKO profil usera do celów UI. Żadnego tokena!
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
