import React, { useState, useEffect, useMemo } from 'react';
import { XLg, ArrowLeftRight, Search, CheckLg, Building, People } from 'react-bootstrap-icons';
import { toast } from 'react-hot-toast';
import { groupService, type Group } from '../api/groupService';
import { studentService } from '../api/studentService';

export interface TransferStudentModalProps {
	isOpen: boolean;
	onClose: () => void;
	student: {
		id: string;
		firstName: string;
		lastName: string;
		currentGroupId?: string | null;
		currentGroupName?: string | null;
	} | null;
	onSuccess?: (targetGroupId: string, targetGroupName: string) => void;
}

export const TransferStudentModal: React.FC<TransferStudentModalProps> = ({
	isOpen,
	onClose,
	student,
	onSuccess,
}) => {
	const [groups, setGroups] = useState<Group[]>([]);
	const [isLoadingGroups, setIsLoadingGroups] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedGroupId, setSelectedGroupId] = useState<string>('');
	const [reason, setReason] = useState('');
	const [recordHistory, setRecordHistory] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setSelectedGroupId('');
			setReason('');
			setSearchQuery('');
			setRecordHistory(true);
			fetchGroups();
		}
	}, [isOpen, student?.id]);

	const fetchGroups = async () => {
		setIsLoadingGroups(true);
		try {
			const data = await groupService.getAll(false);
			setGroups(data);
		} catch (error) {
			console.error('Błąd podczas pobierania grup do migracji:', error);
			toast.error('Nie udało się załadować listy grup.');
		} finally {
			setIsLoadingGroups(false);
		}
	};

	const availableGroups = useMemo(() => {
		return groups.filter((g) => g.id !== student?.currentGroupId);
	}, [groups, student?.currentGroupId]);

	const filteredGroups = useMemo(() => {
		if (!searchQuery.trim()) return availableGroups;
		const query = searchQuery.toLowerCase().trim();
		return availableGroups.filter(
			(g) =>
				g.name.toLowerCase().includes(query) ||
				(g.branchName && g.branchName.toLowerCase().includes(query))
		);
	}, [availableGroups, searchQuery]);

	const selectedGroup = useMemo(() => {
		return groups.find((g) => g.id === selectedGroupId);
	}, [groups, selectedGroupId]);

	if (!isOpen || !student) return null;

	const handleTransfer = async () => {
		if (!selectedGroupId) {
			toast.error('Wybierz grupę docelową.');
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await studentService.transferStudent(student.id, {
				targetGroupId: selectedGroupId,
				reason: reason.trim() || undefined,
				recordHistory: Boolean(student.currentGroupId && recordHistory),
			});

			toast.success(response.message || `Przepisano ucznia do grupy ${response.targetGroupName}!`);
			onSuccess?.(response.targetGroupId, response.targetGroupName);
			onClose();
		} catch (error: any) {
			console.error('Błąd podczas przepisywania ucznia:', error);
			const msg = error.response?.data?.message || 'Wystąpił błąd podczas przepisywania ucznia.';
			toast.error(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
			<div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-slate-100 pb-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
							<ArrowLeftRight size={20} />
						</div>
						<div>
							<h3 className="text-lg font-bold text-slate-800">Przepisz ucznia</h3>
							<p className="text-xs text-slate-500">
								Szybkie przeniesienie do innej grupy z zachowaniem historii
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						disabled={isSubmitting}
						className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
					>
						<XLg size={18} />
					</button>
				</div>

				{/* Student info card */}
				<div className="my-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
					<div className="flex items-center justify-between">
						<div>
							<div className="text-xs font-bold uppercase tracking-wider text-slate-400">Uczeń</div>
							<div className="text-base font-extrabold text-slate-800">
								{student.firstName} {student.lastName}
							</div>
						</div>
						<div className="text-right">
							<div className="text-xs font-bold uppercase tracking-wider text-slate-400">Obecna grupa</div>
							<div className="text-sm font-semibold text-slate-700">
								{student.currentGroupName ? (
									<span className="text-blue-600 font-bold">{student.currentGroupName}</span>
								) : (
									<span className="italic text-slate-400">Brak grupy</span>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Destination Group Selection */}
				<div className="mb-4">
					<label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
						Wybierz grupę docelową <span className="text-red-500">*</span>
					</label>
					<div className="relative mb-2">
						<Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={14} />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Filtruj grupy wg nazwy lub oddziału..."
							className="w-full rounded-lg border border-slate-300 py-2.5 pr-4 pl-9 text-sm outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
						/>
					</div>

					{/* Groups list */}
					<div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-1 divide-y divide-slate-100">
						{isLoadingGroups ? (
							<div className="p-4 text-center text-xs text-slate-400">Ładowanie dostępnych grup...</div>
						) : filteredGroups.length === 0 ? (
							<div className="p-4 text-center text-xs text-slate-500">
								{searchQuery ? 'Brak grup spełniających kryteria.' : 'Brak dostępnych grup.'}
							</div>
						) : (
							filteredGroups.map((group) => {
								const isSelected = selectedGroupId === group.id;
								return (
									<button
										key={group.id}
										type="button"
										onClick={() => setSelectedGroupId(group.id)}
										className={`flex w-full cursor-pointer items-center justify-between rounded-lg p-2.5 text-left transition-all ${
											isSelected
												? 'bg-blue-600 text-white shadow-sm'
												: 'bg-white hover:bg-blue-50 text-slate-700'
										}`}
									>
										<div className="min-w-0 flex-1">
											<div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
												{group.name}
											</div>
											<div className="flex items-center gap-3 mt-0.5 text-xs">
												<span className={`flex items-center gap-1 truncate ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
													<Building size={11} /> {group.branchName}
												</span>
												<span className={`flex items-center gap-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
													<People size={11} /> {group.studentCount} uczniów
												</span>
											</div>
										</div>
										{isSelected && (
											<div className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-600">
												<CheckLg size={14} />
											</div>
										)}
									</button>
								);
							})
						)}
					</div>
				</div>

				{/* Reason input */}
				<div className="mb-4">
					<label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
						Powód przepisania <span className="text-slate-400 lowercase font-normal">(opcjonalnie)</span>
					</label>
					<input
						type="text"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="np. Zmiana terminu zajęć przez rodzica"
						className="w-full rounded-lg border border-slate-300 p-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				{/* History checkbox */}
				{student.currentGroupId && (
					<label className="mb-6 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-600">
						<input
							type="checkbox"
							checked={recordHistory}
							onChange={(e) => setRecordHistory(e.target.checked)}
							className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
						/>
						<span>
							Zapisz informację o przeniesieniu w historii poprzedniej grupy (jako wypisanie w trakcie roku z
							adnotacją o nowej grupie).
						</span>
					</label>
				)}

				{/* Actions */}
				<div className="flex gap-3">
					<button
						type="button"
						onClick={onClose}
						disabled={isSubmitting}
						className="flex-1 cursor-pointer rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
					>
						Anuluj
					</button>
					<button
						type="button"
						onClick={handleTransfer}
						disabled={isSubmitting || !selectedGroupId}
						className="flex-1 cursor-pointer rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
					>
						{isSubmitting ? (
							'Przepisywanie...'
						) : (
							<>
								<ArrowLeftRight size={15} />
								Przepisz do {selectedGroup ? selectedGroup.name : 'grupy'}
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
};
