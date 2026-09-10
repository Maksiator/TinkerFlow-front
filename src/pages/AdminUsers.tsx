import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	Search,
	PlusLg,
	ShieldLockFill,
	PersonBadgeFill,
	PencilSquare,
	XLg,
	UnlockFill,
	LockFill,
	BuildingFill,
	Trash,
	EyeFill,
	EyeSlashFill,
	PrinterFill,
} from 'react-bootstrap-icons';
import { userService, type User, UserRole, type UpdateUserRequest, type CreateUserRequest } from '../api/userService';
import { branchService, type Branch } from '../api/branchService';
import { authService } from '../api/authService';
import toast from 'react-hot-toast';

export function AdminUsers() {
	const navigate = useNavigate();
	const currentUser = authService.getCurrentUser();

	const [users, setUsers] = useState<User[]>([]);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [pageSize] = useState(15);
	const [totalCount, setTotalCount] = useState(0);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [editingUser, setEditingUser] = useState<User | null>(null);

	const [formData, setFormData] = useState({
		firstName: '',
		lastName: '',
		email: '',
		password: '',
		role: UserRole.Trainer as UserRole,
		branchIds: [] as string[],
	});

	const currentUserRole = currentUser?.role;
	const isCurrentUserCoordinator = currentUserRole === UserRole.Coordinator;
	const isCurrentUserAdmin = currentUserRole === UserRole.Admin;

	const [showStartPassword, setShowStartPassword] = useState(false);



	const generateRandomPassword = () => {
		const length = 10;
		const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const lowercase = 'abcdefghijklmnopqrstuvwxyz';
		const numbers = '0123456789';
		const special = '!@#$%^&*()_+~`|}{[]:;?><,./-';
		const allChars = uppercase + lowercase + numbers + special;
		
		let password = '';
		password += uppercase[Math.floor(Math.random() * uppercase.length)];
		password += lowercase[Math.floor(Math.random() * lowercase.length)];
		password += numbers[Math.floor(Math.random() * numbers.length)];
		password += special[Math.floor(Math.random() * special.length)];
		
		for (let i = 4; i < length; i++) {
			password += allChars[Math.floor(Math.random() * allChars.length)];
		}
		
		const shuffledPassword = password.split('').sort(() => 0.5 - Math.random()).join('');
		
		setFormData(prev => ({ ...prev, password: shuffledPassword }));
		setShowStartPassword(true);
		toast.success('Wygenerowano losowe hasło startowe.');
	};



	useEffect(() => {
		if (currentUserRole === undefined || currentUserRole === UserRole.Trainer) {
			toast.error('Brak dostępu. Ta strona jest tylko dla administracji.');
			navigate('/');
			return;
		}

		let isMounted = true;
		const fetchInitialData = async () => {
			try {
				const [usersData, branchesData] = await Promise.all([
					userService.getAll(searchTerm, page, pageSize),
					branchService.getAll()
				]);
				if (isMounted) {
					setUsers(usersData.items);
					setTotalPages(usersData.totalPages);
					setTotalCount(usersData.totalCount);
					setBranches(branchesData);
				}
			} catch (error) {
				if (isMounted) {
					toast.error('Błąd pobierania danych.');
					console.error('Błąd pobierania danych:', error);
				}
			} finally {
				if (isMounted) setIsLoading(false);
			}
		};

		fetchInitialData();

		return () => {
			isMounted = false;
		};
	}, [currentUserRole, navigate, page, pageSize, searchTerm]);

	const refreshData = async () => {
		try {
			const usersData = await userService.getAll(searchTerm, page, pageSize);
			const branchesData = await branchService.getAll();
			setUsers(usersData.items);
			setTotalPages(usersData.totalPages);
			setTotalCount(usersData.totalCount);
			setBranches(branchesData);
		} catch (error) {
			toast.error('Błąd odświeżania danych.');
			console.error(error);
		}
	};

	// LOGIKA OGRANICZENIA ODDZIAŁÓW DLA KOORDYNATORA
	// Endpoint GET /api/branches na serwerze filtruje oddziały (dla Admina zwraca wszystkie, dla Koordynatora tylko jego)
	const visibleBranches = useMemo(() => {
		return branches;
	}, [branches]);

	const openCreateModal = () => {
		setEditingUser(null);

		// Domyślne zaznaczenie oddziału:
		// Zgodnie z wymaganiem: z automatu zaznaczony jest 1. oddział (lub jedyny dostępny dla koordynatora)
		let initialBranchIds: string[] = [];
		if (visibleBranches.length > 0) {
			initialBranchIds = [visibleBranches[0].id];
		}

		setFormData({
			firstName: '',
			lastName: '',
			email: '',
			password: '',
			role: UserRole.Trainer, // Koordynator ma zablokowane pole, więc to musi być domyślne
			branchIds: initialBranchIds,
		});
		setIsModalOpen(true);
	};

	const openEditModal = (user: User) => {
		setEditingUser(user);

		let initialBranchIds = user.branches.map((b) => b.branchId);
		// Jeśli edytowany trener lub koordynator nie miał żadnego oddziału, automatycznie podpowiadamy pierwszy dostępny
		if (
			(user.role === UserRole.Trainer || user.role === UserRole.Coordinator) &&
			initialBranchIds.length === 0 &&
			visibleBranches.length > 0
		) {
			initialBranchIds = [visibleBranches[0].id];
		}

		setFormData({
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			password: '',
			role: user.role,
			branchIds: initialBranchIds,
		});
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setEditingUser(null);
		setShowStartPassword(false);
	};

	const toggleBranch = (branchId: string) => {
		// Jeśli jest tylko 1 oddział dostępny dla koordynatora, nie ma możliwości jego odkliknięcia
		if (visibleBranches.length === 1) {
			toast('Ten oddział jest wymagany i nie można go odznaczyć.', { icon: 'ℹ️' });
			return;
		}

		setFormData((prev) => {
			const isChecked = prev.branchIds.includes(branchId);
			if (isChecked) {
				// Jeśli użytkownik próbuje odznaczyć i byłby to ostatni zaznaczony oddział
				if (prev.branchIds.length <= 1) {
					toast.error('Pracownik musi posiadać co najmniej jeden przypisany oddział.');
					return prev;
				}
				return {
					...prev,
					branchIds: prev.branchIds.filter((id) => id !== branchId),
				};
			} else {
				return {
					...prev,
					branchIds: [...prev.branchIds, branchId],
				};
			}
		});
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const requiresBranch = formData.role !== UserRole.Printer && formData.role !== UserRole.Admin;
		if (requiresBranch && (!formData.branchIds || formData.branchIds.length === 0)) {
			toast.error('Wybierz co najmniej jeden oddział dla pracownika!');
			return;
		}

		setIsSubmitting(true);

		try {
			const branchIdsToSend = requiresBranch ? formData.branchIds : [];

			if (editingUser) {
				const updateData: UpdateUserRequest = {
					firstName: formData.firstName,
					lastName: formData.lastName,
					role: formData.role,
					branchIds: branchIdsToSend,
				};
				await userService.update(editingUser.id, updateData);
				if (formData.password) {
					await userService.resetPassword(editingUser.id, { newPassword: formData.password });
					toast.success('Zaktualizowano dane pracownika i ustawiono nowe hasło tymczasowe!');
				} else {
					toast.success('Zaktualizowano dane pracownika!');
				}
			} else {
				const createData: CreateUserRequest = {
					...formData,
					branchIds: branchIdsToSend,
				};
				// Zabezpieczenie przed atakiem typu "wstrzyknięcie wartości w ukryte pole"
				if (isCurrentUserCoordinator) {
					createData.role = UserRole.Trainer;
				}
				await userService.create(createData);
				toast.success('Utworzono konto!');
			}
			await refreshData();
			handleCloseModal();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Błąd zapisu.';
			toast.error(errorMessage);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleToggleStatus = async (user: User) => {
		const action = user.isActive ? 'zablokować' : 'odblokować';
		if (!window.confirm(`Czy na pewno chcesz ${action} konto ${user.firstName}?`)) return;
		try {
			const response = await userService.toggleStatus(user.id);
			toast.success(response.message);
			await refreshData();
		} catch (error) {
			toast.error('Błąd zmiany statusu.');
			console.error(error);
		}
	};

	const handleDeleteUser = async (user: User) => {
		if (
			!window.confirm(
				`UWAGA: Czy na pewno chcesz BEZPOWROTNIE usunąć konto ${user.firstName} ${user.lastName}? Zniknie również historia zastępstw!`,
			)
		)
			return;
		try {
			await userService.deleteUser(user.id);
			toast.success('Pracownik został trwale usunięty.');
			await refreshData();
		} catch (error) {
			toast.error('Nie udało się usunąć pracownika.');
			console.error(error);
		}
	};

	const renderRoleBadge = (role: UserRole) => {
		switch (role) {
			case UserRole.Admin:
				return (
					<span className="flex w-max items-center gap-1 rounded-md bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700">
						<ShieldLockFill /> Admin
					</span>
				);
			case UserRole.Coordinator:
				return (
					<span className="flex w-max items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
						<BuildingFill /> Koordynator
					</span>
				);
			case UserRole.Trainer:
				return (
					<span className="flex w-max items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
						<PersonBadgeFill /> Trener
					</span>
				);
			case UserRole.Printer:
				return (
					<span className="flex w-max items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
						<PrinterFill /> Drukarz
					</span>
				);
			default:
				return null;
		}
	};

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-8">
			<div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
				<div>
					<h1 className="text-3xl font-extrabold text-slate-800">Personel i Pracownicy</h1>
					<p className="text-slate-500">Zarządzaj uprawnieniami i oddziałami swojej ekipy.</p>
				</div>
				<button
					onClick={openCreateModal} // Używamy dedykowanej funkcji dla nowego usera
					className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800 px-5 py-3 font-bold text-white transition-colors hover:bg-slate-900"
				>
					<PlusLg /> Dodaj pracownika
				</button>
			</div>

			<div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="relative">
					<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder="Szukaj pracownika..."
						className="w-full rounded-lg border border-slate-300 py-3 pl-10 transition-all outline-none focus:border-blue-500"
					/>
				</div>
			</div>

			<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead className="bg-slate-50 text-slate-500">
							<tr>
								<th className="p-4 font-bold">Pracownik</th>
								<th className="p-4 font-bold">Oddziały</th>
								<th className="p-4 font-bold">Rola</th>
								<th className="p-4 text-center font-bold">Status</th>
								<th className="p-4 text-right font-bold">Akcje</th>
							</tr>
						</thead>
						<tbody>
							{!isLoading &&
								users
									.map((user) => (
										<tr
											key={user.id}
											className={`border-b border-slate-100 hover:bg-slate-50 ${!user.isActive ? 'opacity-50' : ''}`}
										>
											<td className="p-4 font-bold text-slate-800">
												{user.firstName} {user.lastName}
												<div className="text-xs font-normal text-slate-500">{user.email}</div>
											</td>
											<td className="p-4">
												<div className="flex flex-wrap gap-1">
													{user.role === UserRole.Admin ? (
														<span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
															Wszystkie oddziały
														</span>
													) : user.role === UserRole.Printer ? (
														<span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
															Wg przypisanych grup
														</span>
													) : user.branches.length > 0 ? (
														user.branches.map((b) => (
															<span
																key={b.branchId}
																className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
															>
																{b.branchName}
															</span>
														))
													) : (
														<span className="text-[10px] text-slate-400 italic">Brak przypisania</span>
													)}
												</div>
											</td>
											<td className="p-4">{renderRoleBadge(user.role)}</td>
											<td className="p-4 text-center">
												<span
													className={`rounded-full px-3 py-1 text-xs font-bold ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
												>
													{user.isActive ? 'Aktywny' : 'Blokada'}
												</span>
											</td>
											<td className="p-4 text-right">
												<div className="flex justify-end gap-2">
													{(() => {
														const isSelf = user.id === currentUser?.id;
														const isTargetAdmin = user.role === UserRole.Admin;

														const canEdit = !(isCurrentUserCoordinator && isTargetAdmin);
														const canToggleStatus = !isSelf && !(isCurrentUserCoordinator && isTargetAdmin);
														const canDelete = isCurrentUserAdmin && !isSelf && !isTargetAdmin;

														return (
															<>
																{canEdit && (
																	<button
																		onClick={() => openEditModal(user)}
																		className="cursor-pointer rounded-lg p-2 text-slate-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
																		title="Edytuj"
																	>
																		<PencilSquare size={18} />
																	</button>
																)}

																{canToggleStatus && (
																	<button
																		onClick={() => handleToggleStatus(user)}
																		className={`cursor-pointer rounded-lg p-2 transition-colors ${
																			user.isActive
																				? 'text-slate-400 hover:bg-red-100 hover:text-red-700'
																				: 'text-green-700 hover:bg-green-100'
																		}`}
																		title="Zablokuj/Odblokuj"
																	>
																		{user.isActive ? <LockFill size={18} /> : <UnlockFill size={18} />}
																	</button>
																)}



																{canDelete && (
																	<button
																		onClick={() => handleDeleteUser(user)}
																		className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-700"
																		title="Trwale usuń konto"
																	>
																		<Trash size={18} />
																	</button>
																)}
															</>
														);
													})()}
												</div>
											</td>
										</tr>
									))}
						</tbody>
					</table>
				</div>
				<div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
					<div className="text-sm text-slate-500">
						Pokazano <span className="font-bold">{users.length}</span> z <span className="font-bold">{totalCount}</span> użytkowników
					</div>
					<div className="flex gap-2">
						<button
							onClick={() => setPage(p => Math.max(1, p - 1))}
							disabled={page === 1}
							className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-bold text-slate-700 disabled:opacity-50"
						>
							Poprzednia
						</button>
						<span className="flex items-center px-2 text-sm font-bold text-slate-600">
							{page} / {totalPages}
						</span>
						<button
							onClick={() => setPage(p => Math.min(totalPages, p + 1))}
							disabled={page === totalPages || totalPages === 0}
							className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-bold text-slate-700 disabled:opacity-50"
						>
							Następna
						</button>
					</div>
				</div>
			</div>

			{/* MODAL */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
					<div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
						<div className="mb-6 flex items-center justify-between">
							<h2 className="text-xl font-bold">{editingUser ? 'Edytuj pracownika' : 'Nowy pracownik'}</h2>
							<button
								onClick={handleCloseModal}
								className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100"
							>
								<XLg />
							</button>
						</div>

						<form onSubmit={handleSubmit} className="flex flex-col gap-4">
							<div className="grid grid-cols-2 gap-4">
								<input
									type="text"
									placeholder="Imię"
									required
									value={formData.firstName}
									onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
									className="rounded-lg border p-2.5 outline-none focus:border-blue-500"
								/>
								<input
									type="text"
									placeholder="Nazwisko"
									required
									value={formData.lastName}
									onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
									className="rounded-lg border p-2.5 outline-none focus:border-blue-500"
								/>
							</div>

							<input
								type="email"
								placeholder="Email"
								required
								disabled={!!editingUser}
								value={formData.email}
								onChange={(e) => setFormData({ ...formData, email: e.target.value })}
								className="rounded-lg border p-2.5 disabled:bg-slate-50"
							/>

							{editingUser ? (
								<div>
									<label className="mb-1 block text-xs font-bold text-slate-500 uppercase">Hasło tymczasowe (opcjonalnie)</label>
									<div className="relative flex items-center">
										<input
											type={showStartPassword ? 'text' : 'password'}
											placeholder="Ustaw nowe hasło tymczasowe..."
											value={formData.password}
											onChange={(e) => setFormData({ ...formData, password: e.target.value })}
											className="w-full rounded-lg border p-2.5 pr-24 outline-none focus:border-blue-500"
										/>
										<div className="absolute right-2 flex items-center gap-1.5">
											<button
												type="button"
												tabIndex={-1}
												onClick={() => setShowStartPassword(!showStartPassword)}
												className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
												title={showStartPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
											>
												{showStartPassword ? <EyeSlashFill size={18} /> : <EyeFill size={18} />}
											</button>
											<button
												type="button"
												onClick={() => {
													const length = 10;
													const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
													const lowercase = 'abcdefghijklmnopqrstuvwxyz';
													const numbers = '0123456789';
													const special = '!@#$%^&*()_+~`|}{[]:;?><,./-';
													const allChars = uppercase + lowercase + numbers + special;
													
													let pwd = '';
													pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
													pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
													pwd += numbers[Math.floor(Math.random() * numbers.length)];
													pwd += special[Math.floor(Math.random() * special.length)];
													
													for (let i = 4; i < length; i++) {
														pwd += allChars[Math.floor(Math.random() * allChars.length)];
													}
													
													const shuffledPwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');
													setFormData(prev => ({ ...prev, password: shuffledPwd }));
													setShowStartPassword(true);
													toast.success('Wygenerowano losowe hasło tymczasowe.');
												}}
												className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 focus:outline-none"
												title="Generuj hasło tymczasowe"
											>
												Losuj
											</button>
										</div>
									</div>
								</div>
							) : (
								<div>
									<label className="mb-1 block text-xs font-bold text-slate-500 uppercase">Hasło startowe</label>
									<div className="relative flex items-center">
										<input
											type={showStartPassword ? 'text' : 'password'}
											placeholder="Wpisz hasło startowe..."
											required
											value={formData.password}
											onChange={(e) => setFormData({ ...formData, password: e.target.value })}
											className="w-full rounded-lg border p-2.5 pr-24 outline-none focus:border-blue-500"
										/>
										<div className="absolute right-2 flex items-center gap-1.5">
											<button
												type="button"
												tabIndex={-1}
												onClick={() => setShowStartPassword(!showStartPassword)}
												className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
												title={showStartPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
											>
												{showStartPassword ? <EyeSlashFill size={18} /> : <EyeFill size={18} />}
											</button>
											<button
												type="button"
												onClick={generateRandomPassword}
												className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100 focus:outline-none"
												title="Generuj losowe hasło"
											>
												Losuj
											</button>
										</div>
									</div>
								</div>
							)}

							<div>
								<label className="mb-1 block text-xs font-bold text-slate-500 uppercase">Rola w systemie</label>
								<select
									value={formData.role}
									onChange={(e) => {
										const newRole = Number(e.target.value) as UserRole;
										setFormData((prev) => {
											let updatedBranchIds = prev.branchIds;
											if (
												(newRole === UserRole.Trainer || newRole === UserRole.Coordinator) &&
												updatedBranchIds.length === 0 &&
												visibleBranches.length > 0
											) {
												updatedBranchIds = [visibleBranches[0].id];
											}
											return {
												...prev,
												role: newRole,
												branchIds: updatedBranchIds,
											};
										});
									}}
									disabled={isCurrentUserCoordinator} // Koordynator nie może zmienić roli (zawsze Trener)
									className="w-full cursor-pointer rounded-lg border bg-white p-2.5 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
								>
									{isCurrentUserAdmin && <option value={UserRole.Admin}>Administrator</option>}
									{isCurrentUserAdmin && <option value={UserRole.Coordinator}>Koordynator</option>}
									<option value={UserRole.Trainer}>Trener</option>
									{isCurrentUserAdmin && <option value={UserRole.Printer}>Drukarz</option>}
								</select>
							</div>

							{formData.role === UserRole.Printer ? (
								<div className="rounded-xl border border-purple-200 bg-purple-50 p-3.5 text-xs text-purple-900 leading-relaxed">
									<p className="font-bold text-sm mb-1 text-purple-800 flex items-center gap-1.5">
										<PrinterFill size={16} /> Przypisanie przez grupy
									</p>
									Drukarz nie wymaga ręcznego przypisywania oddziałów. Zlecenia druku są kierowane do niego automatycznie na podstawie grup przypisanych w zakładce <strong>Grupy</strong> (pojedynczo w edycji grupy lub masowo za pomocą checkboxów).
								</div>
							) : formData.role === UserRole.Admin ? (
								<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
									Administrator posiada pełny dostęp do wszystkich oddziałów, grup i zleceń druku w systemie.
								</div>
							) : (
								<div>
									<div className="mb-1.5 flex items-center justify-between">
										<label className="text-xs font-bold text-slate-500 uppercase">
											Przypisane Oddziały <span className="text-rose-500">*</span>
										</label>
										{visibleBranches.length === 1 && (
											<span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
												Oddział domyślny
											</span>
										)}
									</div>
									<div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-lg border bg-slate-50 p-2">
										{visibleBranches.length === 0 ? (
											<p className="col-span-2 p-2 text-center text-xs text-slate-400">Brak dostępnych oddziałów.</p>
										) : (
											visibleBranches.map((branch) => {
												const isChecked = formData.branchIds.includes(branch.id);
												const isLocked = visibleBranches.length === 1 && isChecked;

												return (
													<label
														key={branch.id}
														className={`flex items-center gap-2 text-sm transition-colors ${
															isLocked
																? 'cursor-not-allowed text-slate-700 font-semibold'
																: 'cursor-pointer hover:text-blue-600'
														}`}
													>
														<input
															type="checkbox"
															checked={isChecked}
															disabled={isLocked}
															onChange={() => toggleBranch(branch.id)}
															className="cursor-pointer rounded text-blue-600 disabled:cursor-not-allowed"
														/>
														<span className="truncate">{branch.name}</span>
														{isLocked && (
															<span className="text-[10px] font-bold text-slate-400">
																(stały)
															</span>
														)}
													</label>
												);
											})
										)}
									</div>
									{formData.branchIds.length === 0 && (
										<p className="mt-1.5 text-xs font-bold text-rose-600">
											Wybierz co najmniej jeden oddział dla pracownika.
										</p>
									)}
								</div>
							)}

							<div className="mt-4 flex gap-3">
								<button
									type="button"
									onClick={handleCloseModal}
									className="flex-1 cursor-pointer rounded-lg bg-slate-100 py-2.5 font-bold transition-colors hover:bg-slate-200"
								>
									Anuluj
								</button>
								<button
									type="submit"
									disabled={
										isSubmitting ||
										(formData.role !== UserRole.Printer &&
											formData.role !== UserRole.Admin &&
											formData.branchIds.length === 0)
									}
									className="flex-1 cursor-pointer rounded-lg bg-slate-800 py-2.5 font-bold text-white transition-colors hover:bg-slate-900 disabled:bg-slate-400 disabled:cursor-not-allowed"
								>
									{isSubmitting ? 'Czekaj...' : 'Zapisz'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
