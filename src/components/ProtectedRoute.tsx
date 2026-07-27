import { Navigate, Outlet } from 'react-router-dom';
import { authService } from '../api/authService';

export function ProtectedRoute() {
	// Sprawdzamy, czy w localStorage jest token
	const isAuthenticated = authService.isAuthenticated();

	// Jeśli nie ma tokena, przekierowujemy na /login
	// Właściwość 'replace' podmienia historię przeglądarki, żeby user nie mógł kliknąć "Wstecz"
	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	// Outlet to miejsce, w którym wyrenderuje się właściwy komponent (np. Panel Grup)
	return <Outlet />;
}
