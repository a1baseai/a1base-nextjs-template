"use client"

import * as React from "react"
import { Switch } from "./switch"
import { cn } from "@/lib/utils"

interface ToggleSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  description?: string
  className?: string
  id?: string
}

const ToggleSwitch = React.forwardRef<
  React.ElementRef<typeof Switch>,
  ToggleSwitchProps
>(({ checked, onCheckedChange, disabled, label, description, className, id }, ref) => {
  const switchId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`
  
  return (
    <div className={cn("flex items-center justify-between space-x-4", className)}>
      <div className="grid gap-1.5 leading-none flex-1">
        <label
          htmlFor={switchId}
          className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        ref={ref}
      />
    </div>
  )
})

ToggleSwitch.displayName = "ToggleSwitch"

export { ToggleSwitch } 