"use client"

import * as Ariakit from "@ariakit/react"
import { useCallback, useMemo, useRef, useState } from "react"

// -- Hooks --
import { useOnClickOutside } from "@/hooks/use-on-click-outside"
import { useComposedRef } from "@/hooks/use-composed-ref"

// -- Utils --
import { cn } from "@/lib/tiptap-utils"

// -- UI Primitives --
import {
  ComboboxItem,
  ComboboxProvider,
} from "@/components/tiptap-ui-primitive/combobox"

// -- Local imports --
import type {
  MenuProps,
  MenuContentProps,
  MenuItemProps,
} from "@/components/tiptap-ui-primitive/menu"
import {
  SearchableContext,
  MenuContext,
  useSearchableContext,
  useMenuContext,
} from "@/components/tiptap-ui-primitive/menu"
import {
  useMenuPlacement,
  useMenuItemClick,
} from "@/components/tiptap-ui-primitive/menu"

// -- Styles --
import "@/components/tiptap-ui-primitive/menu/menu.scss"

export function MenuProvider({ ...props }: Ariakit.MenuProviderProps) {
  return <Ariakit.MenuProvider {...props} />
}

export function Menu({
  children,
  trigger,
  value,
  onOpenChange,
  onValueChange,
  onValuesChange,
  ...props
}: MenuProps) {
  const isRootMenu = !Ariakit.useMenuContext()
  const [open, setOpen] = useState<boolean>(false)
  const searchable = !!onValuesChange || isRootMenu

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (props.open === undefined) {
        setOpen(v)
      }
      onOpenChange?.(v)
    },
    [props.open, onOpenChange]
  )

  const menuContextValue = useMemo(
    () => ({
      isRootMenu,
      open: props.open ?? open,
    }),
    [isRootMenu, props.open, open]
  )

  const menuProvider = (
    <Ariakit.MenuProvider
      open={open}
      setOpen={handleOpenChange}
      setValues={onValuesChange}
      showTimeout={100}
      {...props}
    >
      {trigger}
      <MenuContext.Provider value={menuContextValue}>
        <SearchableContext.Provider value={searchable}>
          {children}
        </SearchableContext.Provider>
      </MenuContext.Provider>
    </Ariakit.MenuProvider>
  )

  if (searchable) {
    return (
      <ComboboxProvider value={value} setValue={onValueChange}>
        {menuProvider}
      </ComboboxProvider>
    )
  }

  return menuProvider
}

export function MenuContent({
  children,
  className,
  ref,
  onClickOutside,
  ...props
}: MenuContentProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { open } = useMenuContext()
  const side = useMenuPlacement()

  useOnClickOutside(menuRef, onClickOutside || (() => {}))

  return (
    <Ariakit.Menu
      ref={useComposedRef(menuRef, ref)}
      className={cn("tiptap-menu-content", className)}
      data-side={side}
      data-state={open ? "open" : "closed"}
      gutter={4}
      flip
      unmountOnHide
      {...props}
    >
      {children}
    </Ariakit.Menu>
  )
}

export function MenuList({ className, ...props }: Ariakit.MenuListProps) {
  return (
    <Ariakit.MenuList
      data-slot="tiptap-menu-list"
      className={cn("tiptap-menu-list", className)}
      {...props}
    />
  )
}

export function MenuButton({ className, ...props }: Ariakit.MenuButtonProps) {
  return (
    <Ariakit.MenuButton
      {...props}
      className={cn("tiptap-menu-button", className)}
    />
  )
}

export function MenuButtonArrow({
  className,
  ...props
}: Ariakit.MenuButtonArrowProps) {
  return (
    <Ariakit.MenuButtonArrow
      {...props}
      className={cn("tiptap-menu-button-arrow", className)}
    />
  )
}

export function MenuArrow({ className, ...props }: Ariakit.MenuArrowProps) {
  return (
    <Ariakit.MenuArrow
      data-slot="tiptap-menu-arrow"
      className={cn("tiptap-menu-arrow", className)}
      {...props}
    />
  )
}

export function MenuHeading({ className, ...props }: Ariakit.MenuHeadingProps) {
  return (
    <Ariakit.MenuHeading
      data-slot="tiptap-menu-heading"
      className={cn("tiptap-menu-heading", className)}
      {...props}
    />
  )
}

export function MenuDescription({
  className,
  ...props
}: Ariakit.MenuDescriptionProps) {
  return (
    <Ariakit.MenuDescription
      data-slot="tiptap-menu-description"
      className={cn("tiptap-menu-description", className)}
      {...props}
    />
  )
}

export function MenuDismiss({ className, ...props }: Ariakit.MenuDismissProps) {
  return (
    <Ariakit.MenuDismiss
      data-slot="tiptap-menu-dismiss"
      className={cn("tiptap-menu-dismiss", className)}
      {...props}
    />
  )
}

export function MenuGroup({ className, ...props }: Ariakit.MenuGroupProps) {
  return (
    <Ariakit.MenuGroup
      {...props}
      className={cn("tiptap-menu-group", className)}
    />
  )
}

export function MenuGroupLabel({
  className,
  ...props
}: Ariakit.MenuGroupLabelProps) {
  return (
    <Ariakit.MenuGroupLabel
      {...props}
      className={cn("tiptap-menu-group-label", className)}
    />
  )
}

export function MenuSeparator({
  className,
  ...props
}: Ariakit.MenuSeparatorProps) {
  return (
    <Ariakit.MenuSeparator
      data-slot="tiptap-menu-separator"
      className={cn("tiptap-menu-separator", className)}
      {...props}
    />
  )
}

export function MenuItemCheck({
  className,
  ...props
}: Ariakit.MenuItemCheckProps) {
  return (
    <Ariakit.MenuItemCheck
      {...props}
      className={cn("tiptap-menu-item-check", className)}
    />
  )
}

export function MenuItemCheckbox({
  className,
  ...props
}: Ariakit.MenuItemCheckboxProps) {
  return (
    <Ariakit.MenuItemCheckbox
      data-slot="tiptap-menu-item-checkbox"
      className={cn("tiptap-menu-item-checkbox", className)}
      {...props}
    />
  )
}

export function MenuItemRadio({
  className,
  ...props
}: Ariakit.MenuItemRadioProps) {
  return (
    <Ariakit.MenuItemRadio
      {...props}
      className={cn("tiptap-menu-item-radio", className)}
    />
  )
}

export function MenuItem({
  name,
  value,
  preventClose,
  className,
  ...props
}: MenuItemProps) {
  const menu = Ariakit.useMenuContext()
  const searchable = useSearchableContext()

  const hideOnClick = useMenuItemClick(menu, preventClose)

  const itemProps: MenuItemProps = {
    blurOnHoverEnd: false,
    focusOnHover: true,
    className: cn("tiptap-menu-item", className),
    ...props,
  }

  if (!searchable) {
    if (name && value) {
      return (
        <MenuItemRadio
          {...itemProps}
          hideOnClick={true}
          name={name}
          value={value}
        />
      )
    }

    return <Ariakit.MenuItem {...itemProps} />
  }

  return <ComboboxItem {...itemProps} hideOnClick={hideOnClick} />
}
