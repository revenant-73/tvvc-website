// This file is deprecated - Group training functionality has been removed
console.log('Group training functionality has been removed');

// Function to populate the mobile sessions list (deprecated)
function populateMobileSessionsList() {
  const mobileContainer = document.getElementById('mobile-sessions-container');
  
  // Clear previous content
  mobileContainer.innerHTML = '';
  
  // Sort sessions by date
  const sortedSessions = [...availableSessions].sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });
  
  if (sortedSessions.length === 0) {
    mobileContainer.innerHTML = `
      <div class="no-sessions-message">
        No available sessions at this time. Please check back later.
      </div>
    `;
    return;
  }
  
  // Create a session item for each available date
  sortedSessions.forEach(session => {
    const sessionDate = new Date(session.date);
    const formattedDate = sessionDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    const dayName = sessionDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    const sessionItem = document.createElement('div');
    sessionItem.className = 'mobile-session-item';
    sessionItem.dataset.date = session.date;
    
    // Calculate total available spots
    const totalSpots = session.times.reduce((sum, time) => sum + (time.max || 8), 0);
    const totalBooked = session.times.reduce((sum, time) => sum + (time.booked || 0), 0);
    const availableSpots = totalSpots - totalBooked;
    
    sessionItem.innerHTML = `
      <div class="mobile-session-date">
        <span><span class="day-name">${dayName}</span>, ${formattedDate}</span>
        <span style="font-size: 0.8rem; color: var(--text-secondary);">
          ${session.times.length} time${session.times.length > 1 ? 's' : ''}
        </span>
      </div>
      <div style="font-size: 0.9rem; color: var(--text-secondary);">
        ${availableSpots} spot${availableSpots !== 1 ? 's' : ''} available
      </div>
      <div class="mobile-session-times"></div>
    `;
    
    // Add time slots to the session item
    const timesContainer = sessionItem.querySelector('.mobile-session-times');
    
    session.times.forEach(timeObj => {
      const maxSpots = timeObj.max || 8;
      const bookedSpots = timeObj.booked || 0;
      const availableSpots = maxSpots - bookedSpots;
      const isBooked = availableSpots <= 0;
      
      const timeSlot = document.createElement('span');
      timeSlot.className = `mobile-time-slot ${isBooked ? 'booked' : ''}`;
      timeSlot.dataset.time = timeObj.time;
      timeSlot.dataset.date = session.date;
      timeSlot.textContent = `${timeObj.time} (${availableSpots}/${maxSpots})`;
      
      if (!isBooked) {
        timeSlot.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering the parent click
          
          // Remove selected class from all time slots
          document.querySelectorAll('.mobile-time-slot.selected').forEach(el => {
            el.classList.remove('selected');
          });
          
          // Add selected class to this time slot
          timeSlot.classList.add('selected');
          
          // Update the form values
          document.getElementById('chosen-date').value = session.date;
          document.getElementById('chosen-time').value = timeObj.time;
          
          // Format the date to be more readable
          const formattedDate = new Date(session.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          
          // Update the selected date display
          document.getElementById('selected-date').textContent = formattedDate;
          
          // Scroll to the booking form
          document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth' });
        });
      }
      
      timesContainer.appendChild(timeSlot);
    });
    
    // Toggle time slots visibility when clicking on a session
    sessionItem.addEventListener('click', () => {
      // Close all other open sessions
      document.querySelectorAll('.mobile-session-item.active').forEach(item => {
        if (item !== sessionItem) {
          item.classList.remove('active');
        }
      });
      
      // Toggle this session
      sessionItem.classList.toggle('active');
    });
    
    mobileContainer.appendChild(sessionItem);
  });
}