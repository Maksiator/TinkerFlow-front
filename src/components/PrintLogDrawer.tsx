import { useState, useEffect } from 'react';
import {
	XLg,
	PrinterFill,
	CalendarEventFill,
	CheckCircleFill,
	ListUl,
	ClockHistory,
	PencilSquare,
	Trash,
} from 'react-bootstrap-icons';
import { printLogService, type PrintQueueItem, type PrintLogHistoryItem } from '../api/printLogService';
import toast from 'react-hot-toast';

interface PrintLogDrawerProps {
	groupId: string;
	isOpen: boolean;
	onClose: () => void;
}

export function PrintLogDrawer({ groupId, isOpen, onClose }: PrintLogDrawerProps) {
	const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');

	const [queue, setQueue] = useState<PrintQueueItem[]>([]);
	const [history, setHistory] = useState<PrintLogHistoryItem[]>([]);

	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
	const [editingLogId, setEditingLogId] = useState<string | null>(null);
	const [editFormData, setEditFormData] = useState({ studentId: '', printDate: '' });

	useEffect(() => {
		const fetchData = async () => {
			if (!groupId || !isOpen) return;

			setIsLoading(true);
			try {
				const queueData = await printLogService.getQueue(groupId);
				setQueue(queueData);

				if (activeTab === 'history') {
					const historyData = await printLogService.getHistory(groupId);
					setHistory(historyData);
				}
			} catch (error) {
				toast.error('Błąd pobierania danych.');
				console.error(error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [groupId, isOpen, refreshTrigger, activeTab]);

	const handleAddPrint = async (studentId: string, studentName: string) => {
		setIsSaving(true);
		try {
			await printLogService.addLog({
				studentId,
				printDate: new Date(selectedDate).toISOString(),
			});
			toast.success(`Zapisano wydruk dla: ${studentName}`);
			setRefreshTrigger((prev) => prev + 1);
		} catch (error) {
			toast.error('Błąd zapisu wydruku.');
			console.error(error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!window.confirm('Czy na pewno chcesz usunąć ten wydruk z historii?')) return;
		setIsSaving(true);
		try {
			await printLogService.deleteLog(id);
			toast.success('Wydruk usunięty!');
			setRefreshTrigger((prev) => prev + 1);
		} catch (error) {
			toast.error('Błąd podczas usuwania.');
			console.log(error);
		} finally {
			setIsSaving(false);
		}
	};

	const startEditing = (log: PrintLogHistoryItem) => {
		setEditingLogId(log.id);
		setEditFormData({
			studentId: log.studentId,
			printDate: new Date(log.printDate).toISOString().split('T')[0],
		});
	};

	const handleSaveEdit = async () => {
		if (!editingLogId) return;
		setIsSaving(true);
		try {
			await printLogService.updateLog(editingLogId, {
				studentId: editFormData.studentId,
				printDate: new Date(editFormData.printDate).toISOString(),
			});
			toast.success('Pomyślnie zaktualizowano wpis!');
			setEditingLogId(null);
			setRefreshTrigger((prev) => prev + 1);
		} catch (error) {
			toast.error('Błąd podczas edycji.');
			console.log(error);
		} finally {
			setIsSaving(false);
		}
	};

	const formatDate = (isoString: string | null) => {
		if (!isoString) return 'Nigdy';
		return new Date(isoString).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
	};

	// Zamknięcie po kliknięciu w tło (backdrop)
	const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	if (!isOpen) return null;

	return (
		<div
			onMouseDown={handleBackdropClick}
			className="animate-in fade-in fixed inset-0 z-50 flex cursor-pointer justify-end bg-slate-900/50 backdrop-blur-sm duration-200"
		>
			<div
				onMouseDown={(e) => e.stopPropagation()}
				className="slide-in-from-right-full animate-in flex h-full w-full max-w-md cursor-default flex-col bg-white shadow-2xl duration-300"
			>
				{/* NAGŁÓWEK */}
				<div className="flex shrink-0 flex-col bg-slate-800 text-white">
					<div className="flex items-center justify-between p-6">
						<div className="flex items-center gap-3">
							<PrinterFill size={24} className="text-blue-400" />
							<div>
								<h2 className="text-xl font-extrabold">Drukowanie</h2>
								<p className="text-sm text-slate-300">Zarządzanie drukowaniami</p>
							</div>
						</div>
						<button onClick={onClose} className="cursor-pointer text-slate-400 transition-colors hover:text-white">
							<XLg size={24} />
						</button>
					</div>

					{/* ZAKŁADKI */}
					<div className="flex border-t border-slate-700 bg-slate-800 text-sm font-bold text-slate-400">
						<button
							onClick={() => setActiveTab('queue')}
							className={`flex-1 cursor-pointer py-3 text-center transition-colors ${activeTab === 'queue' ? 'border-b-2 border-blue-400 text-white' : 'hover:bg-slate-700 hover:text-slate-200'}`}
						>
							<ListUl className="mr-2 inline" /> Kolejka
						</button>
						<button
							onClick={() => setActiveTab('history')}
							className={`flex-1 cursor-pointer py-3 text-center transition-colors ${activeTab === 'history' ? 'border-b-2 border-blue-400 text-white' : 'hover:bg-slate-700 hover:text-slate-200'}`}
						>
							<ClockHistory className="mr-2 inline" /> Historia druków
						</button>
					</div>
				</div>

				{/* ZAWARTOŚĆ ZAKŁADKI: KOLEJKA */}
				{activeTab === 'queue' && (
					<>
						<div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
							<div className="flex items-center gap-2 text-sm font-medium text-slate-600">
								<CalendarEventFill /> Data wydruku:
							</div>
							<input
								type="date"
								value={selectedDate}
								onChange={(e) => setSelectedDate(e.target.value)}
								className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
							/>
						</div>

						<div className="scrollbar-thin flex-1 overflow-y-auto p-4">
							{isLoading ? (
								<div className="mt-10 text-center font-medium text-slate-400">Ładowanie kolejki...</div>
							) : (
								<div className="flex flex-col gap-3">
									{queue.map((item, index) => {
										const isFirst = index === 0;
										return (
											<div
												key={item.studentId}
												className={`flex flex-col rounded-xl border p-4 transition-all ${isFirst ? 'border-blue-400 bg-blue-50 shadow-md' : 'border-slate-200 bg-white'}`}
											>
												<div className="mb-3 flex items-center justify-between">
													<div>
														<h3 className={`font-bold ${isFirst ? 'text-lg text-blue-900' : 'text-slate-800'}`}>
															{index + 1}. {item.fullName}
														</h3>
														<div className="mt-1 flex gap-4 text-xs font-medium text-slate-500">
															<span>
																Wydruków: <strong className="text-slate-700">{item.totalPrints}</strong>
															</span>
															<span>
																Ostatnio: <strong className="text-slate-700">{formatDate(item.lastPrintDate)}</strong>
															</span>
														</div>
													</div>
												</div>

												<button
													onClick={() => handleAddPrint(item.studentId, item.fullName)}
													disabled={isSaving}
													className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg py-2 font-bold transition-colors ${isFirst ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
												>
													<CheckCircleFill /> Zapisz wydruk
												</button>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</>
				)}

				{/* ZAWARTOŚĆ ZAKŁADKI: HISTORIA */}
				{activeTab === 'history' && (
					<div className="scrollbar-thin flex-1 overflow-y-auto bg-slate-50 p-4">
						{isLoading ? (
							<div className="mt-10 text-center font-medium text-slate-400">Ładowanie historii...</div>
						) : history.length === 0 ? (
							<div className="mt-10 text-center font-medium text-slate-400">Brak historii wydruków dla tej grupy.</div>
						) : (
							<div className="flex flex-col gap-3">
								{history.map((item) => (
									<div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
										{editingLogId === item.id ? (
											<div className="flex flex-col gap-3">
												<div className="text-xs font-bold text-slate-500 uppercase">Edycja wydruku</div>
												<select
													value={editFormData.studentId}
													onChange={(e) => setEditFormData({ ...editFormData, studentId: e.target.value })}
													className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-blue-500"
												>
													{queue.map((q) => (
														<option key={q.studentId} value={q.studentId}>
															{q.fullName}
														</option>
													))}
												</select>
												<input
													type="date"
													value={editFormData.printDate}
													onChange={(e) => setEditFormData({ ...editFormData, printDate: e.target.value })}
													className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-blue-500"
												/>
												<div className="mt-2 flex gap-2">
													<button
														onClick={() => setEditingLogId(null)}
														className="flex-1 rounded bg-slate-100 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"
													>
														Anuluj
													</button>
													<button
														onClick={handleSaveEdit}
														disabled={isSaving}
														className="flex-1 rounded bg-blue-600 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
													>
														Zapisz zmiany
													</button>
												</div>
											</div>
										) : (
											<div className="flex items-center justify-between">
												<div>
													<h3 className="font-bold text-slate-800">{item.fullName}</h3>
													<p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
														<CalendarEventFill /> {formatDate(item.printDate)}
													</p>
												</div>
												<div className="flex gap-2">
													<button
														onClick={() => startEditing(item)}
														className="rounded-lg bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
														title="Edytuj"
													>
														<PencilSquare size={16} />
													</button>
													<button
														onClick={() => handleDelete(item.id)}
														className="rounded-lg bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
														title="Usuń wydruk"
													>
														<Trash size={16} />
													</button>
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
