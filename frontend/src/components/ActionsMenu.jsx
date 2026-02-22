/**
 * Reusable actions menu (3-dot kebab) for table rows.
 * Renders a vertical dots button that opens a dropdown with labeled actions.
 * Pass usePortal={true} only when inside overflow containers (e.g. ProjectExpenses tables).
 */
import { useRef, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const DOCUMENT_ICON = (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)
const EDIT_ICON = (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)
const DELETE_ICON = (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)
const EXPENSE_ICON = (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const TIMELINE_ICON = (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export { DOCUMENT_ICON, EDIT_ICON, DELETE_ICON, EXPENSE_ICON, TIMELINE_ICON }

const DropdownContent = ({ actions, onAction }) => (
  <div role="menu">
    {actions.map((action, idx) => (
      <button
        key={idx}
        role="menuitem"
        onClick={() => {
          action.onClick()
          onAction?.()
        }}
        disabled={action.disabled}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${
          action.danger
            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
        }`}
      >
        <span className={action.danger ? '' : (action.iconColor || 'text-pool-blue dark:text-pool-blue')}>{action.icon}</span>
        {action.label}
      </button>
    ))}
  </div>
)

export default function ActionsMenu({ isOpen, onToggle, onAction, actions, usePortal = false }) {
  const triggerRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (usePortal && isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.right,
      })
    }
  }, [usePortal, isOpen])

  const dropdownClassName = 'min-w-[140px] py-1 rounded-lg overflow-hidden bg-white dark:bg-gray-700 shadow-lg border border-gray-200 dark:border-gray-600 origin-top-right animate-dropdown-in'

  const inlineDropdown = isOpen && (
    <div
      className={`absolute right-0 top-full mt-1 z-10 ${dropdownClassName}`}
    >
      <DropdownContent actions={actions} onAction={onAction} />
    </div>
  )

  const portalDropdown = isOpen && createPortal(
    <div
      data-actions-menu-dropdown
      className={`fixed z-[9999] ${dropdownClassName}`}
      style={{ top: position.top, left: position.left, transform: 'translateX(-100%)' }}
    >
      <DropdownContent actions={actions} onAction={onAction} />
    </div>,
    document.body
  )

  return (
    <div className="relative flex items-center justify-end">
      <button
        ref={triggerRef}
        onClick={onToggle}
        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="Actions"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {usePortal ? portalDropdown : inlineDropdown}
    </div>
  )
}
