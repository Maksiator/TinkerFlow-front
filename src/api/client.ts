import axios from 'axios';

// Pobieramy URL z pliku .env (zabezpieczenie na wypadek braku zmiennej)
const apiUrl = import.meta.env.VITE_API_URL;

export const apiClient = axios.create({
	baseURL: apiUrl,
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: true,
});

// INTERCEPTOR: Kod, który wykonuje się przed każdym wysłaniem zapytania
apiClient.interceptors.request.use(
	(config) => {
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

// Interceptor odpowiedzi (obsługa wygaśnięcia tokena)
apiClient.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response && error.response.status === 401) {
			if (window.location.pathname !== '/login') {
				const serverMessage = error.response.data?.message;
				let reason = 'expired';

				// Jeśli serwer C# powiedział, że to blokada, zmieniamy powód
				if (serverMessage === 'Konto zostało zablokowane.') {
					reason = 'blocked';
				}

				// Czyścimy wszystko
				localStorage.removeItem('tinkerflow_token');
				localStorage.removeItem('tinkerflow_user');

				// Twardy reload na stronę logowania Z PARAMETREM w adresie
				window.location.href = `/login?reason=${reason}`;
			}
		}
		return Promise.reject(error);
	},
);
