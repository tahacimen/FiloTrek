"use client";

import { LogOut, User } from "lucide-react";

import { signOutAction } from "@/app/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  userName,
  companyName,
}: {
  userName: string;
  companyName: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted">
            <User className="size-4" />
          </span>
          <span className="hidden text-left sm:flex sm:flex-col">
            <span className="text-sm leading-tight font-medium">
              {userName}
            </span>
            <span className="text-muted-foreground text-xs leading-tight">
              {companyName}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{userName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" className="w-full">
              <LogOut />
              Çıkış Yap
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
