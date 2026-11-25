const revealButton = document.getElementById('reveal-btn');

revealButton.addEventListener('click', () => {
  document.getElementById('reveal-answer').hidden = false;
  revealButton.setAttribute('aria-expanded', 'true');
  revealButton.hidden = true;
});
