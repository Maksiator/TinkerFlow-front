import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
	XLg,
	PrinterFill,
	Scissors,
	EyeFill,
	LayersFill,
	PersonPlusFill,
	PlusLg,
	ChevronDown,
	ChevronUp,
} from 'react-bootstrap-icons';
import toast from 'react-hot-toast';
import { authService } from '../api/authService';
import { UserRole } from '../api/userService';
import { type PrintBatchResponse, PrintBatchState } from '../api/printBatchService';

export interface CustomLabelItem {
	id: string;
	studentName: string;
	groupName: string;
}

export interface PrintLabelsModalProps {
	isOpen: boolean;
	onClose: () => void;
	allBatches: PrintBatchResponse[];
	selectedBatchIds: string[];
	onBatchIdsChange?: (newIds: string[]) => void;
}

export const PrintLabelsModal: React.FC<PrintLabelsModalProps> = ({
	isOpen,
	onClose,
	allBatches,
	selectedBatchIds,
	onBatchIdsChange,
}) => {
	const currentUser = authService.getCurrentUser();
	const isAdmin = currentUser?.role === UserRole.Admin;

	const [activeBatchIds, setActiveBatchIds] = useState<string[]>(selectedBatchIds);

	// STANY DLA WŁASNYCH / WARSZTATOWYCH ETYKIET
	const [customGroupName, setCustomGroupName] = useState('');
	const [customNamesText, setCustomNamesText] = useState('');
	const [isCustomSectionOpen, setIsCustomSectionOpen] = useState(false);
	const [customLabels, setCustomLabels] = useState<CustomLabelItem[]>(() => {
		try {
			const saved = localStorage.getItem('print_custom_labels');
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	});

	// Auto-zapis customowych etykiet
	useEffect(() => {
		try {
			if (customLabels.length > 0) {
				localStorage.setItem('print_custom_labels', JSON.stringify(customLabels));
			} else {
				localStorage.removeItem('print_custom_labels');
			}
		} catch {
			// ignore
		}
	}, [customLabels]);

	useEffect(() => {
		if (isOpen) {
			setActiveBatchIds(selectedBatchIds);
		}
	}, [isOpen, selectedBatchIds]);

	// Paczki, które są aktualnie wybrane i mają wydruki
	const activeBatches = useMemo(() => {
		return allBatches.filter(
			(b) => activeBatchIds.includes(b.id) && b.status !== PrintBatchState.NoPrints && (b.printJobs?.length ?? 0) > 0
		);
	}, [allBatches, activeBatchIds]);

	const removeBatch = (batchId: string) => {
		const next = activeBatchIds.filter((id) => id !== batchId);
		setActiveBatchIds(next);
		onBatchIdsChange?.(next);
	};

	const clearAllSelected = () => {
		setActiveBatchIds([]);
		onBatchIdsChange?.([]);
	};

	const handleAddCustomLabels = () => {
		const lines = customNamesText
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);

		if (lines.length === 0) {
			toast.error('Wpisz przynajmniej jedno imię i nazwisko!');
			return;
		}

		const group = customGroupName.trim() || 'Warsztaty';
		const newItems: CustomLabelItem[] = lines.map((name) => ({
			id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
			studentName: name,
			groupName: group,
		}));

		setCustomLabels((prev) => [...prev, ...newItems]);
		setCustomNamesText('');
		toast.success(`Dodano ${newItems.length} osób do wydruku etykiet.`);
	};

	const handleRemoveCustomLabel = (id: string) => {
		setCustomLabels((prev) => prev.filter((l) => l.id !== id));
	};

	const handleClearCustomLabels = () => {
		setCustomLabels([]);
		toast.success('Wyczyszczono własne etykiety.');
	};

	// Przygotowanie listy etykiet ze wszystkich zaznaczonych paczek + własnych pozycji (1 na ucznia)
	const labels = useMemo(() => {
		const list: Array<{
			id: string;
			studentName: string;
			groupName: string;
		}> = [];

		for (const batch of activeBatches) {
			const studentNames = Array.from(
				new Set(batch.printJobs.map((job) => job.studentName.trim()).filter(Boolean))
			).sort((a, b) => a.localeCompare(b, 'pl'));

			for (const studentName of studentNames) {
				list.push({
					id: `${batch.id}-${studentName}`,
					studentName,
					groupName: batch.groupName,
				});
			}
		}

		for (const custom of customLabels) {
			list.push(custom);
		}

		return list;
	}, [activeBatches, customLabels]);

	// Podział na wiersze po 3 etykiety (do siatki tabeli ze wspólnymi ramkami cięcia)
	const labelRows = useMemo(() => {
		const rows: Array<typeof labels> = [];
		for (let i = 0; i < labels.length; i += 3) {
			rows.push(labels.slice(i, i + 3));
		}
		return rows;
	}, [labels]);

	if (!isOpen || !isAdmin) return null;

	const handlePrint = () => {
		window.print();
	};

	const sheetsCount = Math.ceil(labels.length / 24) || 1;

	return (
		<>
			{/* STYLE DRUKU - WYPEŁNIAJĄ DOKŁADNIE A4 PORTRAIT ZE WSPÓLNYMI RAMKAMI */}
			<style>{`
				@media screen {
					#labels-print-portal {
						display: none !important;
					}
				}
				@media print {
					@page {
						size: A4 portrait !important;
						margin: 10mm 15mm !important;
					}
					html, body {
						background: #ffffff !important;
						margin: 0 !important;
						padding: 0 !important;
						width: 100% !important;
						height: auto !important;
					}
					/* Ukrywamy całą aplikację i modal, drukujemy tylko portal */
					body > *:not(#labels-print-portal) {
						display: none !important;
					}
					#labels-print-portal {
						display: block !important;
						width: 180mm !important;
						margin: 0 auto !important;
						padding: 0 !important;
						background: #ffffff !important;
					}
					#labels-print-portal * {
						-webkit-print-color-adjust: exact !important;
						print-color-adjust: exact !important;
					}
					.labels-table-print {
						width: 180mm !important;
						border-collapse: collapse !important;
						table-layout: fixed !important;
						margin: 0 auto !important;
						border: 1.5px dashed #000000 !important;
					}
					.labels-table-print tr {
						page-break-inside: avoid !important;
						break-inside: avoid !important;
						height: 30mm !important;
					}
					.label-cell-print {
						width: 60mm !important;
						min-width: 60mm !important;
						max-width: 60mm !important;
						height: 30mm !important;
						min-height: 30mm !important;
						max-height: 30mm !important;
						border: 1.5px dashed #000000 !important;
						box-sizing: border-box !important;
						text-align: center !important;
						vertical-align: middle !important;
						padding: 2mm 3mm !important;
						background: #ffffff !important;
					}
					.student-name-print {
						font-size: 13px !important;
						font-weight: 900 !important;
						text-transform: uppercase !important;
						color: #000000 !important;
						line-height: 1.2 !important;
						letter-spacing: 0.3px !important;
						word-break: break-word !important;
						max-width: 100% !important;
					}
					.group-name-print {
						font-size: 10px !important;
						font-weight: 700 !important;
						color: #222222 !important;
						margin-top: 3px !important;
						line-height: 1.2 !important;
						word-break: break-word !important;
						max-width: 100% !important;
					}
				}
			`}</style>

			{/* PORTAL DRUKU (DOCZEPIONY DO BODY, AKTYWOWANY W @media print) */}
			{createPortal(
				<div id="labels-print-portal">
					<table className="labels-table-print">
						<tbody>
							{labelRows.map((row, rIdx) => (
								<tr key={rIdx}>
									{row.map((label) => (
										<td key={label.id} className="label-cell-print">
											<div className="student-name-print">{label.studentName}</div>
											<div className="group-name-print">{label.groupName}</div>
										</td>
									))}
									{Array.from({ length: 3 - row.length }).map((_, cIdx) => (
										<td key={`empty-print-${rIdx}-${cIdx}`} className="label-cell-print">
											&nbsp;
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>,
				document.body
			)}

			{/* MODAL EKRANOWY */}
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 md:p-6 backdrop-blur-sm">
				<div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl transition-all">
					{/* NAGŁÓWEK MODALU */}
					<div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
								<Scissors size={20} />
							</div>
							<div>
								<h2 className="text-lg font-extrabold text-slate-800">
									Drukuj etykiety do woreczków (A4)
									<span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
										Tylko Administrator
									</span>
								</h2>
								<p className="text-xs text-slate-500">
									Format pionowy A4 (3 kolumny po 6×3 cm, do 24 etykiet na arkusz z przerywaną linią cięcia)
								</p>
							</div>
						</div>

						<button
							onClick={onClose}
							className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
						>
							<XLg size={18} />
						</button>
					</div>

					{/* SEKCJA WŁASNYCH ETYKIET / WARSZTATÓW JEDNORAZOWYCH (ADMIN ONLY) */}
					<div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
						<div className="flex items-center justify-between">
							<button
								type="button"
								onClick={() => setIsCustomSectionOpen(!isCustomSectionOpen)}
								className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 transition-colors hover:text-purple-700"
							>
								<PersonPlusFill className="text-purple-600" />
								<span>Własne etykiety / jednorazowe warsztaty</span>
								{customLabels.length > 0 && (
									<span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 lowercase">
										{customLabels.length} {customLabels.length === 1 ? 'dodana' : 'dodanych'}
									</span>
								)}
								{isCustomSectionOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
							</button>

							{customLabels.length > 0 && (
								<button
									type="button"
									onClick={handleClearCustomLabels}
									className="cursor-pointer text-[11px] font-medium text-slate-500 transition-colors hover:text-red-600"
								>
									Wyczyść własne ({customLabels.length})
								</button>
							)}
						</div>

						{/* FORMULARZ DODAWANIA WŁASNYCH OSÓB */}
						{(isCustomSectionOpen || (customLabels.length === 0 && activeBatches.length === 0)) && (
							<div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
								<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
									<div className="md:col-span-1">
										<label className="mb-1 block text-xs font-bold text-slate-700">
											Nazwa grupy / warsztatów
										</label>
										<input
											type="text"
											value={customGroupName}
											onChange={(e) => setCustomGroupName(e.target.value)}
											placeholder="np. Warsztaty SP 15"
											className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs outline-none transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
										/>
										<p className="mt-1 text-[10px] text-slate-400">
											Domyślnie: „Warsztaty”, jeśli pole pozostanie puste.
										</p>
									</div>

									<div className="md:col-span-2">
										<label className="mb-1 block text-xs font-bold text-slate-700">
											Uczestnicy (wklej imiona i nazwiska, jedno pod drugim)
										</label>
										<div className="flex gap-2">
											<textarea
												rows={2}
												value={customNamesText}
												onChange={(e) => setCustomNamesText(e.target.value)}
												placeholder={'Jan Kowalski\nAnna Nowak\nPiotr Wiśniewski'}
												className="flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
											/>
											<button
												type="button"
												onClick={handleAddCustomLabels}
												disabled={!customNamesText.trim()}
												className="flex self-stretch cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-4 text-xs font-bold text-white shadow-xs transition-all hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
											>
												<PlusLg size={14} />
												<span>Dodaj</span>
											</button>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* LISTA DODANYCH WŁASNYCH ETYKIET */}
						{customLabels.length > 0 && (
							<div className="mt-2.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1">
								{customLabels.map((c) => (
									<span
										key={c.id}
										className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-2.5 py-0.5 text-xs font-medium text-purple-900 shadow-xs"
									>
										<span className="font-bold">{c.studentName}</span>
										<span className="text-[10px] text-purple-500">({c.groupName})</span>
										<button
											type="button"
											onClick={() => handleRemoveCustomLabel(c.id)}
											className="ml-0.5 cursor-pointer text-slate-400 transition-colors hover:text-red-600"
											title="Usuń tę etykietę"
										>
											<XLg size={10} />
										</button>
									</span>
								))}
							</div>
						)}
					</div>

					{/* WYBRANE GRUPY DO WYDRUKU (ZAZNACZONE CHECKBOXAMI) */}
					{activeBatches.length > 0 && (
						<div className="border-b border-slate-200 bg-purple-50/50 px-6 py-3">
							<div className="mb-2 flex items-center justify-between">
								<div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
									<LayersFill className="text-purple-600" />
									Wybrane grupy do wydruku na tym arkuszu ({activeBatches.length}):
								</div>
								{activeBatches.length > 1 && (
									<button
										type="button"
										onClick={clearAllSelected}
										className="text-[11px] font-medium text-slate-500 hover:text-red-600 cursor-pointer transition-colors"
									>
										Usuń wszystkie
									</button>
								)}
							</div>

							<div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
								{activeBatches.map((b) => {
									const uniqueKids = new Set(b.printJobs.map((j) => j.studentName)).size;
									return (
										<span
											key={b.id}
											className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-3 py-1 text-xs font-semibold text-purple-900 shadow-xs"
										>
											<span className="truncate max-w-[220px]">{b.groupName}</span>
											<span className="rounded-full bg-purple-100 px-1.5 py-0.2 text-[10px] font-bold text-purple-700">
												{uniqueKids} {uniqueKids === 1 ? 'dziecko' : 'dzieci'}
											</span>
											<button
												type="button"
												onClick={() => removeBatch(b.id)}
												className="cursor-pointer text-slate-400 hover:text-red-600 transition-colors ml-0.5"
												title="Usuń tę grupę z arkusza"
											>
												<XLg size={11} />
											</button>
										</span>
									);
								})}
							</div>
						</div>
					)}

					{/* PASEK Z PODSUMOWANIEM I PRZYCISKIEM DRUKU */}
					<div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-6 py-3">
						<div className="text-xs font-semibold text-slate-500">
							Układ A4 (pion): 1 etykieta na dziecko • 3 kolumny po 60×30 mm
						</div>

						<div className="flex items-center gap-3">
							<div className="text-right mr-2">
								<div className="text-xs font-bold text-slate-800">
									Łącznie: <span className="text-purple-600 font-extrabold">{labels.length}</span> etykiet
								</div>
								<div className="text-[10px] text-slate-400">
									{sheetsCount} {sheetsCount === 1 ? 'strona A4' : 'strony A4'} (mieści 24 na arkusz)
								</div>
							</div>

							<button
								type="button"
								onClick={onClose}
								className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
							>
								Zamknij
							</button>
							<button
								type="button"
								onClick={handlePrint}
								disabled={labels.length === 0}
								className="cursor-pointer flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-purple-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<PrinterFill size={15} />
								Drukuj na A4 ({labels.length})
							</button>
						</div>
					</div>

					{/* PODGLĄD EKRANOWY ARKUSZA */}
					<div className="flex-1 overflow-y-auto bg-slate-200/70 p-4 md:p-6">
						{labels.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
								<Scissors className="mx-auto mb-3 text-slate-300" size={32} />
								<p className="text-sm font-bold text-slate-600">Brak wybranych etykiet do wydruku.</p>
								<p className="text-xs text-slate-400 mt-1">
									Zaznacz grupy w panelu lub wpisz własne osoby w sekcji powyżej (np. na jednorazowe warsztaty).
								</p>
							</div>
						) : (
							<div className="mx-auto max-w-[210mm] rounded-xl border border-slate-300 bg-white p-6 shadow-xl">
								<div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-400 font-medium">
									<span className="flex items-center gap-1.5">
										<EyeFill size={12} /> Podgląd arkusza A4 (połączona tabela ze wspólnymi liniami cięcia dla gilotyny)
									</span>
									<span className="font-bold text-slate-600">Rozmiar etykiety: 60 × 30 mm</span>
								</div>

								{/* TABELA PODGLĄDU ZE WSPÓLNYMI RAMKAMI (BORDER-COLLAPSE) */}
								<table
									style={{
										width: '100%',
										borderCollapse: 'collapse',
										tableLayout: 'fixed',
										border: '1.5px dashed #000000',
									}}
								>
									<tbody>
										{labelRows.map((row, rIdx) => (
											<tr key={rIdx} style={{ height: '76px' }}>
												{row.map((label) => (
													<td
														key={label.id}
														style={{
															width: '33.333%',
															border: '1.5px dashed #000000',
															padding: '8px 12px',
															textAlign: 'center',
															verticalAlign: 'middle',
															boxSizing: 'border-box',
															backgroundColor: '#ffffff',
														}}
													>
														<div className="text-[13px] font-black uppercase tracking-wide text-black leading-tight">
															{label.studentName}
														</div>
														<div className="mt-1 text-[11px] font-bold text-slate-700 leading-tight">
															{label.groupName}
														</div>
													</td>
												))}
												{Array.from({ length: 3 - row.length }).map((_, cIdx) => (
													<td
														key={`empty-${rIdx}-${cIdx}`}
														style={{
															width: '33.333%',
															border: '1.5px dashed #000000',
															backgroundColor: '#ffffff',
														}}
													>
														&nbsp;
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
};
