// This file is deprecated - Group training functionality has been removed
console.log('Group training functionality has been removed');
  
  // Wait for FullCalendar to be initialized
  const checkInterval = setInterval(function() {
    if (window.directCalendar) {
      console.log('Calendar found, adding list view fix');
      clearInterval(checkInterval);
      
      // Add click handler for list view button
      const listButton = document.querySelector('.fc-listMonth-button');
      if (listButton) {
        console.log('List button found, adding click handler');
        
        listButton.addEventListener('click', function() {
          console.log('List button clicked');
          
          // Force switch to list view
          setTimeout(function() {
            console.log('Forcing list view');
            window.directCalendar.changeView('listMonth');
            
            // Fix list view styling
            setTimeout(function() {
              const listView = document.querySelector('.fc-list');
              if (listView) {
                console.log('List view found, fixing styling');
                listView.style.height = '500px';
                listView.style.overflowY = 'auto';
              }
              
              const listViewContainer = document.querySelector('.fc-listMonth-view');
              if (listViewContainer) {
                console.log('List view container found, fixing visibility');
                listViewContainer.style.display = 'block';
                listViewContainer.style.visibility = 'visible';
              }
            }, 100);
          }, 50);
        });
      }
    }
  }, 500);
});