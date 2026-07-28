import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { PersonFill, KeyFill, ShieldFill, BuildingFill } from 'react-bootstrap-icons';
import { userService, type User, UserRole } from '../api/userService';

export function Settings() {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Stan formularza zmiany hasła
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isSavingPassword, setIsSavingPassword] = useState(false);

	useEffect(() => {
		let isMounted = true;
		const fetchUser = async () => {
			try {
				const data = await userService.getMe();
				if (isMounted) {
					setUser(data);
				}
			} catch (error) {
				console.error(error);
				if (isMounted) {
					toast.error('Błąd podczas pobierania danych użytkownika.');
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		fetchUser();
		return () => {
			isMounted = false;
		};
	}, []);

	const handlePasswordChange = async (e: React.FormEvent) => {
		e.preventDefault();
		if (newPassword !== confirmPassword) {
			toast.error('Nowe hasła nie są ze sobą zgodne!');
			return;
		}

		if (newPassword.length < 6) {
			toast.error('Nowe hasło musi mieć co najmniej 6 znaków!');
			return;
		}

		setIsSavingPassword(true);
		try {
			await userService.changePassword({ currentPassword, newPassword });
			toast.success('Hasło zostało pomyślnie zmienione!');
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
		} catch (error: any) {
			console.error(error);
			toast.error(error.message || 'Nie udało się zmienić hasła.');
		} finally {
			setIsSavingPassword(false);
		}
	};

	const getRoleName = (role?: UserRole) => {
		if (role === UserRole.Admin) return 'Administrator';
		if (role === UserRole.Coordinator) return 'Koordynator';
		if (role === UserRole.Printer) return 'Drukarz';
		return 'Trener';
	};

	if (isLoading) {
		return (
			<div className="flex h-[50vh] items-center justify-center">
				<div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-4xl p-6 sm:p-10">
			<header className="mb-8">
				<h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Ustawienia Konta</h1>
				<p className="mt-1 text-slate-500">Zarządzaj swoimi danymi osobowymi i bezpieczeństwem konta</p>
			</header>

			<div className="grid gap-8 md:grid-cols-3">
				{/* LEWA KOLUMNA: INFORMACJE O PROFILU */}
				<div className="md:col-span-1 space-y-6">
					<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
						<div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
							<div className="rounded-lg bg-blue-50 p-2 text-blue-600">
								<PersonFill size={20} />
							</div>
							<h2 className="font-bold text-slate-800">Twój Profil</h2>
						</div>

						{user && (
							<div className="space-y-4 text-sm">
								<div>
									<span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Imię i nazwisko</span>
									<span className="font-medium text-slate-700">{user.firstName} {user.lastName}</span>
								</div>
								<div>
									<span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Adres e-mail</span>
									<span className="font-medium text-slate-700 break-all">{user.email}</span>
								</div>
								<div>
									<span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Rola w systemie</span>
									<span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
										<ShieldFill size={12} className="text-slate-500" />
										{getRoleName(user.role)}
									</span>
								</div>
							</div>
						)}
					</div>

					{/* ODDZIAŁY */}
					{user && user.branches && user.branches.length > 0 && (
						<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
							<div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
								<div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
									<BuildingFill size={20} />
								</div>
								<h2 className="font-bold text-slate-800">Przypisane Oddziały</h2>
							</div>
							<ul className="space-y-2">
								{user.branches.map((b) => (
									<li key={b.branchId} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
										<div className="h-2 w-2 rounded-full bg-emerald-500" />
										<span className="font-medium">{b.branchName}</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>

				{/* PRAWA KOLUMNA: ZMIANA HASŁA */}
				<div className="md:col-span-2">
					<div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm transition-all hover:shadow-md">
						<div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
							<div className="rounded-lg bg-amber-50 p-2 text-amber-600">
								<KeyFill size={20} />
							</div>
							<h2 className="text-lg font-bold text-slate-800">Zmień Hasło</h2>
						</div>

						<form onSubmit={handlePasswordChange} className="space-y-6">
							<div>
								<label className="block text-sm font-semibold text-slate-700">Aktualne hasło</label>
								<input
									type="password"
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									required
									placeholder="••••••••"
									className="mt-1.5 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300"
								/>
							</div>

							<div className="grid gap-6 sm:grid-cols-2">
								<div>
									<label className="block text-sm font-semibold text-slate-700">Nowe hasło</label>
									<input
										type="password"
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										required
										placeholder="••••••••"
										className="mt-1.5 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300"
									/>
								</div>
								<div>
									<label className="block text-sm font-semibold text-slate-700">Potwierdź nowe hasło</label>
									<input
										type="password"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										required
										placeholder="••••••••"
										className="mt-1.5 block w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300"
									/>
								</div>
							</div>

							<div className="flex justify-end pt-4">
								<button
									type="submit"
									disabled={isSavingPassword}
									className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
								>
									{isSavingPassword ? (
										<div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
									) : (
										'Zapisz nowe hasło'
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
