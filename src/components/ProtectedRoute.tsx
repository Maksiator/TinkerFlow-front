import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../api/authService';

export function ProtectedRoute() {
	// Sprawdzamy, czy w localStorage jest token
	const isAuthenticated = authService.isAuthenticated();
	const location = useLocation();

	// Jeśli nie ma tokena, przekierowujemy na /login
	// Właściwość 'replace' podmienia historię przeglądarki, żeby user nie mógł kliknąć "Wstecz"
	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	const currentUser = authService.getCurrentUser();
	
	// Normalizujemy ścieżkę do małych liter i usuwamy ewentualny slash na końcu
	const currentPath = location.pathname.toLowerCase().replace(/\/$/, '');

	if (currentUser?.mustChangePassword && currentPath !== '/ustawienia') {
		return <Navigate to="/ustawienia" replace />;
	}

	// Outlet to miejsce, w którym wyrenderuje się właściwy komponent (np. Panel Grup)
	return <Outlet />;
}
