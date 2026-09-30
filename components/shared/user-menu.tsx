"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";

// ─── Kullanıcı menüsü (çalışma alanı üst çubuğunda) ─

interface UserMenuProps {
  userName?: string;
  userRole?: UserRole;
}

export const UserMenu = ({ userName, userRole }: UserMenuProps) => {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors outline-none cursor-pointer">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium text-foreground leading-tight">
                  {userName ?? "Kullanıcı"}
                </span>
                <span className="text-xs text-muted-foreground leading-tight">
                  {userRole ? ROLE_LABELS[userRole] ?? userRole : ""}
                </span>
              </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              <User className="w-4 h-4 mr-2" />
              {userName ?? "Kullanıcı"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-danger focus:text-danger"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
  );
};
