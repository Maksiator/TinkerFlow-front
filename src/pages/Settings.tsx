import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import { PersonCircle } from 'react-bootstrap-icons';

export function Settings() {
	const user = authService.getCurrentUser();

	const getRoleName = (roleValue?: number) => {
		if (roleValue === UserRole.Admin) return 'Administrator';
		if (roleValue === UserRole.Coordinator) return 'Koordynator';
		return 'Trener';
	};

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-8">
			<div className="mb-8">
				<h1 className="text-3xl font-extrabold text-slate-800">Moje Konto</h1>
				<p className="text-slate-500">Zarządzaj swoim profilem i prywatnymi ustawieniami.</p>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
					<PersonCircle className="text-blue-600" /> Dane Profilowe
				</h2>
				<div className="flex flex-col gap-3 text-slate-600">
					<div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-3">
						<span className="font-bold text-slate-500">Imię i nazwisko:</span>
						<span className="col-span-2 font-medium">
							{user?.firstName} {user?.lastName}
						</span>
					</div>
					<div className="grid grid-cols-3 gap-4 pb-1">
						<span className="font-bold text-slate-500">Rola w systemie:</span>
						<span className="col-span-2 inline-block w-max rounded-lg bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
							{getRoleName(user?.role)}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
