import { useState, useEffect, useRef } from 'react';

interface Option {
	value: string;
	label: string;
}

interface CustomSelectProps {
	label?: string;
	options: Option[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
}

export function CustomSelect({
	label,
	options,
	value,
	onChange,
	placeholder = 'Wybierz...',
	className = '',
}: CustomSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const selectedOption = options.find((o) => o.value === value);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	return (
		<div ref={containerRef} className={`relative ${className}`}>
			{label && (
				<label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
					{label}
				</label>
			)}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 outline-none text-left"
			>
				<span className="truncate">
					{selectedOption ? selectedOption.label : placeholder}
				</span>
				<span className={`ml-2 text-[10px] text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
					▼
				</span>
			</button>

			{isOpen && (
				<div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-100">
					<div className="flex flex-col gap-0.5">
						{options.map((opt) => {
							const isSelected = opt.value === value;
							return (
								<button
									key={opt.value}
									type="button"
									onClick={() => {
										onChange(opt.value);
										setIsOpen(false);
									}}
									className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
										isSelected
											? 'bg-purple-50 text-purple-700 font-semibold'
											: 'text-slate-700 hover:bg-slate-50'
									}`}
								>
									{opt.label}
								</button>
							);
						})}
						{options.length === 0 && (
							<div className="py-2 text-center text-xs text-slate-400 italic">Brak opcji</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
