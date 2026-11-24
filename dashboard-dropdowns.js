(() => {
  let menu = null;
  let current = null;

  function closeMenu() {
    if (menu) menu.remove();
    menu = null;
    current = null;
  }

  function openMenu(select) {
    if (select.disabled || select.multiple || select.size > 1) return;
    if (current === select) { closeMenu(); return; }
    closeMenu();
    current = select;
    const rect = select.getBoundingClientRect();
    menu = document.createElement('div');
    menu.className = 'dash-dropdown';
    menu.setAttribute('role', 'listbox');
    menu.style.minWidth = Math.min(window.innerWidth - 16, Math.max(rect.width, 170)) + 'px';
    menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 170) - 8)) + 'px';
    document.body.appendChild(menu);

    for (const option of select.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dash-dropdown-option';
      button.textContent = option.textContent;
      button.disabled = option.disabled || option.parentElement.disabled;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(option.selected));
      button.addEventListener('click', () => {
        select.value = option.value;
        closeMenu();
        select.dispatchEvent(new Event('input', {bubbles: true}));
        select.dispatchEvent(new Event('change', {bubbles: true}));
        if (select.isConnected) select.focus();
      });
      menu.appendChild(button);
    }
    const height = Math.min(menu.scrollHeight, 280);
    const top = rect.bottom + 6 + height <= window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
    menu.style.top = top + 'px';
    menu.querySelector('[aria-selected="true"]')?.scrollIntoView({block: 'nearest'});
  }

  document.addEventListener('mousedown', event => {
    const select = event.target.closest('select');
    if (select && !select.multiple && select.size <= 1 && !select.disabled) {
      event.preventDefault();
      select.focus();
      openMenu(select);
    } else if (menu && !menu.contains(event.target)) closeMenu();
  }, true);
  document.addEventListener('keydown', event => {
    const select = event.target.closest('select');
    if (select && !select.multiple && select.size <= 1 && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu(select);
      menu?.querySelector('[aria-selected="true"]')?.focus();
    } else if (event.key === 'Escape' && menu) {
      event.preventDefault();
      const previous = current;
      closeMenu();
      if (previous?.isConnected) previous.focus();
    } else if (menu && menu.contains(event.target) && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const options = Array.from(menu.querySelectorAll('button:not(:disabled)'));
      const index = options.indexOf(event.target);
      options[Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    }
  });
  window.addEventListener('resize', closeMenu);
  document.addEventListener('scroll', event => {
    if (menu && !menu.contains(event.target)) closeMenu();
  }, true);
})();
