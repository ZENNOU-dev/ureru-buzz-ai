import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center">
        <Construction className="w-8 h-8 text-zinc-400" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
      <p className="text-sm text-zinc-500">
        {description ?? "このセクションは現在開発中です"}
      </p>
      <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-500 font-medium">
        Coming Soon
      </span>
    </div>
  );
}
