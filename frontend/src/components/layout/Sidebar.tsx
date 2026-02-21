import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    Home,
    PlusSquare,
    History,
    LayoutTemplate,
    BrainCircuit,
    Settings,
    FlaskConical,
    TestTube2,
    BarChart3,
} from "lucide-react";

const WORKSPACE_ITEMS = [
    { icon: Home, label: "Agents", href: "/" },
    { icon: PlusSquare, label: "New Agent", href: "/agents/new" },
    { icon: BarChart3, label: "Analytics", href: "/analytics" },
    { icon: History, label: "History", href: "/history" },
    { icon: LayoutTemplate, label: "Templates", href: "/templates" },
    { icon: BrainCircuit, label: "Skills", href: "/skills" },
    { icon: TestTube2, label: "Test Suites", href: "/test-suites" },
];

const SYSTEM_ITEMS = [
    { icon: Settings, label: "Settings", href: "/settings" },
];

function NavSection({
    label,
    items,
}: {
    label: string;
    items: { icon: React.ElementType; label: string; href: string }[];
}) {
    return (
        <div className="space-y-0.5">
            <p className="px-3 pb-1 pt-4 text-[10px] font-mono font-semibold tracking-widest uppercase text-muted-foreground/60 select-none">
                {label}
            </p>
            {items.map((item) => (
                <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.href === "/"}
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-2.5 rounded-sm px-3 py-1.5 text-xs font-medium tracking-wide transition-colors",
                            isActive
                                ? "bg-accent text-foreground border-l-2 border-primary pl-[10px]"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                        )
                    }
                >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                </NavLink>
            ))}
        </div>
    );
}

export default function Sidebar() {
    return (
        <div className="flex h-full w-56 flex-col bg-sidebar border-r border-sidebar-border">
            {/* Logo */}
            <div className="flex h-14 items-center border-b border-sidebar-border px-4 gap-2.5">
                <FlaskConical className="h-4 w-4 text-primary shrink-0" />
                <div>
                    <p className="text-xs font-mono font-semibold tracking-widest uppercase text-foreground leading-none">
                        Agent Lab
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                        v1.0.0
                    </p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-2 py-1">
                <NavSection label="Workspace" items={WORKSPACE_ITEMS} />
                <NavSection label="System" items={SYSTEM_ITEMS} />
            </nav>

            {/* Status footer */}
            <div className="border-t border-sidebar-border px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="font-mono text-[11px]">Running locally</span>
                </div>
            </div>
        </div>
    );
}
