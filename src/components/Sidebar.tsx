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
	DatabaseCheck,
	XLg,
} from 'react-bootstrap-icons';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';

interface SidebarProps {
	isMobileOpen?: boolean;
	onCloseMobile?: () => void;
}

export function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
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
	const isPrinterOrAdmin =
		user &&
		(user.role === UserRole.Admin ||
			user.role === UserRole.Printer ||
			user.role === UserRole.Coordinator ||
			(user.role === UserRole.Trainer && !!user.canActAsPrinter));

	return (
		<>
			{/* MOBILNY BACKDROP (kliknięcie poza menu zamyka szufladę) */}
			<div
				className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
					isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
				}`}
				onClick={onCloseMobile}
			/>

			<aside
				className={`
					fixed inset-y-0 left-0 z-50 flex h-dvh flex-col border-r border-slate-200 bg-white transition-all duration-300 shadow-2xl md:shadow-none
					md:sticky md:top-0 md:h-screen md:shrink-0
					${isMobileOpen ? 'translate-x-0 visible pointer-events-auto' : '-translate-x-full invisible pointer-events-none md:translate-x-0 md:visible md:pointer-events-auto'}
					${isExpanded ? 'w-72 md:w-64' : 'w-72 md:w-20'}
				`}
			>
				{/* HEADER */}
				<div className="mb-4 flex shrink-0 items-center justify-between border-b border-slate-100 p-4">
					<div className={`flex items-center gap-2 ${!isExpanded ? 'md:hidden' : ''}`}>
						<img src="/favicon.svg" alt="TinkerFlow Logo" className="h-6 w-6" />
						<span className="text-xl font-extrabold tracking-tight text-slate-800">TinkerFlow</span>
					</div>

					{/* Przycisk zwijania paska (tylko Desktop) */}
					<button
						onClick={() => setIsExpanded(!isExpanded)}
						className={`hidden md:block ${isExpanded ? '' : 'mx-auto'} cursor-pointer rounded-md bg-slate-50 p-2 text-slate-500 transition-colors hover:bg-slate-200`}
						title={isExpanded ? 'Zwiń pasek boczny' : 'Rozwiń pasek boczny'}
					>
						<LayoutSidebar size={20} />
					</button>

					{/* Przycisk zamknięcia szuflady (tylko Mobile) */}
					<button
						onClick={onCloseMobile}
						className="block md:hidden cursor-pointer rounded-md bg-slate-50 p-2 text-slate-500 transition-colors hover:bg-slate-200"
						aria-label="Zamknij menu"
					>
						<XLg size={20} />
					</button>
				</div>

			{/* MENU */}
			<nav className="flex-1 overflow-y-auto px-3">
				<ul className="flex flex-col gap-1">
					{user?.mustChangePassword ? (
						<li>
							<NavLink to="/ustawienia" onClick={onCloseMobile} className={navLinkClass}>
								<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
									<GearFill size={20} />
								</span>
								<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Ustawienia Konta</span>
							</NavLink>
						</li>
					) : (
						<>
							{/* 1. STREFA TRENERA (Widzą wszyscy) */}
							<p className={`mt-2 mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase ${isExpanded ? '' : 'md:hidden'}`}>
								Menu Główne
							</p>

							<li>
								<NavLink to="/" onClick={onCloseMobile} className={navLinkClass}>
									<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
										<BoxSeam size={20} />
									</span>
									<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Dashboard</span>
								</NavLink>
							</li>

							{user?.role !== UserRole.Printer && (
								<>
									<li>
										<NavLink to="/matryca" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<LayersFill size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Matryca Projektów</span>
										</NavLink>
									</li>
									<li>
										<NavLink to="/uczniowie" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<PersonVcardFill size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Baza Uczniów</span>
										</NavLink>
									</li>
								</>
							)}

							{/* 2. STREFA KOORDYNATORA (Koordynator + Admin) */}
							{isCoordinatorOrAdmin && (
								<>
									<div className="my-2 border-t border-slate-100" />
									<p className={`mt-2 mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase ${isExpanded ? '' : 'md:hidden'}`}>
										Zarządzanie Ośrodkiem
									</p>

									<li>
										<NavLink to="/grupy" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<PeopleFill size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Zarządzanie Grupami</span>
										</NavLink>
									</li>

									<li>
										<NavLink to="/zastepstwa" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<Calendar2EventFill size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Zastępstwa</span>
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/trenerzy" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<PersonBadgeFill size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Personel</span>
										</NavLink>
									</li>
								</>
							)}

							{/* 3. STREFA ADMINA (Tylko Admin) */}
							{isAdmin && (
								<>
									<div className="my-2 border-t border-slate-100" />
									<p className={`mt-2 mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase ${isExpanded ? '' : 'md:hidden'}`}>
										Opcje Systemowe
									</p>

									<li>
										<NavLink to="/admin/projekty" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<ShieldLockFill size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Baza Projektów</span>
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/oddzialy" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<BuildingFill size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Sieć Oddziałów</span>
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/migracja" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<DatabaseFillUp size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Migracja Bazy</span>
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/ustawienia" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<GearFill size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Ustawienia Globalne</span>
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/logi" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<JournalText size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Dziennik Zdarzeń</span>
										</NavLink>
									</li>

									<li>
										<NavLink to="/admin/konserwacja" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<DatabaseCheck size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Integralność Bazy</span>
										</NavLink>
									</li>
								</>
							)}

							{/* 4. STREFA DRUKARZA (Farma Druku) */}
							{isPrinterOrAdmin && (
								<>
									<div className="my-2 border-t border-slate-100" />
									<p className={`mt-2 mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase ${isExpanded ? '' : 'md:hidden'}`}>
										Strefa Drukarza
									</p>

									<li>
										<NavLink to="/farma" onClick={onCloseMobile} className={navLinkClass}>
											<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
												<PrinterFill size={20} />
											</span>
											<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Zlecenia Druku</span>
										</NavLink>
									</li>
								</>
							)}

							<div className="my-2 border-t border-slate-100" />
							<li>
								<NavLink to="/ustawienia" onClick={onCloseMobile} className={navLinkClass}>
									<span className={isExpanded ? 'mr-3 shrink-0' : 'md:mx-auto mr-3 shrink-0'}>
										<GearFill size={20} />
									</span>
									<span className={`truncate ${isExpanded ? '' : 'md:hidden'}`}>Ustawienia Konta</span>
								</NavLink>
							</li>
						</>
					)}
				</ul>
			</nav>

			{/* FOOTER USERA */}
			<div className="shrink-0 border-t border-slate-100 p-3">
				<div
					className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-between md:justify-center'} rounded-xl bg-slate-50 p-2`}
				>
					<div className={`flex flex-col overflow-hidden pr-2 ${isExpanded ? '' : 'md:hidden'}`}>
						<span className="truncate text-sm font-bold text-slate-700">Cześć, {user?.firstName}! 👋</span>
						<span className="truncate text-xs font-bold text-blue-500 uppercase">
							{getRoleName(user?.role)}
							{user?.role === UserRole.Trainer && user?.canActAsPrinter ? ' + Drukarz' : ''}
						</span>
					</div>
					<button
						onClick={() => {
							onCloseMobile?.();
							handleLogout();
						}}
						className="shrink-0 cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
						title="Wyloguj się"
					>
						<BoxArrowRight size={20} />
					</button>
				</div>
			</div>
		</aside>
	</>
);
}
