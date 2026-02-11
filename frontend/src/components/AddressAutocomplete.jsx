import { useState, useEffect, useRef, useCallback } from 'react'

const RADAR_API_BASE = 'https://api.radar.io/v1'
const DEBOUNCE_MS = 500

/**
 * AddressAutocomplete - A reusable address autocomplete component using Radar API
 * 
 * Props:
 * - value: Current input value
 * - onChange: Called when input value changes (for controlled input)
 * - onSelect: Called when an address is selected, receives parsed address object
 * - placeholder: Input placeholder text
 * - className: Additional CSS classes for the input
 * - disabled: Whether the input is disabled
 * - mode: 'full' returns full address string, 'components' returns parsed address parts
 */
function AddressAutocomplete({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  className = '',
  disabled = false,
  mode = 'components', // 'full' or 'components'
}) {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [noResults, setNoResults] = useState(false)
  
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const debounceRef = useRef(null)

  // Sync with external value prop
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch suggestions from Radar API
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([])
      setNoResults(false)
      return
    }

    const apiKey = import.meta.env.VITE_RADAR_PUBLISHABLE_KEY
    if (!apiKey) {
      console.warn('VITE_RADAR_PUBLISHABLE_KEY not configured. Address autocomplete disabled.')
      setSuggestions([])
      setNoResults(true)
      return
    }

    setIsLoading(true)
    setNoResults(false)

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        layers: 'address',
        countryCode: 'US',
        limit: '5',
      })

      const response = await fetch(
        `${RADAR_API_BASE}/search/autocomplete?${params}`,
        {
          headers: {
            Authorization: apiKey,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions')
      }

      const data = await response.json()
      const addresses = data.addresses || []

      setSuggestions(addresses)
      setNoResults(addresses.length === 0 && query.length >= 3)
      setShowDropdown(true)
    } catch (error) {
      console.error('Error fetching address suggestions:', error)
      setSuggestions([])
      setNoResults(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced search
  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setHighlightedIndex(-1)
    
    // Call external onChange if provided
    if (onChange) {
      onChange(e)
    }

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce API calls (500ms after user stops typing)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue)
    }, DEBOUNCE_MS)
  }

  // Parse address from Radar API result
  const parseAddress = (addr) => {
    const streetAddress = addr.addressLabel || [addr.number, addr.street].filter(Boolean).join(' ') || ''
    const city = addr.city || ''
    const state = addr.state || addr.stateCode || ''
    const zipCode = addr.postalCode || ''
    const country = addr.country || 'USA'

    return {
      address_line1: streetAddress,
      city,
      state,
      zip_code: zipCode,
      country,
      full_address: addr.formattedAddress || [streetAddress, city, state, zipCode].filter(Boolean).join(', '),
    }
  }

  // Handle selection
  const handleSelect = (result) => {
    const parsed = parseAddress(result)
    
    if (mode === 'full') {
      setInputValue(parsed.full_address)
      if (onChange) {
        // Create a synthetic event for the onChange handler
        const syntheticEvent = { target: { value: parsed.full_address } }
        onChange(syntheticEvent)
      }
    } else {
      setInputValue(parsed.address_line1)
    }

    if (onSelect) {
      onSelect(parsed)
    }

    setShowDropdown(false)
    setSuggestions([])
    setHighlightedIndex(-1)
  }

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) {
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setHighlightedIndex(-1)
        break
      default:
        break
    }
  }

  // Handle focus
  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowDropdown(true)
    }
  }

  // Format display address for dropdown (Radar address object)
  const formatDisplayAddress = (addr) => {
    const parts = []
    const street = addr.addressLabel || [addr.number, addr.street].filter(Boolean).join(' ')
    if (street) parts.push(street)
    if (addr.city) parts.push(addr.city)
    if (addr.state || addr.stateCode) parts.push(addr.state || addr.stateCode)
    if (addr.postalCode) parts.push(addr.postalCode)
    return parts.join(', ')
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-pool-blue focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-shadow ${className}`}
        autoComplete="off"
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pool-blue"></div>
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (suggestions.length > 0 || noResults) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.length > 0 ? (
            suggestions.map((result, index) => (
              <button
                key={result.formattedAddress || `${result.latitude}-${result.longitude}-${index}`}
                type="button"
                onClick={() => handleSelect(result)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  index === highlightedIndex
                    ? 'bg-pool-blue/10 dark:bg-pool-blue/20 text-pool-blue'
                    : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${index === 0 ? 'rounded-t-lg' : ''} ${
                  index === suggestions.length - 1 ? 'rounded-b-lg' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 mt-0.5 text-gray-400 dark:text-gray-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="line-clamp-2">{formatDisplayAddress(result)}</span>
                </div>
              </button>
            ))
          ) : noResults ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              No addresses found
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default AddressAutocomplete
