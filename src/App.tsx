import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Toaster } from 'react-hot-toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { List } from 'react-bootstrap-icons';

// Lazy loaded views
const Matrix = lazy(() => import('./pages/Matrix').then(m => ({ default: m.Matrix })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminProjects = lazy(() => import('./pages/AdminProjects').then(m => ({ default: m.AdminProjects })));
const MatrixSetup = lazy(() => import('./pages/MatrixSetup').then(m => ({ default: m.MatrixSetup })));
const Groups = lazy(() => import('./pages/Groups').then(m => ({ default: m.Groups })));
const GroupForm = lazy(() => import('./pages/GroupForm').then(m => ({ default: m.GroupForm })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Students = lazy(() => import('./pages/Students').then(m => ({ default: m.Students })));
const StudentForm = lazy(() => import('./pages/StudentForm').then(m => ({ default: m.StudentForm })));
const StudentBulkAdd = lazy(() => import('./pages/StudentBulkAdd').then(m => ({ default: m.StudentBulkAdd })));
const AdminUsers = lazy(() => import('./pages/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminProjectsBulkAdd = lazy(() => import('./pages/AdminProjectsBulkAdd').then(m => ({ default: m.AdminProjectsBulkAdd })));
const AdminMatrixImport = lazy(() => import('./pages/AdminMatrixImport').then(m => ({ default: m.AdminMatrixImport })));
const AdminBranches = lazy(() => import('./pages/AdminBranches').then(m => ({ default: m.AdminBranches })));
const Substitutes = lazy(() => import('./pages/Substitutes').then(m => ({ default: m.Substitutes })));
const AdminSettings = lazy(() => import('./pages/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs').then(m => ({ default: m.AdminAuditLogs })));
const AdminMaintenance = lazy(() => import('./pages/AdminMaintenance').then(m => ({ default: m.AdminMaintenance })));
const PrinterDashboard = lazy(() => import('./pages/PrinterDashboard').then(m => ({ default: m.PrinterDashboard })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

// NOWE IMPORTY DO WERYFIKACJI RÓL
import { authService } from './api/authService';
import { UserRole } from './api/userService';
import toast from 'react-hot-toast';

const MainLayout = () => {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const location = useLocation();

	useEffect(() => {
		setIsMobileMenuOpen(false);
	}, [location.pathname]);

	const currentUser = authService.getCurrentUser();

	return (
		<div className="flex min-h-screen flex-col md:flex-row bg-slate-50 w-full max-w-full overflow-x-hidden">
			{/* Mobile Top Header z przyciskiem hamburgera */}
			<header className="flex md:hidden items-center justify-between bg-white border-b border-slate-200 px-4 py-2.5 sticky top-0 z-30 shadow-2xs w-full max-w-full shrink-0">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setIsMobileMenuOpen(true)}
						className="cursor-pointer rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
						aria-label="Otwórz menu"
					>
						<List size={24} />
					</button>
					<div className="flex items-center gap-2">
						<img src="/favicon.svg" alt="TinkerFlow Logo" className="h-6 w-6" />
						<span className="text-lg font-black tracking-tight text-slate-800">TinkerFlow</span>
					</div>
				</div>
				{currentUser && (
					<div className="flex items-center gap-2">
						<span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
							{currentUser.firstName}
						</span>
					</div>
				)}
			</header>

			<Sidebar isMobileOpen={isMobileMenuOpen} onCloseMobile={() => setIsMobileMenuOpen(false)} />

			<main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto flex flex-col">
				<Outlet />
			</main>
		</div>
	);
};

// --- STRAŻNIK RÓL (Wyrzuca na stronę główną, jeśli rola się nie zgadza) ---
const RoleGuard = ({
	allowedRoles,
	customCheck,
}: {
	allowedRoles: UserRole[];
	customCheck?: (user: import('./api/authService').AuthenticatedUser) => boolean;
}) => {
	const user = authService.getCurrentUser();

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	const hasAccess = allowedRoles.includes(user.role) || (customCheck ? customCheck(user) : false);

	if (!hasAccess) {
		toast.error('Brak uprawnień do przeglądania tej strony.');
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
};
// --------------------------------------------------------------------------

function App() {
	return (
		<BrowserRouter>
			<Toaster
				position="top-right"
				toastOptions={{
					// Domyślny czas dla powiadomień sukcesu (3 sekundy)
					success: { duration: 3000 },
					// Błędy niech znikają wolniej (5 sekund), żeby dało się je przeczytać
					error: { duration: 5000 },
					// Stylizacja podstawowa wszystkich powiadomień
					style: {
						fontWeight: 'bold',
						padding: '16px',
						borderRadius: '12px',
					},
				}}
			>
				{/* Funkcja renderująca z przyciskiem X (dismiss) */}
				{(t) => (
					<div
						className={`${
							t.visible ? 'animate-enter' : 'animate-leave'
						} pointer-events-auto flex w-full max-w-sm rounded-xl bg-white shadow-lg ring-1 ring-black/5`}
						onClick={() => toast.dismiss(t.id)} // Zamknięcie po kliknięciu W DOWOLNE MIEJSCE toasta
					>
						<div className="flex w-0 flex-1 items-center p-4">
							<div className="w-full">
								<p className="text-sm font-bold text-slate-800">
									{/* renderuje właściwą wiadomość */}
									{t.type === 'error' ? '❌ ' : '✅ '}
									{t.message as React.ReactNode}
								</p>
							</div>
						</div>
						{/* Prawa strona toasta - krawędź ułatwiająca zamknięcie */}
						<div className="flex border-l border-slate-200">
							<button
								onClick={(e) => {
									e.stopPropagation(); // żeby nie zamykało podwójnie
									toast.dismiss(t.id);
								}}
								className="flex w-full cursor-pointer items-center justify-center rounded-none rounded-r-lg border border-transparent p-4 text-sm font-bold text-slate-400 hover:text-slate-600"
							>
								Zamknij
							</button>
						</div>
					</div>
				)}
			</Toaster>

			<Suspense fallback={<div className="flex h-screen items-center justify-center font-bold text-slate-500">Ładowanie widoku...</div>}>
				<Routes>
					<Route path="/login" element={<Login />} />

					{/* Główny strażnik - tylko zalogowani */}
					<Route element={<ProtectedRoute />}>
						<Route path="/" element={<MainLayout />}>
							{/* === POZIOM 1: DOSTĘP DLA WSZYSTKICH (Trener, Koordynator, Admin) === */}
							<Route index element={<Dashboard />} />
							<Route path="ustawienia" element={<Settings />} />

							{/* DOSTĘP DO MATRYCY: WYKLUCZAMY DRUKARZA */}
							<Route element={<RoleGuard allowedRoles={[UserRole.Admin, UserRole.Coordinator, UserRole.Trainer]} />}>
								<Route path="matryca" element={<MatrixSetup />} />
								<Route path="matryca/widok" element={<Matrix />} />
							</Route>

							{/* === POZIOM 2: DOSTĘP DLA KOORDYNATORA I ADMINA === */}
							<Route element={<RoleGuard allowedRoles={[UserRole.Coordinator, UserRole.Admin]} />}>
								<Route path="grupy" element={<Groups />} />
								<Route path="grupy/nowa" element={<GroupForm />} />
								<Route path="grupy/:id" element={<GroupForm />} />

								<Route path="uczniowie/nowy" element={<StudentForm />} />
								<Route path="uczniowie/masowo" element={<StudentBulkAdd />} />

								{/* NOWA ŚCIEŻKA DLA ZASTĘPSTW */}
								<Route path="zastepstwa" element={<Substitutes />} />

								<Route path="admin/trenerzy" element={<AdminUsers />} />
							</Route>

							{/* DOSTĘP DLA TRENERA, KOORDYNATORA I ADMINA */}
							<Route element={<RoleGuard allowedRoles={[UserRole.Trainer, UserRole.Coordinator, UserRole.Admin]} />}>
								<Route path="uczniowie" element={<Students />} />
								<Route path="uczniowie/:id" element={<StudentForm />} />
							</Route>

							{/* === POZIOM 3: DOSTĘP TYLKO DLA ADMINA === */}
							<Route element={<RoleGuard allowedRoles={[UserRole.Admin]} />}>
								<Route path="admin/migracja" element={<AdminMatrixImport />} />
								<Route path="admin/projekty" element={<AdminProjects />} />
								<Route path="admin/projekty/masowo" element={<AdminProjectsBulkAdd />} />
								<Route path="admin/oddzialy" element={<AdminBranches />} />
								<Route path="admin/ustawienia" element={<AdminSettings />} />
								<Route path="admin/logi" element={<AdminAuditLogs />} />
								<Route path="admin/konserwacja" element={<AdminMaintenance />} />
							</Route>
							{/* === POZIOM 4: DOSTĘP DLA DRUKARZA, KOORDYNATORA, ADMINA I TRENERA-DRUKARZA === */}
							<Route
								element={
									<RoleGuard
										allowedRoles={[UserRole.Admin, UserRole.Printer, UserRole.Coordinator]}
										customCheck={(u) => u.role === UserRole.Trainer && !!u.canActAsPrinter}
									/>
								}
							>
								<Route path="farma" element={<PrinterDashboard />} />
							</Route>
						</Route>
					</Route>

					{/* Jeśli adres nie istnieje, wrzuć na główną */}
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</Suspense>
		</BrowserRouter>
	);
}

export default App;
