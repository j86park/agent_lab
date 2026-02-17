import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    Home,
    PlusSquare,
    History,
    LayoutTemplate,
    BrainCircuit,
    Settings,
    Beaker
} from "lucide-react";

const navItems = [
    { icon: Home, label: "Agents", href: "/" },
    { icon: PlusSquare, label: "New Agent", href: "/agents/new" },
    { icon: History, label: "History", href: "/history" },
    { icon: LayoutTemplate, label: "Templates", href: "/templates" },
    { icon: BrainCircuit, label: "Skills", href: "/skills" },
    { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar() {
    return (
        <div className="flex h-full w-64 flex-col border-r bg-card text-card-foreground">
            <div className="flex h-16 items-center border-b px-6 gap-2">
                <Beaker className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold tracking-tight">Agent Lab</span>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.href}
                        to={item.href}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                            )
                        }
                    >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>
            <div className="border-t p-4">
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Local Execution</p>
                    <p>All data stays on your hardware.</p>
                </div>
            </div>
        </div>
    );
}
