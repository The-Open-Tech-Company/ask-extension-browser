// Обработка диалога добавления заметки
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tabUrl = urlParams.get('url') || '';
  
  const noteTextInput = document.getElementById('noteText');
  const form = document.getElementById('noteForm');
  const cancelBtn = document.getElementById('cancelBtn');
  
  noteTextInput.focus();
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const noteText = noteTextInput.value.trim();
    
    if (!noteText) {
      alert('Введите текст заметки');
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'saveNoteFromDialog',
      noteText: noteText,
      url: tabUrl
    }, (response) => {
      if (response && response.success) {
        window.close();
      } else {
        alert(response?.error || 'Ошибка сохранения заметки');
      }
    });
  });
  
  cancelBtn.addEventListener('click', () => {
    window.close();
  });
});

