import { useState, useEffect } from 'react';
import { printBatchService, type PrintBatchResponse, PrintBatchState } from '../api/printBatchService';
import { PrinterFill, ClockHistory, CheckCircleFill, GearFill } from 'react-bootstrap-icons';
import { PrintBatchManagerModal } from '../components/PrintBatchManagerModal';
import toast from 'react-hot-toast';

export function PrinterDashboard() {
	const [batches, setBatches] = useState<PrintBatchResponse[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedBatch, setSelectedBatch] = useState<PrintBatchResponse | null>(null);

	// Dodajemy trigger do ręcznego odświeżania z przycisku
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	useEffect(() => {
		let isMounted = true;

		const fetchBatches = async () => {
			setIsLoading(true);
			try {
				const data = await printBatchService.getBatchesForFarm();
				if (isMounted) {
					setBatches(data);
				}
			} catch (error: unknown) {
				// ZMIANA 1: Używamy 'unknown' zamiast 'any'
				console.error(error);
				if (isMounted) {
					// ZMIANA 2: Weryfikujemy typ błędu przed wyciągnięciem wiadomości
					const errorMessage = error instanceof Error ? error.message : 'Nie udało się pobrać paczek.';

					toast.error(errorMessage);
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		fetchBatches();

		return () => {
			isMounted = false;
		};
	}, [refreshTrigger]);

	// Funkcja wywoływana przez przycisk odświeżania
	const handleRefresh = () => {
		setRefreshTrigger((prev) => prev + 1);
	};

	// Pomocnicza funkcja do tłumaczenia statusu i przypisania koloru
	const getStatusBadge = (status: PrintBatchState) => {
		switch (status) {
			case PrintBatchState.Pending:
				return (
					<span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">Oczekujące</span>
				);
			case PrintBatchState.Printing:
				return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">W druku</span>;
			case PrintBatchState.ReadyForCollection:
				return (
					<span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">Do odbioru</span>
				);
			case PrintBatchState.Completed:
				return <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">Zakończone</span>;
			default:
				return <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-800">Nieznany</span>;
		}
	};

	if (isLoading && batches.length === 0) {
		return (
			<div className="flex h-full items-center justify-center p-10">
				<div className="text-lg font-bold text-slate-400">Ładowanie farmy druku...</div>
			</div>
		);
	}

	return (
		<div className="p-6 md:p-10">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="flex items-center gap-3 text-3xl font-extrabold text-slate-800">
						<PrinterFill className="text-purple-600" /> Farma Druku
					</h1>
					<p className="mt-2 text-slate-500">Zarządzaj zleceniami spływającymi od trenerów.</p>
				</div>
				<button
					onClick={handleRefresh}
					disabled={isLoading}
					className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
				>
					{isLoading ? 'Odświeżanie...' : 'Odśwież listę'}
				</button>
			</div>

			{batches.length === 0 ? (
				<div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
					<p className="text-lg font-bold text-slate-500">Brak aktywnych zleceń druku.</p>
					<p className="text-sm text-slate-400">Trenerzy jeszcze nic nie przysłali na farmę.</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
					{batches.map((batch) => (
						<div
							key={batch.id}
							className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
						>
							{/* Karta paczki - Nagłówek */}
							<div className="border-b border-slate-100 bg-slate-50 p-4">
								<div className="mb-2 flex items-start justify-between">
									<h2 className="truncate pr-2 text-lg font-bold text-slate-800" title={batch.groupName}>
										{batch.groupName}
									</h2>
									<div className="shrink-0">{getStatusBadge(batch.status)}</div>
								</div>

								<div className="flex flex-col gap-1 text-xs text-slate-500">
									<div className="flex items-center gap-1.5">
										<ClockHistory /> Termin oddania:{' '}
										<strong className="text-red-600">{new Date(batch.deadline).toLocaleDateString()}</strong>
									</div>
									<div className="flex items-center gap-1.5">
										<CheckCircleFill /> Data zajęć:{' '}
										<span className="text-slate-700">{new Date(batch.lessonDate).toLocaleDateString()}</span>
									</div>
								</div>
							</div>

							{/* Karta paczki - Zawartość (Projekty) */}
							<div className="flex-1 p-4">
								<h3 className="mb-3 text-xs font-extrabold tracking-wider text-slate-400 uppercase">
									Zawartość paczki ({batch.printJobs.length})
								</h3>
								<ul className="flex flex-col gap-2">
									{batch.printJobs.map((job) => (
										<li
											key={job.id}
											className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2 text-sm"
										>
											<span className="truncate font-bold text-slate-700">{job.studentName}</span>
											<span className="shrink-0 rounded border border-purple-100 bg-white px-2 py-1 text-xs font-bold text-purple-700 shadow-sm">
												{job.projectName}
											</span>
										</li>
									))}
								</ul>

								{batch.notes && (
									<div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
										<strong>Notatka od trenera:</strong>
										<p className="mt-1 italic">{batch.notes}</p>
									</div>
								)}
							</div>

							{/* Karta paczki - Stopka */}
							<div className="border-t border-slate-100 bg-slate-50 p-3">
								<button
									onClick={() => setSelectedBatch(batch)} // <-- DODANO onClick
									className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-purple-600 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-purple-700"
								>
									<GearFill /> Zarządzaj paczką
								</button>
							</div>
						</div>
					))}
				</div>
			)}
			{/* ---- DODANY MODAL ---- */}
			{selectedBatch && (
				<PrintBatchManagerModal
					batch={selectedBatch}
					isOpen={!!selectedBatch}
					onClose={() => setSelectedBatch(null)}
					onRefreshNeeded={() => {
						// Gdy paczka zmieni status z poziomu modala, musimy odświeżyć główną listę
						setRefreshTrigger((prev) => prev + 1);
					}}
				/>
			)}
		</div>
	);
}
