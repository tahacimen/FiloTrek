"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TR_PROVINCES, districtsOf } from "@/lib/tr-cities";

/**
 * Reusable 81-il → ilçe picker (C1). shadcn's Select isn't a native form
 * control, so the chosen values are mirrored into hidden inputs under the
 * given field names; changing the province resets the district. An optional
 * onChange lets a parent react (used by the request form's auto-km, C2).
 */
export function ProvinceDistrictSelect({
  provinceName = "province",
  districtName = "district",
  defaultProvince = "",
  defaultDistrict = "",
  required = false,
  onChange,
}: {
  provinceName?: string;
  districtName?: string;
  defaultProvince?: string;
  defaultDistrict?: string;
  required?: boolean;
  onChange?: (province: string, district: string) => void;
}) {
  const [province, setProvince] = useState(defaultProvince);
  const [district, setDistrict] = useState(defaultDistrict);
  const districts = province ? districtsOf(province) : [];

  function handleProvince(value: string) {
    setProvince(value);
    setDistrict("");
    onChange?.(value, "");
  }
  function handleDistrict(value: string) {
    setDistrict(value);
    onChange?.(province, value);
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <input type="hidden" name={provinceName} value={province} />
      <input type="hidden" name={districtName} value={district} />
      <div className="flex flex-col gap-2">
        <Label>İl{required ? "" : " (opsiyonel)"}</Label>
        <Select value={province || undefined} onValueChange={handleProvince}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="İl seçin" />
          </SelectTrigger>
          <SelectContent>
            {TR_PROVINCES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>İlçe{required ? "" : " (opsiyonel)"}</Label>
        <Select
          value={district || undefined}
          onValueChange={handleDistrict}
          disabled={!province}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={province ? "İlçe seçin" : "Önce il seçin"} />
          </SelectTrigger>
          <SelectContent>
            {districts.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
