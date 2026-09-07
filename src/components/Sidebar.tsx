import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
	BoxSeam,
	PeopleFill,
	PersonVcardFill,
	GearFill,
	ShieldLockFill,
	LayoutSidebar,
	BoxArrowRight,
	LayersFill,
	PersonBadgeFill,
	DatabaseFillUp,
	BuildingFill,
	Calendar2EventFill,
	PrinterFill,
	JournalText,
} from 'react-bootstrap-icons';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';

export function Sidebar() {
	const navigate = useNavigate();
	const user = authService.getCurrentUser();

	const [isExpanded, setIsExpanded] = useState(() => {
		const savedState = localStorage.getItem('tinkerflow_sidebar');
		return savedState !== null ? JSON.parse(savedState) : true;
	});

	useEffect(() => {
		localStorage.setItem('tinkerflow_sidebar', JSON.stringify(isExpanded));
	}, [isExpanded]);

	const handleLogout = () => {
		authService.logout();
		navigate('/login');
	};

	// Uniwersalny styl dla wszystkich linków
	const navLinkClass = ({ isActive }: { isActive: boolean }) => `
      flex items-center p-3 mb-2 rounded-lg transition-colors shrink-0
      ${isActive ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
   `;

	const getRoleName = (roleValue?: number) => {
		if (roleValue === UserRole.Admin) return 'Admin';
		if (roleValue === UserRole.Coordinator) return 'Koordynator';
		if (roleValue === UserRole.Printer) return 'Drukarz';
		return 'Trener';
	};

	// POMOCNICZE ZMIENNE DO RENDEROWANIA
	const isCoordinatorOrAdmin = user && (user.role === UserRole.Admin || user.role === UserRole.Coordinator);
	const isAdmin = user && user.role === UserRole.Admin;
	const isPrinterOrAdmin = user && (user.role === UserRole.Admin || user.role === UserRole.Printer);

	return (
		<aside
			className={`${isExpanded ? 'w-64' : 'w-20'} sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300`}
		>
			{/* HEADER */}
			<div className="mb-4 flex shrink-0 items-center justify-between border-b border-slate-100 p-4">
				{isExpanded && (
					<div className="flex items-center gap-2">
						<img src="/favicon.svg" alt="TinkerFlow Logo" className="h-6 w-6" />
						<span className="text-xl font-extrabold tracking-tight text-slate-800">TinkerFlow</span>
					</div>
				)}
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className={`${isExpanded ? '' : 'mx-auto'} cursor-pointer rounded-md bg-slate-50 p-2 text-slate-500 transition-colors hover:bg-slate-200`}
				>
					<LayoutSidebar size={20} />
				</button>
			</div>

			{/* MENU */}
			<nav className="flex-1 overflow-y-auto px-3">
				<ul className="flex flex-col gap-1">
					{user?.mustChangePassword ? (
						<li>
							<NavLink to="/ustawienia" className={navLinkClass}>
								<GearFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
								{isExpanded && <span className="truncate">Ustawienia Konta</span>}
							</NavLink>
						</li>
					) : (
						<>
							{/* 1. STREFA TRENERA (Widzą wszyscy) */}
							{isExpanded && (
								<p className="mt-2 mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Menu Główne</p>
							)}

							<li>
								<NavLink to="/" className={navLinkClass}>
									<BoxSeam size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
									{isExpanded && <span className="truncate">Dashboard</span>}
								</NavLink>
							</li>

							{user?.role !== UserRole.Printer && (
								<>
									<li>
										<NavLink to="/matryca" className={navLinkClass}>
											<LayersFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Matryca Projektów</span>}
										</NavLink>
									</li>
									<li>
										<NavLink to="/uczniowie" className={navLinkClass}>
											<PersonVcardFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Baza Uczniów</span>}
										</NavLink>
									</li>
								</>
							)}

							{/* 2. STREFA KOORDYNATORA (Koordynator + Admin) */}
							{isCoordinatorOrAdmin && (
								<>
									<div className="my-2 border-t border-slate-100" />
									{isExpanded && (
										<p className="mt-2 mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
											Zarządzanie Ośrodkiem
										</p>
									)}

									<li>
										<NavLink to="/grupy" className={navLinkClass}>
											<PeopleFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Zarządzanie Grupami</span>}
										</NavLink>
									</li>

									{/* NOWY LINK: ZASTĘPSTWA */}
									<li>
										<NavLink to="/zastepstwa" className={navLinkClass}>
											<Calendar2EventFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Zastępstwa</span>}
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/trenerzy" className={navLinkClass}>
											<PersonBadgeFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Personel</span>}
										</NavLink>
									</li>
								</>
							)}

							{/* 3. STREFA ADMINA (Tylko Admin) */}
							{isAdmin && (
								<>
									<div className="my-2 border-t border-slate-100" />
									{isExpanded && (
										<p className="mt-2 mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
											Opcje Systemowe
										</p>
									)}

									<li>
										<NavLink to="/admin/projekty" className={navLinkClass}>
											<ShieldLockFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Baza Projektów</span>}
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/oddzialy" className={navLinkClass}>
											<BuildingFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Sieć Oddziałów</span>}
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/migracja" className={navLinkClass}>
											<DatabaseFillUp size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Migracja Bazy</span>}
										</NavLink>
									</li>

									{/* NOWY LINK DLA ADMINA: USTAWIENIA GLOBALNE */}
									<li>
										<NavLink to="/admin/ustawienia" className={navLinkClass}>
											<GearFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Ustawienia Globalne</span>}
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/logi" className={navLinkClass}>
											<JournalText size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Dziennik Zdarzeń</span>}
										</NavLink>
									</li>
								</>
							)}

							{/* 4. STREFA DRUKARZA (Farma Druku) */}
							{isPrinterOrAdmin && (
								<>
									<div className="my-2 border-t border-slate-100" />
									{isExpanded && (
										<p className="mt-2 mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
											Farma Druku
										</p>
									)}

									<li>
										<NavLink to="/farma" className={navLinkClass}>
											<PrinterFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
											{isExpanded && <span className="truncate">Zlecenia Druku</span>}
										</NavLink>
									</li>
								</>
							)}

							<div className="my-2 border-t border-slate-100" />
							<li>
								<NavLink to="/ustawienia" className={navLinkClass}>
									<GearFill size={20} className={isExpanded ? 'mr-3 shrink-0' : 'mx-auto shrink-0'} />
									{isExpanded && <span className="truncate">Ustawienia Konta</span>}
								</NavLink>
							</li>
						</>
					)}
				</ul>
			</nav>

			{/* FOOTER USERA */}
			<div className="shrink-0 border-t border-slate-100 p-3">
				<div
					className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} rounded-xl bg-slate-50 p-2`}
				>
					{isExpanded && (
						<div className="flex flex-col overflow-hidden pr-2">
							<span className="truncate text-sm font-bold text-slate-700">Cześć, {user?.firstName}! 👋</span>
							<span className="truncate text-xs font-bold text-blue-500 uppercase">{getRoleName(user?.role)}</span>
						</div>
					)}
					<button
						onClick={handleLogout}
						className="shrink-0 cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
						title="Wyloguj się"
					>
						<BoxArrowRight size={20} />
					</button>
				</div>
			</div>
		</aside>
	);
}
