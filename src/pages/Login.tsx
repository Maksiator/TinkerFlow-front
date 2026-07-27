import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../api/authService';

export function Login() {
	// HOOK do czytania paska adresu
	const [searchParams, setSearchParams] = useSearchParams();

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	// Wyłapywanie powodu wylogowania z URL
	useEffect(() => {
		const reason = searchParams.get('reason');

		if (reason === 'blocked') {
			toast.error('Twoje konto zostało zablokowane przez administratora.', { duration: 5000 });
			// Czyścimy pasek adresu, żeby po odświeżeniu znów nie wyskoczyło
			setSearchParams({});
		} else if (reason === 'expired') {
			toast.error('Twoja sesja wygasła. Zaloguj się ponownie.', { duration: 5000 });
			setSearchParams({});
		}
	}, [searchParams, setSearchParams]);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setIsLoading(true);

		try {
			await authService.login({ email, password });
			// Sukces! Przeładowujemy stronę, żeby wejść do aplikacji
			window.location.href = '/';
		} catch (err: unknown) {
			// Wyciągamy wiadomość z .NET ("Nieprawidłowy email lub hasło")
			const errorWithResponse = err as { response?: { data?: { message?: string } } };
			if (errorWithResponse.response?.data?.message) {
				setError(errorWithResponse.response.data.message);
			} else {
				setError('Wystąpił błąd podczas łączenia z serwerem.');
			}
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
			<div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-extrabold text-slate-800">TinkerFlow</h1>
					<p className="mt-2 text-slate-500">Zaloguj się do panelu zarządzania</p>
				</div>

				<form onSubmit={handleLogin} className="flex flex-col gap-5">
					<div>
						<label className="mb-2 block text-sm font-bold text-slate-700">Adres Email</label>
						<input
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full rounded-lg border border-slate-300 p-3 transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							placeholder="admin@tinkerflow.com"
						/>
					</div>

					<div>
						<label className="mb-2 block text-sm font-bold text-slate-700">Hasło</label>
						<input
							type="password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded-lg border border-slate-300 p-3 transition-all outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							placeholder="••••••••"
						/>
					</div>

					{error && <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-600">{error}</div>}

					<button
						type="submit"
						disabled={isLoading}
						className="mt-2 flex w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 py-3 font-bold text-white shadow-md transition-colors hover:bg-blue-700 disabled:bg-blue-400"
					>
						{isLoading ? 'Logowanie...' : 'Zaloguj się'}
					</button>
				</form>
			</div>
		</div>
	);
}
