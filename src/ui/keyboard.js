// While a text field has focus, <html> gets the class "keyboard-open"
// (index.css hides the bottom menu and the + button then, so they never cover the field).
// Android Chrome resizes the page above the keyboard by itself (index.html viewport setting).

import { useEffect } from 'react'

function isTextField(el) {
  if (!el) return false
  if (el.tagName === 'TEXTAREA' || el.isContentEditable) return true
  if (el.tagName !== 'INPUT') return false
  return !['checkbox', 'radio', 'button', 'submit', 'range', 'date', 'time', 'file', 'color'].includes(el.type)
}

export function useKeyboardClass() {
  useEffect(() => {
    let timer = 0
    const update = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        document.documentElement.classList.toggle('keyboard-open', isTextField(document.activeElement))
      }, 80)
    }
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [])
}
