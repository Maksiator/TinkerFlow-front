import { useState, useEffect } from 'react';
import { studentProjectService, type PendingPrint } from '../api/studentProjectService';
import { PrinterFill, CheckCircleFill, XLg } from 'react-bootstrap-icons';
import toast from 'react-hot-toast';

interface PrintQueueModalProps {
	groupId: string;
	onCompleted?: () => void; // Opcjonalny callback, np. żeby odświeżyć dane na stronie grupy
}

export function PrintQueueModal({ groupId, onCompleted }: PrintQueueModalProps) {
	const [pendingPrints, setPendingPrints] = useState<PendingPrint[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	// Sprawdzamy przy wejściu w grupę, czy są jakieś zaległe wydruki
	useEffect(() => {
		if (!groupId) return;

		const checkQueue = async () => {
			try {
				const prints = await studentProjectService.getPendingPrints(groupId);
				if (prints.length > 0) {
					setPendingPrints(prints);
					setIsOpen(true); // Otwieramy modal tylko jeśli coś jest w kolejce
				}
			} catch (error) {
				console.error('Błąd pobierania kolejki wydruków:', error);
			}
		};

		checkQueue();
	}, [groupId]);

	const handleCompleteAll = async () => {
		setIsSaving(true);
		try {
			const ids = pendingPrints.map((p) => p.id);
			await studentProjectService.markAsCompleted(ids);

			toast.success('Wszystkie wydruki zostały oznaczone jako Zrealizowane!');
			setIsOpen(false);
			if (onCompleted) onCompleted(); // Odświeża widok grupy
		} catch (error) {
			toast.error('Wystąpił błąd podczas aktualizacji statusów.');
			console.error(error);
		} finally {
			setIsSaving(false);
		}
	};

	// Jeśli kolejka jest pusta albo użytkownik zamknął modal, renderujemy nic (null)
	if (!isOpen) return null;

	return (
		<div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
			<div className="animate-in zoom-in-95 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
				{/* NAGŁÓWEK */}
				<div className="flex items-start justify-between bg-blue-600 p-6 text-white">
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-white/20 p-3">
							<PrinterFill size={24} />
						</div>
						<div>
							<h2 className="text-xl font-extrabold">Zaległe Wydruki</h2>
							<p className="text-sm font-medium text-blue-100">System wykrył statusy "Do druku"</p>
						</div>
					</div>
					<button
						onClick={() => setIsOpen(false)}
						className="cursor-pointer text-white/60 transition-colors hover:text-white"
					>
						<XLg size={24} />
					</button>
				</div>

				{/* ZAWARTOŚĆ */}
				<div className="p-6">
					<p className="mb-4 font-medium text-slate-600">
						Zanim rozpoczniesz zajęcia, czy poniższe projekty zostały wydrukowane i mamy zmienić ich status na{' '}
						<span className="font-bold text-green-600">Zrealizowane</span>?
					</p>

					<div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
						<ul className="divide-y divide-slate-100">
							{pendingPrints.map((print, idx) => (
								<li key={print.id} className="flex items-center gap-3 px-3 py-2.5">
									<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
										{idx + 1}
									</span>
									<div>
										<p className="text-sm font-bold text-slate-800">{print.studentName}</p>
										<p className="text-xs font-medium text-slate-500">{print.projectName}</p>
									</div>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* STOPKA Z AKCJAMI */}
				<div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-6">
					<button
						onClick={() => setIsOpen(false)}
						className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-600 transition-colors hover:bg-slate-100"
					>
						Zostaw bez zmian
					</button>
					<button
						onClick={handleCompleteAll}
						disabled={isSaving}
						className="flex flex-2 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white shadow-md transition-all hover:bg-blue-700 disabled:bg-blue-400"
					>
						{isSaving ? (
							'Zapisywanie...'
						) : (
							<>
								<CheckCircleFill /> Tak, oznacz jako Zrealizowane
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
