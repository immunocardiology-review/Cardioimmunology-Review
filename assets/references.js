(function () {
  'use strict';
  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.hidden = false;
    button.addEventListener('click', async function () {
      var card = button.closest('.reference-card');
      var source = document.getElementById(button.dataset.copy);
      var status = card.querySelector('.copy-status');
      var english = card.lang === 'en';
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard-unavailable');
        await navigator.clipboard.writeText(source.textContent.trim());
        status.textContent = english ? 'Copied to clipboard.' : 'Copié dans le presse-papiers.';
      } catch (error) {
        var details = source.closest('details');
        if (details) details.open = true;
        var range = document.createRange();
        range.selectNodeContents(source);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        status.textContent = english ? 'Text selected. Use your device’s Copy command.' : 'Texte sélectionné. Utilisez la commande Copier de votre appareil.';
      }
    });
  });
})();
