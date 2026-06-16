/**
 * @file ui/index.ts
 * @description Barrel — re-exporta todos los componentes de UI.
 */
export { Button }     from './Button';
export { Badge,
         projectStatusVariant,
         urgencyVariant }     from './Badge';
export { DataTable }  from './DataTable';
export { Input,
         Textarea,
         Select }     from './Input';
export { Toast }      from './Toast';
export { Modal }      from './Modal';

export type { ButtonProps, ButtonVariant, ButtonSize }     from './Button';
export type { BadgeProps, BadgeVariant, BadgeSize }       from './Badge';
export type { DataTableProps, Column, RowAction }         from './DataTable';
export type { InputProps, TextareaProps, SelectProps }    from './Input';
export type { ToastProps }                                from './Toast';
