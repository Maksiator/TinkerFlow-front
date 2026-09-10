import { useState, useEffect, useRef, useMemo } from 'react';
import { Search } from 'react-bootstrap-icons';

export interface CustomSelectOption {
	value: string;
	label: string;
	sublabel?: string;
}

export interface CustomSelectProps {
	label?: string;
	options: CustomSelectOption[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	color?: 'purple' | 'blue';
	searchable?: boolean;
	helperText?: string;
	required?: boolean;
}

export function CustomSelect({
	label,
	options,
	value,
	onChange,
	placeholder = 'Wybierz...',
	className = '',
	disabled = false,
	color = 'purple',
	searchable = false,
	helperText,
	required = false,
}: CustomSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const containerRef = useRef<HTMLDivElement>(null);

	const isBlue = color === 'blue';
	const selectedOption = options.find((o) => o.value === value);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
				setSearchQuery('');
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const filteredOptions = useMemo(() => {
		if (!searchQuery.trim()) return options;
		const query = searchQuery.toLowerCase().trim();
		return options.filter(
			(o) =>
				o.label.toLowerCase().includes(query) ||
				(o.sublabel && o.sublabel.toLowerCase().includes(query))
		);
	}, [options, searchQuery]);

	return (
		<div ref={containerRef} className={`relative ${className}`}>
			{label && (
				<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
					{label} {required && <span className="text-red-500">*</span>}
				</label>
			)}
			<button
				type="button"
				disabled={disabled}
				onClick={() => {
					if (!disabled) {
						setIsOpen(!isOpen);
						setSearchQuery('');
					}
				}}
				className={`flex w-full items-center justify-between rounded-xl border p-3 text-sm font-medium transition-all outline-none text-left ${
					disabled
						? 'cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
						: isBlue
						? 'cursor-pointer bg-white text-slate-700 shadow-sm border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500'
						: 'cursor-pointer bg-white text-slate-700 shadow-sm border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500'
				}`}
			>
				<span className={`truncate ${selectedOption && selectedOption.value !== '' ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}>
					{selectedOption ? selectedOption.label : placeholder}
				</span>
				<span
					className={`ml-2 text-[10px] text-slate-400 transition-transform duration-200 ${
						isOpen ? 'rotate-180' : ''
					}`}
				>
					▼
				</span>
			</button>

			{isOpen && !disabled && (
				<div className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-100">
					{(searchable || options.length > 8) && (
						<div className="relative mb-1.5 p-1">
							<Search size={12} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Szukaj opcji..."
								className="w-full rounded-lg border border-slate-200 py-1.5 pr-2.5 pl-7 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
								autoFocus
							/>
						</div>
					)}
					<div className="flex flex-col gap-0.5">
						{filteredOptions.map((opt) => {
							const isSelected = opt.value === value;
							return (
								<button
									key={opt.value}
									type="button"
									onClick={() => {
										onChange(opt.value);
										setIsOpen(false);
										setSearchQuery('');
									}}
									className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors ${
										isSelected
											? isBlue
												? 'bg-blue-50 text-blue-700 font-semibold'
												: 'bg-purple-50 text-purple-700 font-semibold'
											: 'text-slate-700 hover:bg-slate-50'
									}`}
								>
									<div className="flex flex-col">
										<span className={isSelected ? 'font-bold' : 'font-medium'}>{opt.label}</span>
										{opt.sublabel && (
											<span
												className={`text-xs ${
													isSelected
														? isBlue
															? 'text-blue-500'
															: 'text-purple-500'
														: 'text-slate-400'
												}`}
											>
												{opt.sublabel}
											</span>
										)}
									</div>
								</button>
							);
						})}
						{filteredOptions.length === 0 && (
							<div className="py-2.5 text-center text-xs text-slate-400 italic">Brak wyników</div>
						)}
					</div>
				</div>
			)}

			{helperText && (
				<p className="mt-1 text-[11px] text-slate-400 leading-tight">{helperText}</p>
			)}
		</div>
	);
}
