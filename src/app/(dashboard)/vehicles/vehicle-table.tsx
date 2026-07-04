"use client";

import { useTransition } from "react";
import { MoreHorizontal, Wrench } from "lucide-react";
import { toast } from "sonner";

import {
  deleteVehicleAction,
  toggleVehicleMaintenanceAction,
} from "@/app/(dashboard)/vehicles/actions";
import { VehicleFormDialog } from "@/app/(dashboard)/vehicles/vehicle-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  statusBadgeVariant,
  vehicleBedTypeLabels,
  vehicleStatusLabels,
  vehicleTypeLabels,
} from "@/lib/labels";
import type { SerializableVehicle } from "@/app/(dashboard)/vehicles/types";

export function VehicleTable({ vehicles }: { vehicles: SerializableVehicle[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggleMaintenance(vehicle: SerializableVehicle) {
    const goingToMaintenance = vehicle.status !== "MAINTENANCE";
    if (
      !confirm(
        `${vehicle.plate} plakalı aracı ${goingToMaintenance ? "bakıma almak" : "bakımdan çıkarmak"} istediğinize emin misiniz?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await toggleVehicleMaintenanceAction(
        vehicle.id,
        vehicle.status !== "MAINTENANCE"
      );
      if (result?.error) toast.error(result.error);
    });
  }

  function handleDelete(vehicle: SerializableVehicle) {
    if (!confirm(`${vehicle.plate} plakalı aracı silmek istediğinize emin misiniz?`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteVehicleAction(vehicle.id);
      if (result?.error) toast.error(result.error);
      else toast.success("Araç silindi.");
    });
  }

  if (vehicles.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        Henüz araç eklenmedi.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plaka</TableHead>
          <TableHead>Tip</TableHead>
          <TableHead>Kasa</TableHead>
          <TableHead>Tonaj</TableHead>
          <TableHead>Durum</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {vehicles.map((vehicle) => (
          <TableRow key={vehicle.id}>
            <TableCell className="font-medium">{vehicle.plate}</TableCell>
            <TableCell>{vehicleTypeLabels[vehicle.vehicleType]}</TableCell>
            <TableCell>{vehicleBedTypeLabels[vehicle.bedType]}</TableCell>
            <TableCell>{vehicle.tonnageCapacity.toString()} ton</TableCell>
            <TableCell>
              <Badge variant={statusBadgeVariant[vehicle.status]}>
                {vehicleStatusLabels[vehicle.status]}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <VehicleFormDialog vehicle={vehicle} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(vehicle.status === "AVAILABLE" ||
                      vehicle.status === "MAINTENANCE") && (
                      <DropdownMenuItem
                        onClick={() => handleToggleMaintenance(vehicle)}
                      >
                        <Wrench />
                        {vehicle.status === "MAINTENANCE"
                          ? "Bakımdan Çıkar"
                          : "Bakıma Al"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={vehicle.status !== "AVAILABLE"}
                      onClick={() => handleDelete(vehicle)}
                    >
                      Sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
