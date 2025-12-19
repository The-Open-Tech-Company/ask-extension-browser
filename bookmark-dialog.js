// Обработка диалога добавления закладки
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tabTitle = urlParams.get('title') || '';
  const tabUrl = urlParams.get('url') || '';
  
  const titleInput = document.getElementById('title');
  const tagsInput = document.getElementById('tags');
  const descriptionInput = document.getElementById('description');
  const form = document.getElementById('bookmarkForm');
  const cancelBtn = document.getElementById('cancelBtn');
  
  titleInput.value = tabTitle;
  titleInput.focus();
  titleInput.select();
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const bookmark = {
      title: titleInput.value.trim(),
      tags: tagsInput.value.split(',').map(t => t.trim()).filter(t => t),
      description: descriptionInput.value.trim(),
      url: tabUrl
    };
    
    if (!bookmark.title) {
      alert('Введите название закладки');
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'saveBookmarkFromDialog',
      bookmark: bookmark
    }, (response) => {
      if (response && response.success) {
        window.close();
      } else {
        alert(response?.error || 'Ошибка сохранения закладки');
      }
    });
  });
  
  cancelBtn.addEventListener('click', () => {
    window.close();
  });
});
